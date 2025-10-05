-- Fix item_history foreign key to use ON DELETE CASCADE
-- This prevents FK violations when lists are deleted and triggers try to insert history

-- Drop the existing foreign key constraint
ALTER TABLE item_history
DROP CONSTRAINT IF EXISTS item_history_list_id_fkey;

-- Re-add the foreign key with ON DELETE CASCADE
ALTER TABLE item_history
ADD CONSTRAINT item_history_list_id_fkey
FOREIGN KEY (list_id)
REFERENCES lists(id)
ON DELETE CASCADE;

COMMENT ON CONSTRAINT item_history_list_id_fkey ON item_history IS 'Cascade delete history when list is deleted';
