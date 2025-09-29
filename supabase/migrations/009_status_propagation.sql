-- Status propagation functions for parent-child behavioral linking
-- Handles automatic status updates when parent items change status

-- Function to propagate status from parent to children
-- Only triggers when parent moves from completed → todo
CREATE OR REPLACE FUNCTION propagate_status_to_children(
  parent_item_id UUID,
  new_status BOOLEAN
)
RETURNS jsonb AS $$
DECLARE
  child_record RECORD;
  propagated_updates jsonb := '[]'::jsonb;
  update_count INTEGER := 0;
BEGIN
  -- Only propagate when parent moves from completed to todo
  IF new_status = true THEN
    -- Parent is being completed, no propagation needed
    RETURN jsonb_build_object(
      'propagated_updates', propagated_updates,
      'update_count', 0
    );
  END IF;

  -- Parent is moving to todo status, propagate to completed children
  FOR child_record IN
    SELECT id, is_completed, content
    FROM get_child_items(parent_item_id)
    WHERE is_completed = true
  LOOP
    -- Update child to todo status
    UPDATE items
    SET is_completed = false,
        completed_at = NULL,
        updated_at = now()
    WHERE id = child_record.id;

    -- Record the propagated update
    propagated_updates := propagated_updates || jsonb_build_object(
      'item_id', child_record.id,
      'old_status', true,
      'new_status', false,
      'content', child_record.content
    );

    update_count := update_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'propagated_updates', propagated_updates,
    'update_count', update_count
  );
END;
$$ LANGUAGE plpgsql;

-- Enhanced item update function with status propagation
CREATE OR REPLACE FUNCTION update_item_with_propagation(
  item_id UUID,
  new_content TEXT DEFAULT NULL,
  new_is_completed BOOLEAN DEFAULT NULL,
  new_target_date DATE DEFAULT NULL,
  new_position NUMERIC DEFAULT NULL,
  new_linked_items jsonb DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  current_item RECORD;
  propagation_result jsonb;
  final_result jsonb;
BEGIN
  -- Get current item state
  SELECT * INTO current_item FROM items WHERE id = item_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Item not found'
    );
  END IF;

  -- Update the item
  UPDATE items
  SET
    content = COALESCE(new_content, content),
    is_completed = COALESCE(new_is_completed, is_completed),
    completed_at = CASE
      WHEN new_is_completed = true AND is_completed = false THEN now()
      WHEN new_is_completed = false AND is_completed = true THEN NULL
      ELSE completed_at
    END,
    target_date = COALESCE(new_target_date, target_date),
    position = COALESCE(new_position, position),
    linked_items = COALESCE(new_linked_items, linked_items),
    updated_at = now()
  WHERE id = item_id;

  -- Check if status propagation is needed
  IF new_is_completed IS NOT NULL AND current_item.is_completed != new_is_completed THEN
    -- Propagate status to children if item has children
    SELECT propagate_status_to_children(item_id, new_is_completed)
    INTO propagation_result;
  ELSE
    propagation_result := jsonb_build_object(
      'propagated_updates', '[]'::jsonb,
      'update_count', 0
    );
  END IF;

  -- Get updated item data
  SELECT to_jsonb(items.*) INTO final_result FROM items WHERE id = item_id;

  -- Combine item data with propagation results
  final_result := final_result || jsonb_build_object(
    'propagated_updates', propagation_result->'propagated_updates',
    'propagation_count', propagation_result->'update_count'
  );

  RETURN jsonb_build_object(
    'success', true,
    'data', final_result
  );
END;
$$ LANGUAGE plpgsql;

-- Trigger function to handle status propagation on item updates
CREATE OR REPLACE FUNCTION handle_item_status_change()
RETURNS TRIGGER AS $$
DECLARE
  propagation_result jsonb;
BEGIN
  -- Only trigger propagation if completion status actually changed
  IF OLD.is_completed != NEW.is_completed THEN
    -- Propagate to children if item has them
    SELECT propagate_status_to_children(NEW.id, NEW.is_completed)
    INTO propagation_result;

    -- Log propagation for debugging (optional)
    IF (propagation_result->>'update_count')::integer > 0 THEN
      RAISE NOTICE 'Status propagated from % to % children',
        NEW.id, (propagation_result->>'update_count')::integer;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic status propagation
-- Note: This trigger runs after the main update to avoid recursion issues
CREATE TRIGGER item_status_propagation_trigger
  AFTER UPDATE ON items
  FOR EACH ROW
  WHEN (OLD.is_completed IS DISTINCT FROM NEW.is_completed)
  EXECUTE FUNCTION handle_item_status_change();

-- Function to get status propagation preview (for UI feedback)
CREATE OR REPLACE FUNCTION preview_status_propagation(
  item_id UUID,
  new_status BOOLEAN
)
RETURNS jsonb AS $$
DECLARE
  affected_children jsonb := '[]'::jsonb;
  child_record RECORD;
