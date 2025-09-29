-- Additional helper functions for enhanced linking system
-- Utility functions for testing, debugging, and advanced operations

-- Helper: Get complete link statistics for an item
CREATE OR REPLACE FUNCTION get_item_link_stats(item_id UUID)
RETURNS jsonb AS $$
DECLARE
  item_links jsonb;
  result jsonb;
BEGIN
  SELECT linked_items INTO item_links FROM items WHERE id = item_id;

  IF item_links IS NULL THEN
    item_links := '{}'::jsonb;
  END IF;

  -- Handle both legacy array format and new object format
  IF jsonb_typeof(item_links) = 'array' THEN
    result := jsonb_build_object(
      'legacy_format', true,
      'total_links', jsonb_array_length(item_links),
      'children_count', 0,
      'parents_count', 0,
      'bidirectional_count', jsonb_array_length(item_links)
    );
  ELSE
    result := jsonb_build_object(
      'legacy_format', false,
      'children_count', COALESCE(jsonb_array_length(item_links->'children'), 0),
      'parents_count', COALESCE(jsonb_array_length(item_links->'parents'), 0),
      'bidirectional_count', COALESCE(jsonb_array_length(item_links->'bidirectional'), 0),
      'total_links',
        COALESCE(jsonb_array_length(item_links->'children'), 0) +
        COALESCE(jsonb_array_length(item_links->'parents'), 0) +
        COALESCE(jsonb_array_length(item_links->'bidirectional'), 0)
    );
  END IF;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Helper: Check if a link exists between two items
CREATE OR REPLACE FUNCTION check_link_exists(
  parent_id UUID,
  child_id UUID
)
RETURNS jsonb AS $$
DECLARE
  parent_links jsonb;
  child_links jsonb;
  parent_has_child BOOLEAN := false;
  child_has_parent BOOLEAN := false;
BEGIN
  -- Get parent item links
  SELECT linked_items INTO parent_links FROM items WHERE id = parent_id;

  -- Get child item links
  SELECT linked_items INTO child_links FROM items WHERE id = child_id;

  -- Check if parent has child in children array
  IF parent_links IS NOT NULL AND jsonb_typeof(parent_links) = 'object' THEN
    IF parent_links->'children' ? child_id::text THEN
      parent_has_child := true;
    END IF;
  END IF;

  -- Check if child has parent in parents array
  IF child_links IS NOT NULL AND jsonb_typeof(child_links) = 'object' THEN
    IF child_links->'parents' ? parent_id::text THEN
      child_has_parent := true;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'link_exists', parent_has_child AND child_has_parent,
    'parent_has_child', parent_has_child,
    'child_has_parent', child_has_parent,
    'is_consistent', parent_has_child = child_has_parent
  );
END;
$$ LANGUAGE plpgsql;

-- Helper: Get all items with inconsistent links (debugging)
CREATE OR REPLACE FUNCTION find_inconsistent_links()
RETURNS TABLE(
  item_id UUID,
  issue_type TEXT,
  details jsonb
) AS $$
BEGIN
  -- Find items where children don't reference back
  RETURN QUERY
  SELECT
    i.id as item_id,
    'orphaned_child_reference'::TEXT as issue_type,
    jsonb_build_object(
      'child_id', child_id,
      'child_missing_parent_ref', true
    ) as details
  FROM items i
  CROSS JOIN LATERAL jsonb_array_elements_text(
    CASE
      WHEN jsonb_typeof(i.linked_items) = 'object'
      THEN COALESCE(i.linked_items->'children', '[]'::jsonb)
      ELSE '[]'::jsonb
    END
  ) AS child_id
  WHERE NOT EXISTS (
    SELECT 1 FROM items c
    WHERE c.id = child_id::uuid
      AND jsonb_typeof(c.linked_items) = 'object'
      AND c.linked_items->'parents' ? i.id::text
  );

  -- Find items where parents don't reference back
  RETURN QUERY
  SELECT
    i.id as item_id,
    'orphaned_parent_reference'::TEXT as issue_type,
    jsonb_build_object(
      'parent_id', parent_id,
      'parent_missing_child_ref', true
    ) as details
  FROM items i
  CROSS JOIN LATERAL jsonb_array_elements_text(
    CASE
      WHEN jsonb_typeof(i.linked_items) = 'object'
      THEN COALESCE(i.linked_items->'parents', '[]'::jsonb)
      ELSE '[]'::jsonb
    END
  ) AS parent_id
  WHERE NOT EXISTS (
    SELECT 1 FROM items p
    WHERE p.id = parent_id::uuid
      AND jsonb_typeof(p.linked_items) = 'object'
      AND p.linked_items->'children' ? i.id::text
  );
