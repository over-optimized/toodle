import { test, expect } from '@playwright/test'

/**
 * E2E Tests for Quickstart Validation Scenarios
 * Automates the manual testing from specs/002-enhance-the-existing/quickstart.md
 *
 * Note: Authentication is handled by global-setup.ts and uses storageState
 * Tests run in serial mode - each test builds on data from previous tests
 */

test.describe('Behavioral Cross-List Linking System', () => {
  test.describe.configure({ mode: 'serial' })

  // Helper function to delete all user's lists
  async function cleanupAllLists(browser: any, message: string) {
    console.log(message)

    const context = await browser.newContext({
      storageState: './tests/e2e/.auth/user.json',
    })
    const page = await context.newPage()
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Delete via API
    const result = await page.evaluate(async () => {
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
      const supabase = createClient(
        'http://127.0.0.1:54321',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
      )

      // Delete all lists for current user
      const { data: lists } = await supabase.from('lists').select('id')

      if (lists && lists.length > 0) {
        await Promise.all(
          lists.map(list => supabase.from('lists').delete().eq('id', list.id))
        )
        return lists.length
      }
      return 0
    })

    if (result > 0) {
      console.log(`   Deleted ${result} lists`)
    } else {
      console.log(`   No lists to clean up`)
    }

    await context.close()
  }

  // Clean up before tests
  test.beforeAll(async ({ browser }) => {
    await cleanupAllLists(browser, '🧹 Cleaning up before tests...')
  })

  // Clean up after tests - THIS IS THE KEY!
  test.afterAll(async ({ browser }) => {
    await cleanupAllLists(browser, '🧹 Cleaning up after tests...')
  })

  test.describe('Scenario 1: Basic Parent-Child Link Creation', () => {
    test('should show empty list page after authentication', async ({ page }) => {
      // Navigate to home page with authenticated state
      await page.goto('/')

      // Should show the empty state
      await expect(page.getByText(/no lists yet/i)).toBeVisible()
      await expect(page.getByRole('button', { name: /create your first list/i })).toBeVisible()
    })

    test('should create Meal Planning list', async ({ page }) => {
      // Navigate to home to ensure we're on the lists page
      await page.goto('/')

      // Click create list button
      await page.getByRole('button', { name: /create your first list/i }).click()

      // Fill in list details
      await page.getByRole('textbox', { name: /list title/i }).fill('Meal Planning')

      // Simple List should be selected by default
      await expect(page.getByRole('radio', { name: /simple list/i })).toBeChecked()

      // Create the list
      await page.getByRole('button', { name: /create list/i }).click()

      // Verify we're on the list page
      await expect(page.getByRole('heading', { name: 'Meal Planning' })).toBeVisible()
    })

    test('should add Steak Dinner item', async ({ page }) => {
      // Navigate to the Meal Planning list (created in previous test)
      await page.goto('/')
      await page.getByRole('link', { name: /meal planning/i }).click()

      // Wait for list page to load
      await expect(page.getByRole('heading', { name: 'Meal Planning' })).toBeVisible()

      // Add item
      await page.getByRole('textbox', { name: /add a new item/i }).fill('Steak Dinner')
      await page.getByRole('button', { name: /add item/i }).click()

      // Verify item was added
      await expect(page.getByText('Steak Dinner')).toBeVisible()
    })

    test('should create Shopping (Grocery) list', async ({ page }) => {
      // Go back to lists
      await page.getByRole('link', { name: /back to lists/i }).click()

      // Create new list
      await page.getByRole('button', { name: /\+ new list/i }).click()

      await page.getByRole('textbox', { name: /list title/i }).fill('Shopping')

      // Select Grocery List type
      await page.getByRole('radio', { name: /grocery list/i }).click()

      await page.getByRole('button', { name: /create list/i }).click()

      // Verify we're on the grocery list page
      await expect(page.getByRole('heading', { name: 'Shopping' })).toBeVisible()
      await expect(page.getByText(/grocery/i)).toBeVisible()
    })

    test('should add grocery items', async ({ page }) => {
      // Navigate to Shopping list (created in previous test)
      await page.goto('/')
      await page.getByRole('link', { name: /shopping/i }).click()

      // Wait for list page to load
      await expect(page.getByRole('heading', { name: 'Shopping' })).toBeVisible()

      // Add Steak
      await page.getByRole('textbox', { name: /add groceries/i }).fill('Steak')
      await page.getByRole('button', { name: /add item/i }).click()
      await expect(page.getByText('Steak')).toBeVisible()

      // Add Potatoes
      await page.getByRole('textbox', { name: /add groceries/i }).fill('Potatoes')
      await page.getByRole('button', { name: /add item/i }).click()
      await expect(page.getByText('Potatoes')).toBeVisible()

      // Add Carrots
      await page.getByRole('textbox', { name: /add groceries/i }).fill('Carrots')
      await page.getByRole('button', { name: /add item/i }).click()
      await expect(page.getByText('Carrots')).toBeVisible()

      // Verify all items are present
      await expect(page.getByText('3 of 100 items')).toBeVisible()
    })

    test('should create parent-child links', async ({ page }) => {
      // Go back to Meal Planning list
      await page.getByRole('link', { name: /back to lists/i }).click()
      await page.getByRole('link', { name: /meal planning/i }).click()

      // Hover over Steak Dinner to reveal action buttons (desktop)
      const steakDinnerRow = page.locator('text=Steak Dinner').locator('..')
      await steakDinnerRow.hover()

      // Click the manage links button (⚙️)
      await steakDinnerRow.getByRole('button', { title: 'Manage links' }).click()

      // Modal should open
      await expect(page.getByRole('heading', { name: /manage links/i })).toBeVisible()

      // Click "Add Child Items" button
      await page.getByRole('button', { name: /add child/i }).click()

      // Select the grocery items from the Shopping list
      await page.getByRole('checkbox', { name: /steak/i }).check()
      await page.getByRole('checkbox', { name: /potatoes/i }).check()
      await page.getByRole('checkbox', { name: /carrots/i }).check()

      // Save links
      await page.getByRole('button', { name: /save/i }).click()

      // Wait for modal to close
      await expect(page.getByRole('heading', { name: /manage links/i })).not.toBeVisible()

      // Verify link indicator shows ↓ with count 3
      await expect(steakDinnerRow.getByText('↓')).toBeVisible()
      await expect(steakDinnerRow.getByText('3')).toBeVisible()
    })
  })

  test.describe('Scenario 2: Status Propagation', () => {
    test('should propagate status from parent to children', async ({ page }) => {
      // Navigate to Meal Planning list
      await page.goto('/')
      await page.getByRole('link', { name: /meal planning/i }).click()

      // Mark Steak Dinner as completed
      const steakDinnerCheckbox = page.locator('text=Steak Dinner').locator('..').getByRole('checkbox')
      await steakDinnerCheckbox.check()

      // Navigate to Shopping list
      await page.getByRole('link', { name: /back to lists/i }).click()
      await page.getByRole('link', { name: /shopping/i }).click()

      // Verify all children are completed
      await expect(page.locator('text=Steak').locator('..').getByRole('checkbox')).toBeChecked()
      await expect(page.locator('text=Potatoes').locator('..').getByRole('checkbox')).toBeChecked()
      await expect(page.locator('text=Carrots').locator('..').getByRole('checkbox')).toBeChecked()
    })

    test('should propagate status when parent moves back to todo', async ({ page }) => {
      // Navigate to Meal Planning
      await page.goto('/')
      await page.getByRole('link', { name: /meal planning/i }).click()

      // Uncheck Steak Dinner
      const steakDinnerCheckbox = page.locator('text=Steak Dinner').locator('..').getByRole('checkbox')
      await steakDinnerCheckbox.uncheck()

      // Navigate to Shopping list
      await page.getByRole('link', { name: /back to lists/i }).click()
      await page.getByRole('link', { name: /shopping/i }).click()

      // Verify children are back to todo (unchecked)
      await expect(page.locator('text=Steak').locator('..').getByRole('checkbox')).not.toBeChecked()
      await expect(page.locator('text=Potatoes').locator('..').getByRole('checkbox')).not.toBeChecked()
      await expect(page.locator('text=Carrots').locator('..').getByRole('checkbox')).not.toBeChecked()
    })

    test('should not propagate from child to parent', async ({ page }) => {
      // Mark Steak as completed
      await page.locator('text=Steak').locator('..').getByRole('checkbox').check()

      // Navigate to Meal Planning
      await page.getByRole('link', { name: /back to lists/i }).click()
      await page.getByRole('link', { name: /meal planning/i }).click()

      // Verify parent is still unchecked
      await expect(page.locator('text=Steak Dinner').locator('..').getByRole('checkbox')).not.toBeChecked()
    })
  })

  test.describe('Scenario 3: Link Indicators', () => {
    test('should show correct link indicators', async ({ page }) => {
      // Navigate to Shopping list
      await page.goto('/')
      await page.getByRole('link', { name: /shopping/i }).click()

      // Each grocery item should show ↑ indicator (has parent)
      const steakRow = page.locator('text=Steak').locator('..')
      const potatoesRow = page.locator('text=Potatoes').locator('..')
      const carrotsRow = page.locator('text=Carrots').locator('..')

      await expect(steakRow.getByText('↑')).toBeVisible()
      await expect(potatoesRow.getByText('↑')).toBeVisible()
      await expect(carrotsRow.getByText('↑')).toBeVisible()

      // Navigate to Meal Planning
      await page.getByRole('link', { name: /back to lists/i }).click()
      await page.getByRole('link', { name: /meal planning/i }).click()

      // Steak Dinner should show ↓ indicator with count 3
      const steakDinnerRow = page.locator('text=Steak Dinner').locator('..')
      await expect(steakDinnerRow.getByText('↓')).toBeVisible()
      await expect(steakDinnerRow.getByText('3')).toBeVisible()
    })
  })
})
