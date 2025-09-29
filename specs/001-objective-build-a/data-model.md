# Data Model: Mobile-First PWA List Management

## Core Entities

### User
**Purpose**: Authenticated users who own and manage lists
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```
**Validation Rules**:
- Email must be valid format
- Email must be unique across system
- Cannot be deleted if user owns lists

**Relationships**:
- One-to-many with Lists (owns)
- Many-to-many with Lists (via shares)

### List
**Purpose**: Container for items with specific type and sharing settings
```sql
CREATE TYPE list_type AS ENUM ('simple', 'grocery', 'countdown');

CREATE TABLE lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type list_type NOT NULL,
  title TEXT NOT NULL CHECK (length(title) > 0 AND length(title) <= 100),
  is_private BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```
**Validation Rules**:
- Title required, max 100 characters
- Type must be one of: simple, grocery, countdown
- User limited to 10 lists maximum
- Private by default

**Relationships**:
- Many-to-one with User (owner)
- One-to-many with Items
- One-to-many with Shares
- One-to-many with ItemHistory

### Item
**Purpose**: Individual entries within lists with completion and ordering
```sql
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (length(content) > 0 AND length(content) <= 500),
  is_completed BOOLEAN NOT NULL DEFAULT false,
  target_date TIMESTAMP WITH TIME ZONE, -- Only for countdown lists
  sort_order INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```
**Validation Rules**:
- Content required, max 500 characters
- List limited to 100 items maximum
- target_date only valid for countdown type lists
- sort_order maintains display order

**State Transitions**:
- Created → Completed (simple, grocery lists)
- Created → Expired (countdown lists past target_date)
- Completed → Created (can be unchecked)

**Relationships**:
- Many-to-one with List

### Share
**Purpose**: Sharing permissions between users and lists with expiration
```sql
CREATE TYPE share_role AS ENUM ('read', 'edit');

CREATE TABLE shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  shared_with_email TEXT NOT NULL,
  role share_role NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```
**Validation Rules**:
- expires_at must be 24 hours from creation
- shared_with_email must be valid email format
- Only list owner can create shares
- Role must be 'read' or 'edit'

**Relationships**:
- Many-to-one with List
- Many-to-one with User (created_by)

### ItemHistory
**Purpose**: Track past items for future predictive features
```sql
CREATE TABLE item_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  frequency_count INTEGER NOT NULL DEFAULT 1,
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```
**Validation Rules**:
- Content normalized for matching (lowercase, trimmed)
- frequency_count increments on repeated use
- Deleted when parent list is deleted

**Relationships**:
- Many-to-one with List

## Future Extensions

### Meal (Future)
**Purpose**: Meal definitions that can populate grocery lists
```sql
-- Future implementation
CREATE TABLE meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### MealIngredient (Future)
**Purpose**: Link meals to grocery items
```sql
-- Future implementation
CREATE TABLE meal_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id UUID NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  ingredient_name TEXT NOT NULL,
  quantity TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### MealLink (Future)
**Purpose**: Connect meal lists to grocery lists
```sql
-- Future implementation
CREATE TABLE meal_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  grocery_list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Row Level Security (RLS) Policies

### Lists
```sql
-- Users can only see their own lists or lists shared with them
CREATE POLICY "Users can view own lists" ON lists
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can view shared lists" ON lists
  FOR SELECT USING (
    id IN (
      SELECT list_id FROM shares
      WHERE shared_with_email = auth.email()
      AND expires_at > NOW()
    )
  );

-- Only owners can modify lists
CREATE POLICY "Users can modify own lists" ON lists
  FOR ALL USING (user_id = auth.uid());
```

