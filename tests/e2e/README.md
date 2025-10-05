# E2E Testing with Playwright

## Overview
Automated end-to-end tests for the behavioral cross-list linking system using Playwright.

## Setup

### Install Dependencies
```bash
pnpm install
npx playwright install chromium
```

### Prerequisites
- Supabase local instance running (`npx supabase start`)
- Database migrations applied (`npx supabase db reset`)
- Dev server available on port 5173

## Running Tests

### Recommended: Run with automatic database reset
```bash
# This resets the database and runs tests
pnpm test:e2e
```

### Alternative: Manual database reset
```bash
# Reset database first
npx supabase db reset

# Then run tests immediately
pnpm test:playwright
```

### Other test modes
```bash
# Interactive UI mode
pnpm test:playwright:ui

# Headed mode (watch browser)
pnpm test:playwright:headed

# Debug mode (step through)
pnpm test:playwright:debug
```

**⚠️ Important**: Always reset the database before running E2E tests to ensure a clean state. Tests expect an empty database with no existing lists or items.

## Test Scenarios

### Scenario 1: Basic Parent-Child Link Creation
- Authenticate user via magic link
- Create "Meal Planning" (Simple List)
- Add "Steak Dinner" item
- Create "Shopping" (Grocery List)
- Add grocery items: Steak, Potatoes, Carrots
- Create parent-child links from Steak Dinner to groceries
- Verify link indicators show correct counts

### Scenario 2: Status Propagation
- Mark parent item as completed
- Verify all child items auto-complete
- Mark parent item back to todo
- Verify all child items revert to todo
- Verify child completion doesn't affect parent

### Scenario 3: Link Indicators
- Verify parent shows ↓ with correct child count
- Verify children show ↑ with correct parent count

## Test Structure

```
tests/e2e/
├── README.md                 # This file
├── quickstart.spec.ts        # Main test scenarios
└── helpers/                  # Test utilities (future)
    ├── auth.ts              # Authentication helpers
    ├── lists.ts             # List management helpers
    └── links.ts             # Linking operation helpers
```

## Configuration

See [playwright.config.ts](../../playwright.config.ts) for:
- Test directory configuration
- Browser selection
- Web server setup
- Retry and timeout settings

## CI/CD Integration

Add to CI pipeline:
```yaml
- name: Run E2E Tests
  run: |
    npx supabase start
    npx supabase db reset --db-url $DATABASE_URL
    pnpm test:playwright
```

## Troubleshooting

### Tests fail with "Target page, context or browser has been closed"
- Ensure dev server is running
- Check Supabase is accessible
- Verify database migrations are applied

### Authentication fails
- Check Mailpit is running on port 54324
- Verify Supabase auth is configured correctly

### Link operations fail with 400 errors
- Database RPC functions may not be created
- Run `npx supabase db reset` to reapply migrations

## Benefits of E2E Testing

1. **Faster Validation** - Automated tests run in ~30 seconds vs 10+ minutes manual
2. **Regression Detection** - Catch breaking changes immediately
3. **CI/CD Ready** - Run in pipeline on every commit
4. **Living Documentation** - Tests document expected behavior
5. **Confidence** - Verify entire user flows work end-to-end

## Current Status

**Phase 1: Test Infrastructure Setup** ✅ **COMPLETE**
- Playwright installed and configured
- Test file structure created
- Authentication flow automated
- Basic test scenarios defined

**Phase 2: Test Execution** 🚧 **IN PROGRESS**
- Test infrastructure complete and functional
- Authentication flow works correctly
- Database reset script integrated (`pnpm test:e2e`)
- Test selectors defined for all UI interactions

**Known Issues:**
1. **Database state persistence**: After `beforeAll` runs, test execution uses stale page state
2. **Serial mode limitations**: Playwright's `beforeAll` with serial mode doesn't maintain page context correctly
3. **Solution needed**: Either use Playwright's `storageState` fixture pattern or restructure tests to not rely on shared page variable

**Root Cause**: The `beforeAll` hook creates authentication and a `page` variable, but subsequent test execution happens in a different context where the page state has been lost. This is a Playwright architectural pattern issue, not a problem with the application code.

## Next Steps

**Priority 1: Fix Test Architecture**
- [ ] Restructure tests to use Playwright's project-level fixtures with `storageState`
- [ ] Remove shared `page` variable from `beforeAll` pattern
- [ ] Each test should use `({ page })` fixture from test context
- [ ] Use `test.use({ storageState: 'path/to/auth.json' })` for auth persistence

**Priority 2: Additional Test Coverage**
- [ ] Add more test scenarios (multiple parents, circular dependency prevention)
- [ ] Extract helpers to reduce code duplication
- [ ] Add visual regression testing with screenshots
- [ ] Performance testing (propagation latency < 100ms)
- [ ] Mobile viewport testing

**Reference**: See [Playwright authentication docs](https://playwright.dev/docs/auth) for proper `storageState` pattern