END;
$$ LANGUAGE plpgsql;

-- Helper: Get link hierarchy tree (recursive)
CREATE OR REPLACE FUNCTION get_link_hierarchy(
  root_item_id UUID,
  max_depth INTEGER DEFAULT 5
)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
BEGIN
  WITH RECURSIVE link_tree AS (
    -- Base case: root item
    SELECT
      id,
      content,
      is_completed,
      linked_items,
      0 as depth,
      ARRAY[id] as path
    FROM items
    WHERE id = root_item_id

    UNION ALL

    -- Recursive case: children
    SELECT
      i.id,
      i.content,
      i.is_completed,
      i.linked_items,
      lt.depth + 1,
      lt.path || i.id
    FROM items i
    JOIN link_tree lt ON true
    CROSS JOIN LATERAL jsonb_array_elements_text(
      CASE
        WHEN jsonb_typeof(lt.linked_items) = 'object'
        THEN COALESCE(lt.linked_items->'children', '[]'::jsonb)
        ELSE '[]'::jsonb
      END
    ) AS child_id
    WHERE i.id = child_id::uuid
      AND lt.depth < max_depth
      AND NOT i.id = ANY(lt.path) -- Prevent cycles
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'content', content,
      'is_completed', is_completed,
      'depth', depth,
      'path_length', array_length(path, 1)
    ) ORDER BY depth, content
  )
  INTO result
  FROM link_tree;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql;

-- Helper: Bulk remove all links for an item (cleanup utility)
CREATE OR REPLACE FUNCTION remove_all_links(item_id UUID)
RETURNS jsonb AS $$
DECLARE
  item_links jsonb;
  child_id TEXT;
  parent_id TEXT;
  removed_count INTEGER := 0;
BEGIN
  SELECT linked_items INTO item_links FROM items WHERE id = item_id;

  IF item_links IS NULL OR jsonb_typeof(item_links) != 'object' THEN
    RETURN jsonb_build_object(
      'success', true,
      'removed_count', 0,
      'message', 'No links to remove'
    );
  END IF;

  -- Remove from all children's parent arrays
  FOR child_id IN
    SELECT jsonb_array_elements_text(COALESCE(item_links->'children', '[]'::jsonb))
  LOOP
    UPDATE items
    SET linked_items = jsonb_set(
      COALESCE(linked_items, '{}'::jsonb),
      '{parents}',
      (
        SELECT jsonb_agg(elem)
        FROM jsonb_array_elements(COALESCE(linked_items->'parents', '[]'::jsonb)) elem
        WHERE elem::text != concat('"', item_id::text, '"')
      )
    )
    WHERE id = child_id::uuid;
    removed_count := removed_count + 1;
  END LOOP;

  -- Remove from all parents' children arrays
  FOR parent_id IN
    SELECT jsonb_array_elements_text(COALESCE(item_links->'parents', '[]'::jsonb))
  LOOP
    UPDATE items
    SET linked_items = jsonb_set(
      COALESCE(linked_items, '{}'::jsonb),
      '{children}',
      (
        SELECT jsonb_agg(elem)
        FROM jsonb_array_elements(COALESCE(linked_items->'children', '[]'::jsonb)) elem
        WHERE elem::text != concat('"', item_id::text, '"')
      )
    )
    WHERE id = parent_id::uuid;
    removed_count := removed_count + 1;
  END LOOP;

  -- Clear the item's own links
  UPDATE items
  SET linked_items = '{}'::jsonb
  WHERE id = item_id;

  RETURN jsonb_build_object(
    'success', true,
    'removed_count', removed_count
  );
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON FUNCTION get_item_link_stats(UUID) IS 'Get comprehensive link statistics for an item';
COMMENT ON FUNCTION check_link_exists(UUID, UUID) IS 'Check if parent-child link exists and is consistent';
COMMENT ON FUNCTION find_inconsistent_links() IS 'Find all items with broken or inconsistent link references';
COMMENT ON FUNCTION get_link_hierarchy(UUID, INTEGER) IS 'Get recursive hierarchy tree starting from root item';
COMMENT ON FUNCTION remove_all_links(UUID) IS 'Remove all links for an item (cleanup utility)';