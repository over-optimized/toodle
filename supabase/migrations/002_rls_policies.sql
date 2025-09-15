-- Row Level Security Policies for Toodle List Management PWA
-- These policies ensure users can only access data they own or have been explicitly shared

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_history ENABLE ROW LEVEL SECURITY;

-- Users table policies
-- Users can only see and modify their own user record
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Lists table policies
-- Users can see their own lists
CREATE POLICY "Users can view own lists" ON lists
  FOR SELECT USING (user_id = auth.uid());

-- Users can see lists shared with them (non-expired shares)
CREATE POLICY "Users can view shared lists" ON lists
  FOR SELECT USING (
    id IN (
      SELECT list_id FROM shares
      WHERE shared_with_email = auth.email()
      AND expires_at > NOW()
    )
  );

-- Only owners can create, update, delete their lists
CREATE POLICY "Users can manage own lists" ON lists
  FOR ALL USING (user_id = auth.uid());

-- Items table policies
-- Users can see items in lists they have access to
CREATE POLICY "Users can view accessible items" ON items
  FOR SELECT USING (
    list_id IN (
      -- Own lists
      SELECT id FROM lists WHERE user_id = auth.uid()
      UNION
      -- Shared lists (any role, non-expired)
      SELECT list_id FROM shares
      WHERE shared_with_email = auth.email()
      AND expires_at > NOW()
    )
  );

-- Users can modify items in their own lists
CREATE POLICY "Users can manage items in own lists" ON items
  FOR ALL USING (
    list_id IN (SELECT id FROM lists WHERE user_id = auth.uid())
  );

-- Users can modify items in edit-shared lists only
CREATE POLICY "Users can edit items in edit-shared lists" ON items
  FOR INSERT, UPDATE, DELETE USING (
    list_id IN (
      SELECT list_id FROM shares
      WHERE shared_with_email = auth.email()
      AND role = 'edit'
      AND expires_at > NOW()
    )
  );

-- Shares table policies
-- Users can see shares for their own lists
CREATE POLICY "Users can view shares for own lists" ON shares
  FOR SELECT USING (
    list_id IN (SELECT id FROM lists WHERE user_id = auth.uid())
  );

-- Users can see shares where they are the recipient
CREATE POLICY "Users can view shares made to them" ON shares
  FOR SELECT USING (shared_with_email = auth.email());

-- Only list owners can create/manage shares
CREATE POLICY "Users can manage shares for own lists" ON shares
  FOR ALL USING (
    list_id IN (SELECT id FROM lists WHERE user_id = auth.uid())
  );

-- Item history table policies
-- Users can see item history for lists they have access to
CREATE POLICY "Users can view accessible item history" ON item_history
  FOR SELECT USING (
    list_id IN (
      -- Own lists
      SELECT id FROM lists WHERE user_id = auth.uid()
      UNION
      -- Shared lists (any role, non-expired)
      SELECT list_id FROM shares
      WHERE shared_with_email = auth.email()
      AND expires_at > NOW()
    )
  );

-- Only system triggers can modify item history
-- Users cannot directly insert/update/delete item history
-- This is managed automatically by database triggers

-- Comments for documentation
COMMENT ON POLICY "Users can view own lists" ON lists IS 'Users can only see lists they created';
COMMENT ON POLICY "Users can view shared lists" ON lists IS 'Users can see lists shared with them via non-expired shares';
COMMENT ON POLICY "Users can edit items in edit-shared lists" ON items IS 'Edit permission only for edit role shares';
COMMENT ON POLICY "Users can manage shares for own lists" ON shares IS 'Only list owners can create/modify shares';