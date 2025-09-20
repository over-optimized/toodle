-- Temporary migration to disable RLS for debugging
-- This will help isolate the infinite recursion issue

-- Disable RLS on lists table temporarily
ALTER TABLE lists DISABLE ROW LEVEL SECURITY;

-- Keep other tables enabled for now
-- ALTER TABLE items DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE shares DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE item_history DISABLE ROW LEVEL SECURITY;