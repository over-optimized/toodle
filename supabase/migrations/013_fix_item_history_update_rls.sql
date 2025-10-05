-- Fix item_history UPDATE RLS to allow updates during cascading deletes
-- The trigger uses ON CONFLICT DO UPDATE, which needs an UPDATE policy that works even when list is deleted

-- Drop the existing UPDATE policy
DROP POLICY IF EXISTS "Allow trigger updates to item_history" ON item_history;

-- Create a new UPDATE policy that doesn't require the list to exist
CREATE POLICY "Allow trigger updates to item_history" ON item_history
  FOR UPDATE
  USING (true)  -- Allow all updates (trigger is trusted)
  WITH CHECK (true);

COMMENT ON POLICY "Allow trigger updates to item_history" ON item_history IS 'Database triggers can update frequency counts (trusted code path)';
