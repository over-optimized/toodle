-- Database Triggers and Functions for Toodle List Management PWA
-- These ensure data consistency, enforce limits, and maintain history

-- Function to update timestamp columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Triggers for timestamp updates
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lists_updated_at
  BEFORE UPDATE ON lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_items_updated_at
  BEFORE UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to enforce user list limit (10 lists maximum)
CREATE OR REPLACE FUNCTION check_user_list_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM lists WHERE user_id = NEW.user_id) >= 10 THEN
    RAISE EXCEPTION 'User cannot have more than 10 lists. Current limit: 10 lists per user.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Trigger to enforce list limit
CREATE TRIGGER enforce_list_limit
  BEFORE INSERT ON lists
  FOR EACH ROW EXECUTE FUNCTION check_user_list_limit();

-- Function to enforce list item limit (100 items maximum per list)
CREATE OR REPLACE FUNCTION check_list_item_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM items WHERE list_id = NEW.list_id) >= 100 THEN
    RAISE EXCEPTION 'List cannot have more than 100 items. Current limit: 100 items per list.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Trigger to enforce item limit
CREATE TRIGGER enforce_item_limit
  BEFORE INSERT ON items
  FOR EACH ROW EXECUTE FUNCTION check_list_item_limit();

-- Function to automatically set share expiration (24 hours max)
CREATE OR REPLACE FUNCTION set_share_expiration()
RETURNS TRIGGER AS $$
BEGIN
  -- If expires_at is not set or is beyond 24 hours, set it to 24 hours from now
  IF NEW.expires_at IS NULL OR NEW.expires_at > (NEW.created_at + INTERVAL '24 hours') THEN
    NEW.expires_at = NEW.created_at + INTERVAL '24 hours';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Trigger to enforce share expiration
CREATE TRIGGER set_share_expiration_trigger
  BEFORE INSERT OR UPDATE ON shares
  FOR EACH ROW EXECUTE FUNCTION set_share_expiration();

-- Function to update item history when items are completed or deleted
CREATE OR REPLACE FUNCTION update_item_history()
RETURNS TRIGGER AS $$
DECLARE
  normalized_content TEXT;
BEGIN
  -- Normalize content for history tracking (lowercase, trimmed)
  normalized_content := LOWER(TRIM(COALESCE(NEW.content, OLD.content)));

  -- Track when items are completed (for future predictive features)
  IF TG_OP = 'UPDATE' AND OLD.is_completed = false AND NEW.is_completed = true THEN
    INSERT INTO item_history (list_id, content, frequency_count, last_used_at)
    VALUES (NEW.list_id, normalized_content, 1, NOW())
    ON CONFLICT (list_id, content)
    DO UPDATE SET
      frequency_count = item_history.frequency_count + 1,
      last_used_at = NOW();
  END IF;

  -- Also track when items are deleted (could indicate completion)
  IF TG_OP = 'DELETE' THEN
    INSERT INTO item_history (list_id, content, frequency_count, last_used_at)
    VALUES (OLD.list_id, normalized_content, 1, NOW())
    ON CONFLICT (list_id, content)
    DO UPDATE SET
      frequency_count = item_history.frequency_count + 1,
      last_used_at = NOW();
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE 'plpgsql';

-- Triggers for item history tracking
CREATE TRIGGER track_item_completion
  AFTER UPDATE OF is_completed ON items
  FOR EACH ROW EXECUTE FUNCTION update_item_history();

CREATE TRIGGER track_item_deletion
  AFTER DELETE ON items
  FOR EACH ROW EXECUTE FUNCTION update_item_history();

-- Function to validate countdown list target dates
CREATE OR REPLACE FUNCTION validate_countdown_target_date()
RETURNS TRIGGER AS $$
DECLARE
  list_type_val list_type;
BEGIN
  -- Get the list type
  SELECT type INTO list_type_val FROM lists WHERE id = NEW.list_id;

  -- If this is a countdown list, target_date should be set and in the future
  IF list_type_val = 'countdown' THEN
    IF NEW.target_date IS NULL THEN
      RAISE EXCEPTION 'Countdown list items must have a target_date set';
    END IF;
    IF NEW.target_date <= NOW() THEN
      RAISE EXCEPTION 'Countdown list target_date must be in the future';
    END IF;
  ELSE
    -- For non-countdown lists, target_date should be NULL
    IF NEW.target_date IS NOT NULL THEN
      RAISE EXCEPTION 'Only countdown list items can have a target_date';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Trigger to validate countdown target dates
CREATE TRIGGER validate_countdown_dates
  BEFORE INSERT OR UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION validate_countdown_target_date();

-- Function to clean up expired shares (called by cron job or manually)
CREATE OR REPLACE FUNCTION cleanup_expired_shares()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM shares WHERE expires_at <= NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE 'plpgsql';

-- Comments for documentation
COMMENT ON FUNCTION update_updated_at_column() IS 'Automatically updates updated_at timestamp on row modifications';
COMMENT ON FUNCTION check_user_list_limit() IS 'Enforces maximum of 10 lists per user';
COMMENT ON FUNCTION check_list_item_limit() IS 'Enforces maximum of 100 items per list';
COMMENT ON FUNCTION update_item_history() IS 'Tracks completed/deleted items for predictive features';
COMMENT ON FUNCTION validate_countdown_target_date() IS 'Ensures target_date is only set for countdown lists and is in future';
COMMENT ON FUNCTION cleanup_expired_shares() IS 'Removes expired shares, returns count of deleted records';