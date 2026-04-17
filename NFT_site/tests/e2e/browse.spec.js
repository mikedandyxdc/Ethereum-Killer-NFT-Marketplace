import { test, expect } from '@playwright/test'

const DEPLOYER_ADDR = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'

test.describe('Browse Page', () => {
  test('loads collection and shows NFT grid', async ({ page }) => {
    await page.goto('/browse')
    await page.waitForSelector('a[href^="/token/"]', { timeout: 30000 })
    const cards = page.locator('a[href^="/token/"]')
    const count = await cards.count()
    expect(count).toBeGreaterThan(0)
    expect(count).toBeLessThanOrEqual(24)
  })

  test('tabs filter correctly', async ({ page }) => {
    await page.goto('/browse')
    await page.waitForSelector('a[href^="/token/"]', { timeout: 30000 })

    await page.click('button:has-text("For Sale")')
    await page.waitForTimeout(1000)
    expect(page.url()).toContain('tab=forSale')

    await page.click('button:has-text("Not For Sale")')
    await page.waitForTimeout(1000)
    expect(page.url()).toContain('tab=notForSale')
  })

  test('pagination works and preserves in URL', async ({ page }) => {
    await page.goto('/browse')
    await page.waitForSelector('a[href^="/token/"]', { timeout: 30000 })

    const page2Btn = page.locator('button', { hasText: '2' }).first()
    if (await page2Btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await page2Btn.click()
      await page.waitForTimeout(1000)
      expect(page.url()).toContain('page=2')
    }
  })

  test('sort toggle changes order', async ({ page }) => {
    await page.goto('/browse')
    await page.waitForSelector('a[href^="/token/"]', { timeout: 30000 })

    const firstCard = page.locator('a[href^="/token/"]').first()
    const firstHref = await firstCard.getAttribute('href')

    // Click the sort toggle button (contains SVG)
    const sortBtn = page.locator('button:has(svg)').last()
    await sortBtn.click()
    await page.waitForTimeout(2000)

    const newFirstCard = page.locator('a[href^="/token/"]').first()
    const newFirstHref = await newFirstCard.getAttribute('href')
    expect(newFirstHref).not.toBe(firstHref)
  })

  test('filters preserved in URL across navigation', async ({ page }) => {
    // Set filters via URL and verify they load correctly
    await page.goto('/browse?tab=forSale&sort=price&asc=false')
    await page.waitForSelector('a[href^="/token/"]', { timeout: 30000 })

    // Verify the tab is active (use exact match to avoid "Not For Sale")
    const forSaleBtn = page.locator('button', { hasText: /^For Sale/ })
    await expect(forSaleBtn).toHaveClass(/bg-xdc-accent/)

    // Verify sort dropdown shows price
    const sortSelect = page.locator('select')
    await expect(sortSelect).toHaveValue('price')
  })
})

test.describe('Token Detail Page', () => {
  test('shows token info and image', async ({ page }) => {
    await page.goto('/token/1')
    await page.waitForSelector('h1', { timeout: 15000 })

    const title = await page.locator('h1').textContent()
    expect(title).toContain('Ethereum Killer')

    const img = page.locator('img').first()
    await expect(img).toBeVisible()
  })

  test('shows traits', async ({ page }) => {
    await page.goto('/token/1')
    await page.waitForSelector('h1', { timeout: 15000 })

    const traitLabel = page.locator('text=BACKGROUND')
    await expect(traitLabel.first()).toBeVisible({ timeout: 10000 })
  })

  test('shows price for listed token', async ({ page }) => {
    await page.goto('/token/1')
    await page.waitForSelector('h1', { timeout: 15000 })

    const priceText = page.locator('text=/XDC/')
    await expect(priceText.first()).toBeVisible({ timeout: 10000 })
  })

  test('back button is visible on token page', async ({ page }) => {
    await page.goto('/token/1')
    await page.waitForSelector('h1', { timeout: 15000 })

    const backBtn = page.locator('button:has-text("Back")')
    await expect(backBtn).toBeVisible()
  })

  test('offers and sales history tabs', async ({ page }) => {
    await page.goto('/token/1')
    await page.waitForSelector('h1', { timeout: 15000 })

    await expect(page.locator('button:has-text("Offers")')).toBeVisible()
    await expect(page.locator('button:has-text("Sales History")')).toBeVisible()

    await page.click('button:has-text("Sales History")')
    await page.waitForTimeout(500)
  })

  test('token 0 shows Original traits', async ({ page }) => {
    await page.goto('/token/0')
    await page.waitForSelector('h1', { timeout: 15000 })

    await expect(page.locator('text=Original Background')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=Original Tuxedo')).toBeVisible()
  })
})

test.describe('Profile Page', () => {
  test('shows deployer profile with token count', async ({ page }) => {
    await page.goto(`/profile/${DEPLOYER_ADDR}`)
    await page.waitForSelector('h1', { timeout: 15000 })

    const heading = await page.locator('h1').textContent()
    expect(heading).toContain('Profile')

    const countText = page.locator('text=/\\d+ NFTs owned/')
    await expect(countText).toBeVisible({ timeout: 15000 })
  })

  test('NFTs tab loads tokens', async ({ page }) => {
    await page.goto(`/profile/${DEPLOYER_ADDR}`)
    // Wait for loading then tokens
    await page.waitForSelector('a[href^="/token/"]', { timeout: 60000 })
    const cards = page.locator('a[href^="/token/"]')
    expect(await cards.count()).toBeGreaterThan(0)
  })

  test('offers tab shows', async ({ page }) => {
    await page.goto(`/profile/${DEPLOYER_ADDR}`)
    await page.waitForSelector('h1', { timeout: 15000 })

    const offersTab = page.locator('button:has-text("My Offers")')
    await expect(offersTab).toBeVisible()
    await offersTab.click()
    await page.waitForTimeout(1000)
  })
})

test.describe('Activity Page', () => {
  test('loads with sales and offers tabs', async ({ page }) => {
    await page.goto('/activity')
    await page.waitForSelector('h1', { timeout: 15000 })

    expect(await page.locator('h1').textContent()).toBe('Activity')
    await expect(page.locator('button:has-text("Sales")')).toBeVisible()
    await expect(page.locator('button:has-text("Offers")')).toBeVisible()
  })
})

test.describe('Search', () => {
  test('search by token ID navigates to token page', async ({ page }) => {
    await page.goto('/')
    const searchInput = page.locator('input[placeholder*="Search"]')
    await searchInput.fill('42')
    await searchInput.press('Enter')
    await page.waitForTimeout(2000)
    expect(page.url()).toContain('/token/42')
  })

  test('search by address navigates to profile', async ({ page }) => {
    await page.goto('/')
    const searchInput = page.locator('input[placeholder*="Search"]')
    await searchInput.fill(DEPLOYER_ADDR)
    await searchInput.press('Enter')
    await page.waitForTimeout(2000)
    expect(page.url()).toContain(`/profile/${DEPLOYER_ADDR}`)
  })
})

test.describe('Navigation', () => {
  test('navbar links work', async ({ page }) => {
    await page.goto('/')

    await page.click('a:has-text("Browse")')
    await page.waitForTimeout(1000)
    expect(page.url()).toContain('/browse')

    await page.click('a:has-text("Activity")')
    await page.waitForTimeout(1000)
    expect(page.url()).toContain('/activity')

    await page.click('a:has-text("Ethereum Killer")')
    await page.waitForTimeout(1000)
    expect(page.url()).not.toContain('/browse')
  })
})