### Items
```sql
-- Users can see items in lists they have access to
CREATE POLICY "Users can view accessible items" ON items
  FOR SELECT USING (
    list_id IN (
      SELECT id FROM lists WHERE user_id = auth.uid()
      UNION
      SELECT list_id FROM shares
      WHERE shared_with_email = auth.email()
      AND expires_at > NOW()
    )
  );

-- Edit permissions based on share role
CREATE POLICY "Users can modify items in owned lists" ON items
  FOR ALL USING (
    list_id IN (SELECT id FROM lists WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can modify items in edit-shared lists" ON items
  FOR UPDATE, INSERT, DELETE USING (
    list_id IN (
      SELECT list_id FROM shares
      WHERE shared_with_email = auth.email()
      AND role = 'edit'
      AND expires_at > NOW()
    )
  );
```

## Indexes for Performance

```sql
-- Primary access patterns
CREATE INDEX idx_lists_user_id ON lists(user_id);
CREATE INDEX idx_items_list_id ON items(list_id);
CREATE INDEX idx_items_sort_order ON items(list_id, sort_order);
CREATE INDEX idx_shares_list_id ON shares(list_id);
CREATE INDEX idx_shares_email ON shares(shared_with_email);
CREATE INDEX idx_shares_expires ON shares(expires_at);
CREATE INDEX idx_item_history_list_id ON item_history(list_id);

-- Cleanup queries
CREATE INDEX idx_shares_expired ON shares(expires_at) WHERE expires_at < NOW();
```

## Database Triggers

```sql
-- Update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

CREATE TRIGGER update_lists_updated_at BEFORE UPDATE ON lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enforce list limit per user (10 lists max)
CREATE OR REPLACE FUNCTION check_user_list_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM lists WHERE user_id = NEW.user_id) >= 10 THEN
    RAISE EXCEPTION 'User cannot have more than 10 lists';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

CREATE TRIGGER enforce_list_limit BEFORE INSERT ON lists
  FOR EACH ROW EXECUTE FUNCTION check_user_list_limit();

-- Enforce item limit per list (100 items max)
CREATE OR REPLACE FUNCTION check_list_item_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM items WHERE list_id = NEW.list_id) >= 100 THEN
    RAISE EXCEPTION 'List cannot have more than 100 items';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

CREATE TRIGGER enforce_item_limit BEFORE INSERT ON items
  FOR EACH ROW EXECUTE FUNCTION check_list_item_limit();

-- Update ItemHistory when items are modified
CREATE OR REPLACE FUNCTION update_item_history()
RETURNS TRIGGER AS $$
BEGIN
  -- Only track completed items for grocery/simple lists
  IF (OLD.is_completed = false AND NEW.is_completed = true) OR TG_OP = 'DELETE' THEN
    INSERT INTO item_history (list_id, content, frequency_count, last_used_at)
    VALUES (
      COALESCE(NEW.list_id, OLD.list_id),
      LOWER(TRIM(COALESCE(NEW.content, OLD.content))),
      1,
      NOW()
    )
    ON CONFLICT (list_id, content)
    DO UPDATE SET
      frequency_count = item_history.frequency_count + 1,
      last_used_at = NOW();
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE 'plpgsql';

CREATE TRIGGER track_item_history
  AFTER UPDATE OF is_completed ON items
  FOR EACH ROW EXECUTE FUNCTION update_item_history();

CREATE TRIGGER track_item_deletion
  AFTER DELETE ON items
  FOR EACH ROW EXECUTE FUNCTION update_item_history();
```

## Additional Constraints

```sql
-- Unique constraint for normalized item history
ALTER TABLE item_history ADD CONSTRAINT unique_list_content
  UNIQUE (list_id, content);

-- Check constraint for share expiration (must be within 24 hours)
ALTER TABLE shares ADD CONSTRAINT valid_expiration
  CHECK (expires_at <= created_at + INTERVAL '24 hours' AND expires_at > created_at);

-- Check constraint for target_date only on countdown lists
ALTER TABLE items ADD CONSTRAINT countdown_target_date
  CHECK (
    (target_date IS NULL) OR
    (target_date IS NOT NULL AND EXISTS (
      SELECT 1 FROM lists WHERE lists.id = items.list_id AND lists.type = 'countdown'
    ))
  );
```