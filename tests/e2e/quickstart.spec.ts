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

  // Helper function to delete all user's lists via API
  async function cleanupAllLists(_browser: any, message: string) {
    console.log(message)

    // Read auth token from storageState file
    const fs = await import('fs/promises')
    const path = await import('path')
    const authFile = await fs.readFile(path.join(process.cwd(), 'tests/e2e/.auth/user.json'), 'utf-8')
    const authState = JSON.parse(authFile)
    const localStorageData = authState.origins[0].localStorage
    const authTokenItem = localStorageData.find((item: any) => item.name === 'sb-localhost-auth-token')

    if (!authTokenItem) {
      console.log('   ❌ No auth token in storage state')
      return
    }

    const session = JSON.parse(authTokenItem.value)
    const accessToken = session.access_token

    if (!accessToken) {
      console.log('   ❌ No access token in session')
      return
    }

    const SUPABASE_URL = 'http://127.0.0.1:54321'
    const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

    // Fetch lists
    const listsResponse = await fetch(`${SUPABASE_URL}/rest/v1/lists`, {
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      }
    })

    if (!listsResponse.ok) {
      console.log(`   ❌ Failed to fetch lists: ${listsResponse.status}`)
      return
    }

    const lists = await listsResponse.json()

    if (!lists || lists.length === 0) {
      console.log('   ✅ No lists to clean up')
      return
    }

    // Delete each list
    const deleteResults = await Promise.all(
      lists.map(async (list: any) => {
        const deleteResponse = await fetch(`${SUPABASE_URL}/rest/v1/lists?id=eq.${list.id}`, {
          method: 'DELETE',
          headers: {
            'apikey': ANON_KEY,
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          }
        })

        if (!deleteResponse.ok) {
          const errorText = await deleteResponse.text()
          console.log(`   ❌ Failed to delete ${list.title}: ${deleteResponse.status} - ${errorText}`)
        }

        return deleteResponse.ok
      })
    )

    const successCount = deleteResults.filter(Boolean).length
    if (successCount > 0) {
      console.log(`   ✅ Deleted ${successCount} of ${lists.length} lists`)
    } else if (lists.length > 0) {
      console.log(`   ❌ Failed to delete all ${lists.length} lists`)
    }
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

      // Wait for network to settle after cleanup
      await page.waitForLoadState('networkidle')

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
      // Navigate to home (lists page)
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      // Create new list
      await page.getByRole('button', { name: /\+ new list/i }).click()

      await page.getByRole('textbox', { name: /list title/i }).fill('Shopping')

      // Select Grocery List type
      await page.getByRole('radio', { name: /grocery list/i }).click()

      await page.getByRole('button', { name: /create list/i }).click()

      // Verify we're on the grocery list page
      await expect(page.getByRole('heading', { name: 'Shopping' })).toBeVisible()
      // Verify it's a grocery list type (check for grocery-specific UI element)
      await expect(page.getByText(/add grocery item/i)).toBeVisible()
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

    test.skip('should create parent-child links', async ({ page }) => {
      // Navigate to home and open Meal Planning list
      await page.goto('/')
      await page.waitForLoadState('networkidle')
      await page.getByRole('link', { name: /meal planning/i }).click()

      // Find the Steak Dinner row
      const steakDinnerRow = page.locator('text=Steak Dinner').locator('..')

      // Click the link management button (🔗 icon - first button in action menu)
      const linkButton = steakDinnerRow.getByRole('button').first()
      await linkButton.click()

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
    test.skip('should propagate status from parent to children', async ({ page }) => {
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

    test.skip('should propagate status when parent moves back to todo', async ({ page }) => {
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

    test.skip('should not propagate from child to parent', async ({ page }) => {
      // Navigate to Shopping list
      await page.goto('/')
      await page.getByRole('link', { name: /shopping/i }).click()

      // Mark Steak as completed
      await page.locator('text=Steak').locator('..').getByRole('checkbox').check()

      // Navigate to Meal Planning
      await page.goto('/')
      await page.getByRole('link', { name: /meal planning/i }).click()

      // Verify parent is still unchecked
      await expect(page.locator('text=Steak Dinner').locator('..').getByRole('checkbox')).not.toBeChecked()
    })
  })

  test.describe('Scenario 3: Link Indicators', () => {
    test.skip('should show correct link indicators', async ({ page }) => {
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
