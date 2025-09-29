-- Enable RLS and add policies for item_history table
-- This table is populated by triggers when items are completed/deleted

-- Enable RLS on item_history
ALTER TABLE item_history ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own item history
CREATE POLICY "Users can read their own item history" ON item_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = item_history.list_id
      AND lists.user_id = auth.uid()
    )
  );

-- Allow triggers to insert item history (triggered by item completion/deletion)
-- This policy allows the database triggers to insert records
CREATE POLICY "Allow trigger inserts to item_history" ON item_history
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = item_history.list_id
      AND lists.user_id = auth.uid()
    )
  );

-- Allow triggers to update item history (for frequency counts)
CREATE POLICY "Allow trigger updates to item_history" ON item_history
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = item_history.list_id
      AND lists.user_id = auth.uid()
    )
  );

COMMENT ON POLICY "Users can read their own item history" ON item_history IS 'Users can read item history from their own lists';
COMMENT ON POLICY "Allow trigger inserts to item_history" ON item_history IS 'Database triggers can insert item history records';
COMMENT ON POLICY "Allow trigger updates to item_history" ON item_history IS 'Database triggers can update frequency counts';