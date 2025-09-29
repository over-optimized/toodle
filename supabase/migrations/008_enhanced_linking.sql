-- Enhanced linking migration for behavioral parent-child relationships
-- Extends existing linked_items jsonb field to support directional relationships

-- Remove the constraint that requires linked_items to be an array
-- We need to support both array format (legacy) and object format (new)
ALTER TABLE items
DROP CONSTRAINT IF EXISTS linked_items_is_array;

-- Add new validation constraint for enhanced structure
ALTER TABLE items
ADD CONSTRAINT linked_items_valid_structure
CHECK (
  linked_items IS NULL OR
  jsonb_typeof(linked_items) = 'object' OR
  jsonb_typeof(linked_items) = 'array'  -- Support legacy format during transition
);

-- Update the max linked items constraint to work with new structure
ALTER TABLE items
DROP CONSTRAINT IF EXISTS max_linked_items;

-- Add constraint for total linked items across all relationship types
ALTER TABLE items
ADD CONSTRAINT max_total_linked_items
CHECK (
  CASE
    WHEN linked_items IS NULL THEN true
    WHEN jsonb_typeof(linked_items) = 'array' THEN
      jsonb_array_length(linked_items) <= 50
    WHEN jsonb_typeof(linked_items) = 'object' THEN
      COALESCE(jsonb_array_length(linked_items->'children'), 0) +
      COALESCE(jsonb_array_length(linked_items->'parents'), 0) +
      COALESCE(jsonb_array_length(linked_items->'bidirectional'), 0) <= 50
    ELSE true
  END
);

-- Enhanced validation function to support parent-child relationships
CREATE OR REPLACE FUNCTION validate_enhanced_linked_items()
RETURNS TRIGGER AS $$
DECLARE
  children_array jsonb;
  parents_array jsonb;
  bidirectional_array jsonb;
  all_links text[];
  link_id text;
BEGIN
  -- Skip validation if linked_items is null or empty
  IF NEW.linked_items IS NULL OR NEW.linked_items = '[]'::jsonb OR NEW.linked_items = '{}'::jsonb THEN
    RETURN NEW;
  END IF;

  -- Handle legacy array format
  IF jsonb_typeof(NEW.linked_items) = 'array' THEN
    -- Convert to enhanced format for validation
    all_links := ARRAY(SELECT jsonb_array_elements_text(NEW.linked_items));
  ELSE
    -- Extract arrays from enhanced format
    children_array := COALESCE(NEW.linked_items->'children', '[]'::jsonb);
    parents_array := COALESCE(NEW.linked_items->'parents', '[]'::jsonb);
    bidirectional_array := COALESCE(NEW.linked_items->'bidirectional', '[]'::jsonb);

    -- Combine all links for validation
    all_links := ARRAY(
      SELECT jsonb_array_elements_text(children_array) UNION
      SELECT jsonb_array_elements_text(parents_array) UNION
      SELECT jsonb_array_elements_text(bidirectional_array)
    );
  END IF;

  -- Validate each linked item exists and belongs to same user
  FOREACH link_id IN ARRAY all_links
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM items i2
      JOIN lists l2 ON i2.list_id = l2.id
      JOIN lists l1 ON l1.id = NEW.list_id
      WHERE i2.id::text = link_id
      AND l2.user_id = l1.user_id
    ) THEN
      RAISE EXCEPTION 'Invalid linked item: % does not exist or belongs to different user', link_id;
    END IF;
  END LOOP;

  -- Prevent self-linking
  IF NEW.id::text = ANY(all_links) THEN
    RAISE EXCEPTION 'Item cannot be linked to itself';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update trigger to use enhanced validation
DROP TRIGGER IF EXISTS validate_linked_items_trigger ON items;
CREATE TRIGGER validate_enhanced_linked_items_trigger
  BEFORE INSERT OR UPDATE ON items
  FOR EACH ROW
  EXECUTE FUNCTION validate_enhanced_linked_items();

