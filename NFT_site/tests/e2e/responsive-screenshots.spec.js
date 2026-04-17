import { test } from '@playwright/test'

const pages = [
  { name: 'home', path: '/' },
  { name: 'browse-forsale', path: '/browse?tab=forSale' },
  { name: 'browse-notsale', path: '/browse?tab=notForSale' },
  { name: 'token-listed', path: '/token/10' },
  { name: 'token-unlisted', path: '/token/100' },
  { name: 'profile', path: '/profile/0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' },
  { name: 'activity', path: '/activity' },
  { name: 'admin', path: '/admin' },
]

const viewports = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
]

for (const vp of viewports) {
  for (const pg of pages) {
    test(`${vp.name} — ${pg.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto(pg.path)
      // Wait for content to load
      await page.waitForSelector('h1, h2, [data-testid]', { timeout: 15000 }).catch(() => {})
      // Wait for dynamic content — browse page needs longer for metadata + RPC
      await page.waitForTimeout(pg.name.includes('browse') ? 8000 : 2000)
      await page.screenshot({
        path: `tests/e2e/screenshots/${vp.name}-${pg.name}.png`,
        fullPage: true,
      })
    })
  }
}
