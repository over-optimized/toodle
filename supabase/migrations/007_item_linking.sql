-- Add item linking functionality
-- This migration adds the ability to link items across different lists

-- Add linked_items column to items table
ALTER TABLE items
ADD COLUMN linked_items jsonb DEFAULT '[]'::jsonb;

-- Add index for linked_items queries
CREATE INDEX idx_items_linked_items ON items USING gin(linked_items);

-- Add constraint to ensure linked_items is always an array
ALTER TABLE items
ADD CONSTRAINT linked_items_is_array
CHECK (jsonb_typeof(linked_items) = 'array');

-- Add constraint to limit maximum number of linked items (prevent abuse)
ALTER TABLE items
ADD CONSTRAINT max_linked_items
CHECK (jsonb_array_length(linked_items) <= 50);

-- Function to validate that linked item IDs exist and belong to the same user
CREATE OR REPLACE FUNCTION validate_linked_items()
RETURNS TRIGGER AS $$
BEGIN
  -- Only validate if linked_items is not empty
  IF jsonb_array_length(NEW.linked_items) > 0 THEN
    -- Check that all linked items exist and belong to lists owned by the same user
    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(NEW.linked_items) AS linked_id
      WHERE NOT EXISTS (
        SELECT 1
        FROM items i2
        JOIN lists l2 ON i2.list_id = l2.id
        JOIN lists l1 ON l1.id = NEW.list_id
        WHERE i2.id::text = linked_id
        AND l2.user_id = l1.user_id
      )
    ) THEN
      RAISE EXCEPTION 'Invalid linked item: item does not exist or belongs to different user';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate linked items on insert and update
CREATE TRIGGER validate_linked_items_trigger
  BEFORE INSERT OR UPDATE ON items
  FOR EACH ROW
  EXECUTE FUNCTION validate_linked_items();

-- Add comments for documentation
COMMENT ON COLUMN items.linked_items IS 'Array of item UUIDs that this item links to across lists';
COMMENT ON INDEX idx_items_linked_items IS 'GIN index for efficient linked_items queries';
COMMENT ON FUNCTION validate_linked_items() IS 'Ensures linked items exist and belong to same user';

-- Create helper function to find items that link to a specific item (reverse lookup)
CREATE OR REPLACE FUNCTION get_items_linking_to(target_item_id UUID)
RETURNS TABLE(
  id UUID,
  list_id UUID,
  content TEXT,
  list_title TEXT,
  list_type list_type
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    i.list_id,
    i.content,
    l.title as list_title,
    l.type as list_type
  FROM items i
  JOIN lists l ON i.list_id = l.id
  WHERE i.linked_items ? target_item_id::text
  ORDER BY l.title, i.position;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_items_linking_to(UUID) IS 'Find all items that link to a specific item';

-- Create helper function to get linked items with their list info
CREATE OR REPLACE FUNCTION get_linked_items_info(source_item_id UUID)
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
    li.id,
    li.list_id,
    li.content,
    li.is_completed,
    l.title as list_title,
    l.type as list_type
  FROM items source_item
  CROSS JOIN LATERAL jsonb_array_elements_text(source_item.linked_items) AS linked_id
  JOIN items li ON li.id = linked_id::uuid
  JOIN lists l ON li.list_id = l.id
  WHERE source_item.id = source_item_id
  ORDER BY l.title, li.position;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_linked_items_info(UUID) IS 'Get detailed info for all items linked from a source item';