-- Enhanced function to get child items (items controlled by parent)
CREATE OR REPLACE FUNCTION get_child_items(parent_item_id UUID)
RETURNS TABLE(
  id UUID,
  list_id UUID,
  content TEXT,
  is_completed BOOLEAN,
  list_title TEXT,
  list_type list_type
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    i.list_id,
    i.content,
    i.is_completed,
    l.title as list_title,
    l.type as list_type
  FROM items i
  JOIN lists l ON i.list_id = l.id
  CROSS JOIN LATERAL jsonb_array_elements_text(
    COALESCE(
      (SELECT
        CASE
          WHEN jsonb_typeof(linked_items) = 'object' THEN linked_items->'children'
          ELSE '[]'::jsonb
        END
       FROM items WHERE id = parent_item_id),
      '[]'::jsonb
    )
  ) AS child_id
  WHERE i.id = child_id::uuid
  ORDER BY l.title, i.position;
END;
$$ LANGUAGE plpgsql;

-- Enhanced function to get parent items (items that control this item)
CREATE OR REPLACE FUNCTION get_parent_items(child_item_id UUID)
RETURNS TABLE(
  id UUID,
  list_id UUID,
  content TEXT,
  is_completed BOOLEAN,
  list_title TEXT,
  list_type list_type
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    i.list_id,
    i.content,
    i.is_completed,
    l.title as list_title,
    l.type as list_type
  FROM items i
  JOIN lists l ON i.list_id = l.id
  CROSS JOIN LATERAL jsonb_array_elements_text(
    COALESCE(
      (SELECT
        CASE
          WHEN jsonb_typeof(linked_items) = 'object' THEN linked_items->'parents'
          ELSE '[]'::jsonb
        END
       FROM items WHERE id = child_item_id),
      '[]'::jsonb
    )
  ) AS parent_id
  WHERE i.id = parent_id::uuid
  ORDER BY l.title, i.position;
END;
$$ LANGUAGE plpgsql;

-- RPC function to create parent-child link
CREATE OR REPLACE FUNCTION create_parent_child_link(
  parent_item_id UUID,
  child_item_ids UUID[]
)
RETURNS jsonb AS $$
DECLARE
  parent_item RECORD;
  child_item RECORD;
  parent_links jsonb;
  child_links jsonb;
  current_children jsonb;
  current_parents jsonb;
  links_created INTEGER := 0;
  warnings TEXT[] := ARRAY[]::TEXT[];
  child_id UUID;
BEGIN
  -- Get parent item
  SELECT * INTO parent_item FROM items WHERE id = parent_item_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Parent item not found'
    );
  END IF;

  -- Process each child
  FOREACH child_id IN ARRAY child_item_ids
  LOOP
    -- Get child item
    SELECT * INTO child_item FROM items WHERE id = child_id;
    IF NOT FOUND THEN
      warnings := warnings || ('Child item not found: ' || child_id::text);
      CONTINUE;
    END IF;

    -- Prevent self-linking
    IF parent_item_id = child_id THEN
      warnings := warnings || 'Cannot link item to itself';
      CONTINUE;
    END IF;

    -- Update parent item's children array
    parent_links := COALESCE(parent_item.linked_items, '{}'::jsonb);
    IF jsonb_typeof(parent_links) = 'array' THEN
      parent_links := jsonb_build_object('bidirectional', parent_links);
    END IF;

    current_children := COALESCE(parent_links->'children', '[]'::jsonb);
    IF NOT (current_children ? child_id::text) THEN
      current_children := current_children || jsonb_build_array(child_id);
      parent_links := jsonb_set(parent_links, '{children}', current_children);

      UPDATE items
      SET linked_items = parent_links
      WHERE id = parent_item_id;
    END IF;

    -- Update child item's parents array
    child_links := COALESCE(child_item.linked_items, '{}'::jsonb);
    IF jsonb_typeof(child_links) = 'array' THEN
      child_links := jsonb_build_object('bidirectional', child_links);
    END IF;

    current_parents := COALESCE(child_links->'parents', '[]'::jsonb);
    IF NOT (current_parents ? parent_item_id::text) THEN
      current_parents := current_parents || jsonb_build_array(parent_item_id);
      child_links := jsonb_set(child_links, '{parents}', current_parents);

      UPDATE items
      SET linked_items = child_links
      WHERE id = child_id;

      links_created := links_created + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'links_created', links_created,
    'warnings', array_to_json(warnings)
  );
END;
$$ LANGUAGE plpgsql;

-- RPC function to remove parent-child link
CREATE OR REPLACE FUNCTION remove_parent_child_link(
  parent_item_id UUID,
  child_item_id UUID
)
RETURNS jsonb AS $$
DECLARE
  parent_links jsonb;
  child_links jsonb;
  current_children jsonb;
  current_parents jsonb;
  new_children jsonb := '[]'::jsonb;
  new_parents jsonb := '[]'::jsonb;
  child_uuid_text text;
  parent_uuid_text text;