BEGIN
  -- Only show preview when moving parent to todo
  IF new_status = true THEN
    RETURN jsonb_build_object(
      'will_propagate', false,
      'affected_children', affected_children,
      'message', 'No propagation when completing items'
    );
  END IF;

  -- Find completed children that would be affected
  FOR child_record IN
    SELECT id, content, list_title, list_type
    FROM get_child_items(item_id)
    WHERE is_completed = true
  LOOP
    affected_children := affected_children || jsonb_build_object(
      'id', child_record.id,
      'content', child_record.content,
      'list_title', child_record.list_title,
      'list_type', child_record.list_type
    );
  END LOOP;

  RETURN jsonb_build_object(
    'will_propagate', jsonb_array_length(affected_children) > 0,
    'affected_children', affected_children,
    'message', CASE
      WHEN jsonb_array_length(affected_children) = 0 THEN
        'No completed children to affect'
      WHEN jsonb_array_length(affected_children) = 1 THEN
        '1 completed child item will be moved to todo'
      ELSE
        jsonb_array_length(affected_children)::text || ' completed child items will be moved to todo'
    END
  );
END;
$$ LANGUAGE plpgsql;

-- Function to clean up orphaned parent/child references
CREATE OR REPLACE FUNCTION cleanup_orphaned_links()
RETURNS jsonb AS $$
DECLARE
  cleanup_count INTEGER := 0;
  item_record RECORD;
  cleaned_links jsonb;
  children_array jsonb;
  parents_array jsonb;
  bidirectional_array jsonb;
  valid_children jsonb := '[]'::jsonb;
  valid_parents jsonb := '[]'::jsonb;
  valid_bidirectional jsonb := '[]'::jsonb;
  link_id text;
BEGIN
  FOR item_record IN
    SELECT id, linked_items
    FROM items
    WHERE linked_items IS NOT NULL
      AND jsonb_typeof(linked_items) = 'object'
  LOOP
    children_array := COALESCE(item_record.linked_items->'children', '[]'::jsonb);
    parents_array := COALESCE(item_record.linked_items->'parents', '[]'::jsonb);
    bidirectional_array := COALESCE(item_record.linked_items->'bidirectional', '[]'::jsonb);

    -- Clean children array
    FOR i IN 0..jsonb_array_length(children_array)-1 LOOP
      link_id := children_array->>i;
      IF EXISTS (SELECT 1 FROM items WHERE id = link_id::uuid) THEN
        valid_children := valid_children || jsonb_build_array(link_id::uuid);
      END IF;
    END LOOP;

    -- Clean parents array
    FOR i IN 0..jsonb_array_length(parents_array)-1 LOOP
      link_id := parents_array->>i;
      IF EXISTS (SELECT 1 FROM items WHERE id = link_id::uuid) THEN
        valid_parents := valid_parents || jsonb_build_array(link_id::uuid);
      END IF;
    END LOOP;

    -- Clean bidirectional array
    FOR i IN 0..jsonb_array_length(bidirectional_array)-1 LOOP
      link_id := bidirectional_array->>i;
      IF EXISTS (SELECT 1 FROM items WHERE id = link_id::uuid) THEN
        valid_bidirectional := valid_bidirectional || jsonb_build_array(link_id::uuid);
      END IF;
    END LOOP;

    -- Rebuild cleaned links object
    cleaned_links := jsonb_build_object();
    IF jsonb_array_length(valid_children) > 0 THEN
      cleaned_links := jsonb_set(cleaned_links, '{children}', valid_children);
    END IF;
    IF jsonb_array_length(valid_parents) > 0 THEN
      cleaned_links := jsonb_set(cleaned_links, '{parents}', valid_parents);
    END IF;
    IF jsonb_array_length(valid_bidirectional) > 0 THEN
      cleaned_links := jsonb_set(cleaned_links, '{bidirectional}', valid_bidirectional);
    END IF;

    -- Update if changes were made
    IF cleaned_links != item_record.linked_items THEN
      UPDATE items
      SET linked_items = CASE
        WHEN cleaned_links = '{}'::jsonb THEN NULL
        ELSE cleaned_links
      END
      WHERE id = item_record.id;

      cleanup_count := cleanup_count + 1;
    END IF;

    -- Reset arrays for next iteration
    valid_children := '[]'::jsonb;
    valid_parents := '[]'::jsonb;
    valid_bidirectional := '[]'::jsonb;
  END LOOP;

  RETURN jsonb_build_object(
    'items_cleaned', cleanup_count,
    'message', cleanup_count::text || ' items had their links cleaned'
  );
END;
$$ LANGUAGE plpgsql;

-- Add comments
COMMENT ON FUNCTION propagate_status_to_children(UUID, BOOLEAN) IS 'Propagate status changes from parent to completed children';
COMMENT ON FUNCTION update_item_with_propagation(UUID, TEXT, BOOLEAN, DATE, NUMERIC, jsonb) IS 'Update item with automatic status propagation';
COMMENT ON FUNCTION handle_item_status_change() IS 'Trigger function for automatic status propagation';
COMMENT ON FUNCTION preview_status_propagation(UUID, BOOLEAN) IS 'Preview which children would be affected by status change';
COMMENT ON FUNCTION cleanup_orphaned_links() IS 'Clean up references to deleted items from linked_items arrays';