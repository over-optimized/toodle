-- Fix item history trigger to skip inserts when list is being deleted
-- When a list is deleted, we don't need to track item history since the whole list is going away

CREATE OR REPLACE FUNCTION update_item_history()
RETURNS TRIGGER AS $$
DECLARE
  normalized_content TEXT;
  list_exists BOOLEAN;
BEGIN
  -- Normalize content for history tracking (lowercase, trimmed)
  normalized_content := LOWER(TRIM(COALESCE(NEW.content, OLD.content)));

  -- For DELETE operations, check if the list still exists
  -- If the list is being deleted, skip history tracking (cascading delete)
  IF TG_OP = 'DELETE' THEN
    SELECT EXISTS(SELECT 1 FROM lists WHERE id = OLD.list_id) INTO list_exists;

    -- Only track history if the list still exists (item was individually deleted)
    -- Skip if list is gone (cascading delete scenario)
    IF list_exists THEN
      INSERT INTO item_history (list_id, content, frequency_count, last_used_at)
      VALUES (OLD.list_id, normalized_content, 1, NOW())
      ON CONFLICT (list_id, content)
      DO UPDATE SET
        frequency_count = item_history.frequency_count + 1,
        last_used_at = NOW();
    END IF;

    RETURN OLD;
  END IF;

  -- Track when items are completed (for future predictive features)
  IF TG_OP = 'UPDATE' AND OLD.is_completed = false AND NEW.is_completed = true THEN
    INSERT INTO item_history (list_id, content, frequency_count, last_used_at)
    VALUES (NEW.list_id, normalized_content, 1, NOW())
    ON CONFLICT (list_id, content)
    DO UPDATE SET
      frequency_count = item_history.frequency_count + 1,
      last_used_at = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

COMMENT ON FUNCTION update_item_history() IS 'Tracks completed/deleted items for predictive features. Skips tracking when list is deleted (cascade).';
