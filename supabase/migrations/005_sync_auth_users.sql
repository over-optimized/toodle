-- Sync auth.users with public.users table
-- This ensures every authenticated user has a corresponding record in public.users

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, created_at, updated_at)
  VALUES (NEW.id, NEW.email, NOW(), NOW())
  ON CONFLICT (id) DO UPDATE SET
    email = NEW.email,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE 'plpgsql' SECURITY DEFINER;

-- Trigger to automatically create public.users record when auth.users record is created
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Backfill existing auth.users into public.users
INSERT INTO public.users (id, email, created_at, updated_at)
SELECT
  id,
  email,
  COALESCE(created_at, NOW()),
  NOW()
FROM auth.users
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  updated_at = NOW();

COMMENT ON FUNCTION handle_new_user() IS 'Automatically syncs new auth.users to public.users table';