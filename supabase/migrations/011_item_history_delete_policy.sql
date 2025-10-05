-- Add DELETE policy for item_history table
-- This is needed for cascading deletes when lists are removed

CREATE POLICY "Allow delete of item history for own lists" ON item_history
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = item_history.list_id
      AND lists.user_id = auth.uid()
    )
  );

COMMENT ON POLICY "Allow delete of item history for own lists" ON item_history IS 'Users can delete item history when deleting their own lists (cascading deletes)';
