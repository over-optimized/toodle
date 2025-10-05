-- Fix item_history RLS to allow inserts during cascading deletes
-- The issue: when a list is deleted, items cascade delete and trigger tries to INSERT item_history
-- But the list might already be deleted, so the INSERT policy fails

-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "Allow trigger inserts to item_history" ON item_history;

-- Create a new INSERT policy that doesn't require the list to exist
-- This allows triggers to insert history even during cascading deletes
CREATE POLICY "Allow trigger inserts to item_history" ON item_history
  FOR INSERT
  WITH CHECK (true);  -- Allow all inserts (trigger is trusted)

COMMENT ON POLICY "Allow trigger inserts to item_history" ON item_history IS 'Database triggers can insert item history records (trusted code path)';
