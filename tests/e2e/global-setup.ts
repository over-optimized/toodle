import { chromium, FullConfig, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const STORAGE_STATE_PATH = path.join(__dirname, '.auth/user.json')

async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use

  // Launch browser and create context
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  console.log('🔐 Authenticating test user...')

  // Navigate to login
  await page.goto(`${baseURL}/login`)

  // Fill in email and request magic link
  await page.getByRole('textbox', { name: /email/i }).fill('test@example.com')
  await page.getByRole('button', { name: /send magic link/i }).click()
  await expect(page.getByText(/check your email/i)).toBeVisible()

  // Get magic link from Mailpit
  const mailpitPage = await context.newPage()
  await mailpitPage.goto('http://localhost:54324')
  await mailpitPage.waitForSelector('text=Your Magic Link', { timeout: 10000 })
  await mailpitPage.click('text=Your Magic Link')

  // Extract login URL from email
  const iframe = mailpitPage.frameLocator('iframe')
  const loginLink = await iframe.locator('a').first().getAttribute('href')

  if (!loginLink) {
    throw new Error('Failed to extract magic link from email')
  }

  // Navigate to magic link to authenticate
  await page.goto(loginLink)
  await page.waitForURL(`${baseURL}/`)

  // Verify authentication succeeded
  await expect(page.getByRole('heading', { name: 'Your Lists' })).toBeVisible({ timeout: 10000 })

  console.log('✅ Authentication successful')

  // Save authenticated state
  await context.storageState({ path: STORAGE_STATE_PATH })

  await mailpitPage.close()
  await browser.close()

  console.log(`💾 Saved auth state to ${STORAGE_STATE_PATH}`)
}

export default globalSetup
