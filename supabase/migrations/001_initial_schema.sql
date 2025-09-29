-- Initial Database Schema for Toodle List Management PWA
-- This migration creates the core tables and enums for the application

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE list_type AS ENUM ('simple', 'grocery', 'countdown');
CREATE TYPE share_role AS ENUM ('read', 'edit');

-- Users table (Supabase Auth integration)
-- Note: This extends Supabase's auth.users, storing additional app-specific data
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lists table
CREATE TABLE lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type list_type NOT NULL,
  title TEXT NOT NULL CHECK (length(title) > 0 AND length(title) <= 100),
  is_private BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Items table
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (length(content) > 0 AND length(content) <= 500),
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  target_date TIMESTAMP WITH TIME ZONE, -- Only for countdown lists
  position INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Shares table
CREATE TABLE shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  shared_with_email TEXT NOT NULL,
  role share_role NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Item history table for future predictive features
CREATE TABLE item_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  frequency_count INTEGER NOT NULL DEFAULT 1,
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance optimization
CREATE INDEX idx_lists_user_id ON lists(user_id);
CREATE INDEX idx_items_list_id ON items(list_id);
CREATE INDEX idx_items_position ON items(list_id, position);
CREATE INDEX idx_shares_list_id ON shares(list_id);
CREATE INDEX idx_shares_email ON shares(shared_with_email);
CREATE INDEX idx_shares_expires ON shares(expires_at);
CREATE INDEX idx_item_history_list_id ON item_history(list_id);

-- Additional constraints
ALTER TABLE item_history ADD CONSTRAINT unique_list_content
  UNIQUE (list_id, content);

ALTER TABLE shares ADD CONSTRAINT valid_expiration
  CHECK (expires_at <= created_at + INTERVAL '24 hours' AND expires_at > created_at);

-- Note: countdown_target_date constraint enforced at application level
-- CHECK constraints cannot use subqueries in PostgreSQL

-- Comments for documentation
COMMENT ON TABLE users IS 'App-specific user data extending Supabase auth';
COMMENT ON TABLE lists IS 'User lists with type-specific behavior';
COMMENT ON TABLE items IS 'List items with completion state and ordering';
COMMENT ON TABLE shares IS 'Time-limited list sharing with role-based permissions';
COMMENT ON TABLE item_history IS 'Historical item data for predictive features';
COMMENT ON COLUMN items.target_date IS 'Only used for countdown type lists';
COMMENT ON COLUMN shares.expires_at IS 'Must be within 24 hours of creation';