BEGIN
  -- Get parent item links
  SELECT linked_items INTO parent_links FROM items WHERE id = parent_item_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Parent item not found');
  END IF;

  -- Get child item links
  SELECT linked_items INTO child_links FROM items WHERE id = child_item_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Child item not found');
  END IF;

  -- Remove child from parent's children array
  IF parent_links IS NOT NULL AND jsonb_typeof(parent_links) = 'object' THEN
    current_children := COALESCE(parent_links->'children', '[]'::jsonb);

    -- Filter out the child_item_id
    FOR i IN 0..jsonb_array_length(current_children)-1 LOOP
      child_uuid_text := current_children->>i;
      IF child_uuid_text != child_item_id::text THEN
        new_children := new_children || jsonb_build_array(child_uuid_text::uuid);
      END IF;
    END LOOP;

    parent_links := jsonb_set(parent_links, '{children}', new_children);
    UPDATE items SET linked_items = parent_links WHERE id = parent_item_id;
  END IF;

  -- Remove parent from child's parents array
  IF child_links IS NOT NULL AND jsonb_typeof(child_links) = 'object' THEN
    current_parents := COALESCE(child_links->'parents', '[]'::jsonb);

    -- Filter out the parent_item_id
    FOR i IN 0..jsonb_array_length(current_parents)-1 LOOP
      parent_uuid_text := current_parents->>i;
      IF parent_uuid_text != parent_item_id::text THEN
        new_parents := new_parents || jsonb_build_array(parent_uuid_text::uuid);
      END IF;
    END LOOP;

    child_links := jsonb_set(child_links, '{parents}', new_parents);
    UPDATE items SET linked_items = child_links WHERE id = child_item_id;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql;

-- RPC function to validate link creation (prevent cycles)
CREATE OR REPLACE FUNCTION validate_link_creation(
  parent_item_id UUID,
  child_item_ids UUID[]
)
RETURNS jsonb AS $$
DECLARE
  child_id UUID;
  valid_links UUID[] := ARRAY[]::UUID[];
  invalid_links jsonb := '[]'::jsonb;
  warnings TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Check each proposed child
  FOREACH child_id IN ARRAY child_item_ids
  LOOP
    -- Prevent self-linking
    IF parent_item_id = child_id THEN
      invalid_links := invalid_links || jsonb_build_object(
        'child_id', child_id,
        'reason', 'self_link'
      );
      CONTINUE;
    END IF;

    -- Check if this would create a cycle (simplified check)
    -- In practice, you'd want a more sophisticated cycle detection
    IF EXISTS (
      SELECT 1 FROM get_child_items(child_id) WHERE id = parent_item_id
    ) THEN
      invalid_links := invalid_links || jsonb_build_object(
        'child_id', child_id,
        'reason', 'circular_dependency'
      );
      CONTINUE;
    END IF;

    -- Check if item exists
    IF NOT EXISTS (SELECT 1 FROM items WHERE id = child_id) THEN
      invalid_links := invalid_links || jsonb_build_object(
        'child_id', child_id,
        'reason', 'item_not_found'
      );
      CONTINUE;
    END IF;

    valid_links := valid_links || child_id;
  END LOOP;

  RETURN jsonb_build_object(
    'can_link', array_length(invalid_links, 1) IS NULL OR jsonb_array_length(invalid_links) = 0,
    'valid_links', array_to_json(valid_links),
    'invalid_links', invalid_links,
    'warnings', array_to_json(warnings)
  );
END;
$$ LANGUAGE plpgsql;

-- Update existing functions to handle enhanced format
CREATE OR REPLACE FUNCTION get_linked_items_info(source_item_id UUID)
RETURNS TABLE(
  id UUID,
  list_id UUID,
  content TEXT,
  is_completed BOOLEAN,
  list_title TEXT,
  list_type list_type
) AS $$
DECLARE
  source_links jsonb;
  all_links jsonb := '[]'::jsonb;
BEGIN
  -- Get source item links
  SELECT linked_items INTO source_links FROM items WHERE id = source_item_id;

  IF source_links IS NULL THEN
    RETURN;
  END IF;

  -- Handle both legacy array format and new object format
  IF jsonb_typeof(source_links) = 'array' THEN
    all_links := source_links;
  ELSE
    -- Combine all relationship types
    all_links := all_links || COALESCE(source_links->'children', '[]'::jsonb);
    all_links := all_links || COALESCE(source_links->'parents', '[]'::jsonb);
    all_links := all_links || COALESCE(source_links->'bidirectional', '[]'::jsonb);
  END IF;

  RETURN QUERY
  SELECT
    li.id,
    li.list_id,
    li.content,
    li.is_completed,
    l.title as list_title,
    l.type as list_type
  FROM jsonb_array_elements_text(all_links) AS linked_id
  JOIN items li ON li.id = linked_id::uuid
  JOIN lists l ON li.list_id = l.id
  ORDER BY l.title, li.position;
END;
$$ LANGUAGE plpgsql;

-- Add comments for new functions
COMMENT ON FUNCTION create_parent_child_link(UUID, UUID[]) IS 'Create hierarchical parent-child relationships';
COMMENT ON FUNCTION remove_parent_child_link(UUID, UUID) IS 'Remove hierarchical parent-child relationship';
COMMENT ON FUNCTION validate_link_creation(UUID, UUID[]) IS 'Validate link creation and check for cycles';
COMMENT ON FUNCTION get_child_items(UUID) IS 'Get items controlled by a parent item';
COMMENT ON FUNCTION get_parent_items(UUID) IS 'Get items that control a child item';