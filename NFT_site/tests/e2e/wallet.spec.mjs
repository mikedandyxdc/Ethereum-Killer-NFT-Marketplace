import { test, expect } from '@playwright/test'
import { installMockWallet } from '@johanneskares/wallet-mock'
import { privateKeyToAccount } from 'viem/accounts'
import { http, defineChain } from 'viem'

// Hardhat localhost chain
const hardhatLocalhost = defineChain({
  id: 1337,
  name: 'Hardhat Localhost',
  nativeCurrency: { decimals: 18, name: 'ETH', symbol: 'ETH' },
  rpcUrls: { default: { http: ['http://127.0.0.1:8545'] } },
  testnet: true,
})

// Hardhat default accounts
const DEPLOYER = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80')
const BUYER = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d')
const THIRD = privateKeyToAccount('0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a')

const DEPLOYER_ADDR = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
const BUYER_ADDR = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
const THIRD_ADDR = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'

// ── Snapshot/Revert ──
const RPC_URL = 'http://127.0.0.1:8545'

async function rpc(method, params = []) {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
  })
  const json = await res.json()
  return json.result
}

// Send tx, mine block, and verify receipt status === 0x1
async function sendTx(txParams) {
  const hash = await rpc('eth_sendTransaction', [txParams])
  await rpc('evm_mine')
  const receipt = await rpc('eth_getTransactionReceipt', [hash])
  if (!receipt || receipt.status !== '0x1') {
    throw new Error(`Transaction reverted: ${JSON.stringify(txParams).slice(0, 200)}`)
  }
  return hash
}

let snapshotId

test.beforeEach(async () => {
  snapshotId = await rpc('evm_snapshot')
})

test.afterEach(async () => {
  await rpc('evm_revert', [snapshotId])
})

// ── Helpers ──

async function boostBalance(address) {
  await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'hardhat_setBalance',
      params: [address, '0x52b7d2dcc80cd2e4000000'], // 100M ETH
      id: 1,
    }),
  })
}

async function setupWallet(page, account) {
  await installMockWallet({
    page,
    account,
    defaultChain: hardhatLocalhost,
    transports: { [hardhatLocalhost.id]: http(RPC_URL) },
  })
}

async function connectWallet(page) {
  const connectBtn = page.locator('button', { hasText: /connect wallet/i }).first()
  if (await connectBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await connectBtn.click()
    await page.waitForTimeout(1000)
    const walletBtn = page.locator('[data-testid="rk-wallet-option-mock"]').first()
    if (await walletBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await walletBtn.click()
    } else {
      const anyWallet = page.locator('button', { hasText: /mock|injected|browser/i }).first()
      if (await anyWallet.isVisible({ timeout: 3000 }).catch(() => false)) {
        await anyWallet.click()
      }
    }
    await page.waitForTimeout(2000)
  }
}

// Wait for transaction to confirm — look for toast or just wait
async function waitForTx(page) {
  // Try to find any success toast (different hooks use different text: "confirmed", "Approved!", etc.)
  try {
    await expect(page.locator('[data-sonner-toast][data-type="success"]')).toBeVisible({ timeout: 30000 })
  } catch {
    // Toast might have already dismissed or uses different text
  }
  await page.waitForTimeout(2000) // let UI update after query invalidation
}

// Make an offer via RPC (bypasses UI, for tests that need pre-existing offers)
async function makeOfferViaRpc(tokenId, amount) {
  await boostBalance(BUYER_ADDR)
  // Encode makeOffer(uint256 tokenId) call
  const tokenHex = BigInt(tokenId).toString(16).padStart(64, '0')
  const data = '0x9a2f6474' + tokenHex // makeOffer(uint256) selector
  const valueHex = '0x' + (BigInt(amount) * BigInt('1000000000000000000')).toString(16)

  return await sendTx({
    from: BUYER_ADDR,
    to: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
    data,
    value: valueHex,
    gas: '0x100000',
  })
}

// Helper: update token price via RPC as DEPLOYER (for tests that need a specific price)
async function updatePriceViaRpc(tokenId, priceInEther) {
  const tokenHex = BigInt(tokenId).toString(16).padStart(64, '0')
  // Convert fractional ether to wei using string math to avoid floating point issues
  const [whole, frac = ''] = priceInEther.split('.')
  const weiStr = whole + frac.padEnd(18, '0')
  const priceHex = BigInt(weiStr).toString(16).padStart(64, '0')
  const data = '0x897925f5' + tokenHex + priceHex // updateTokenPrice(uint256,uint256)

  await sendTx({
    from: DEPLOYER_ADDR,
    to: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
    data,
    gas: '0x100000',
  })
}

// Buy a token via RPC (no UI needed)
async function buyTokenViaRpc(tokenId, buyerAddress) {
  await rpc('hardhat_impersonateAccount', [buyerAddress])
  await rpc('hardhat_setBalance', [buyerAddress, '0xC9F2C9CD04674EDEA40000000'])
  // Read price first
  const tokenHex = BigInt(tokenId).toString(16).padStart(64, '0')
  const priceResult = await rpc('eth_call', [{
    to: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
    data: '0xc457fb37' + tokenHex, // getTokenPrice(uint256)
  }, 'latest'])
  const priceWei = BigInt(priceResult)
  const priceHex = priceWei.toString(16).padStart(64, '0')
  const valueHex = '0x' + priceWei.toString(16)
  await sendTx({
    from: buyerAddress,
    to: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
    data: '0x057466ea' + tokenHex + priceHex, // buyToken(uint256,uint256)
    value: valueHex,
    gas: '0x500000',
  })
  await rpc('hardhat_stopImpersonatingAccount', [buyerAddress])
}

// List a token via RPC (approve + list)
async function listTokenViaRpc(tokenId, ownerAddress, priceInEther) {
  await rpc('hardhat_impersonateAccount', [ownerAddress])
  await rpc('hardhat_setBalance', [ownerAddress, '0xC9F2C9CD04674EDEA40000000'])
  const contract = '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0'
  // setApprovalForAll(address operator, bool approved)
  const operatorPadded = contract.slice(2).toLowerCase().padStart(64, '0')
  const truePadded = '0000000000000000000000000000000000000000000000000000000000000001'
  await sendTx({
    from: ownerAddress,
    to: contract,
    data: '0xa22cb465' + operatorPadded + truePadded,
    gas: '0x100000',
  })
  // listTokenForSale(uint256 tokenId, uint256 price)
  const tokenHex = BigInt(tokenId).toString(16).padStart(64, '0')
  const priceWei = BigInt(priceInEther) * BigInt('1000000000000000000')
  const priceHex = priceWei.toString(16).padStart(64, '0')
  await sendTx({
    from: ownerAddress,
    to: contract,
    data: '0x2406e677' + tokenHex + priceHex,
    gas: '0x500000',
  })
  await rpc('hardhat_stopImpersonatingAccount', [ownerAddress])
}

// Helper: buy a token as BUYER (for tests that need a post-purchase state)
async function buyTokenAs(page, tokenId) {
  await page.goto(`/token/${tokenId}`)
  await page.waitForSelector('h1', { timeout: 30000 })
  await connectWallet(page)
  const buyBtn = page.locator('button:has-text("Buy Now")')
  await expect(buyBtn).toBeVisible({ timeout: 15000 })
  await buyBtn.click()
  await waitForTx(page)
}

// ════════════════════════════════════════════════════
// WALLET CONNECTION
// ════════════════════════════════════════════════════

test.describe('Wallet Connection', () => {
  test('connect wallet shows connected state', async ({ page }) => {
    await setupWallet(page, DEPLOYER)
    await page.goto('/token/1')
    await page.waitForSelector('h1', { timeout: 60000 })
    await connectWallet(page)

    // After connecting, should see owner-specific UI (Manage Listing) since deployer owns all
    await expect(page.locator('text=Manage Listing')).toBeVisible({ timeout: 30000 })
  })
})

// ════════════════════════════════════════════════════
// TOKEN DETAIL — OWNER ACTIONS
// ════════════════════════════════════════════════════

test.describe('Owner - Token Detail Actions', () => {
  test.beforeEach(async ({ page }) => {
    await setupWallet(page, DEPLOYER)
  })

  test('see Manage Listing on owned token', async ({ page }) => {
    await page.goto('/token/1')
    await page.waitForSelector('h1', { timeout: 60000 })
    await connectWallet(page)
    await expect(page.locator('text=Manage Listing')).toBeVisible({ timeout: 30000 })
  })

  test('see Transfer / Approve button on owned token', async ({ page }) => {
    await page.goto('/token/1')
    await page.waitForSelector('h1', { timeout: 30000 })
    await connectWallet(page)
    await expect(page.locator('button:has-text("Transfer")')).toBeVisible({ timeout: 15000 })
  })

  test('delist a token', async ({ page }) => {
    await page.goto('/token/5')
    await page.waitForSelector('h1', { timeout: 30000 })
    await connectWallet(page)
    await expect(page.locator('text=Manage Listing')).toBeVisible({ timeout: 15000 })

    const delistBtn = page.locator('button:has-text("Remove from Sale")')
    await expect(delistBtn).toBeVisible({ timeout: 10000 })
    await delistBtn.click()
    await waitForTx(page)

    // After delist: Remove from Sale gone, List for Sale appeared, Current Price gone
    await expect(delistBtn).not.toBeVisible({ timeout: 15000 })
    await expect(page.locator('button:has-text("List for Sale")')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('text=Current Price')).not.toBeVisible({ timeout: 5000 })
  })

  test('relist a delisted token', async ({ page }) => {
    await page.goto('/token/6')
    await page.waitForSelector('h1', { timeout: 30000 })
    await connectWallet(page)
    await expect(page.locator('text=Manage Listing')).toBeVisible({ timeout: 15000 })

    // Delist first
    const delistBtn = page.locator('button:has-text("Remove from Sale")')
    await expect(delistBtn).toBeVisible({ timeout: 10000 })
    await delistBtn.click()
    await waitForTx(page)

    // Verify UI swapped: Remove from Sale gone, List for Sale appeared
    await expect(delistBtn).not.toBeVisible({ timeout: 15000 })
    const listBtn = page.locator('button:has-text("List for Sale")')
    await expect(listBtn).toBeVisible({ timeout: 15000 })

    // Now relist at 30000
    const priceInput = page.locator('input[placeholder*="Price in XDC"]').first()
    await expect(priceInput).toBeVisible({ timeout: 10000 })
    await priceInput.fill('30000')
    await listBtn.click()
    await waitForTx(page)

    // Should show Remove from Sale again + Current Price
    await expect(page.locator('button:has-text("Remove from Sale")')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('text=Current Price')).toBeVisible({ timeout: 15000 })
  })

  test('update listing price', async ({ page }) => {
    await page.goto('/token/7')
    await page.waitForSelector('h1', { timeout: 30000 })
    await connectWallet(page)
    await expect(page.locator('text=Manage Listing')).toBeVisible({ timeout: 15000 })

    const priceInput = page.locator('input[placeholder*="price" i], input[placeholder*="XDC" i]').first()
    await expect(priceInput).toBeVisible({ timeout: 10000 })
    await priceInput.fill('50000')

    const updateBtn = page.locator('button:has-text("Update Price"), button:has-text("Update")')
    await updateBtn.first().click()
    await waitForTx(page)

    // // Old K format:
    // await expect(page.locator('text=/50\\.0K|50,000|50000/').first()).toBeVisible({ timeout: 15000 })
    // Price should update — full number with commas (OpenSea-style)
    await expect(page.locator('text=50,000').first()).toBeVisible({ timeout: 15000 })
  })

  test('open transfer modal and see address input', async ({ page }) => {
    await page.goto('/token/10')
    await page.waitForSelector('h1', { timeout: 30000 })
    await connectWallet(page)

    const transferBtn = page.locator('button:has-text("Transfer")')
    await expect(transferBtn).toBeVisible({ timeout: 15000 })
    await transferBtn.click()

    // Modal should appear with address input
    const addrInput = page.locator('input[placeholder*="0x"]')
    await expect(addrInput).toBeVisible({ timeout: 10000 })
  })

  test('transfer a token to another address', async ({ page }) => {
    await page.goto('/token/11')
    await page.waitForSelector('h1', { timeout: 30000 })
    await connectWallet(page)

    const transferBtn = page.locator('button:has-text("Transfer")')
    await expect(transferBtn).toBeVisible({ timeout: 15000 })
    await transferBtn.click()

    // Wait for modal to appear
    const addrInput = page.locator('input[placeholder*="0x"]')
    await expect(addrInput).toBeVisible({ timeout: 10000 })
    await addrInput.fill(BUYER_ADDR)

    // Click the submit Transfer button (not the tab button)
    const confirmTransfer = page.locator('button:has-text("Transfer")').last()
    await confirmTransfer.click()
    await waitForTx(page)

    // Should no longer show Manage Listing (not owner anymore)
    await expect(page.locator('text=Manage Listing')).not.toBeVisible({ timeout: 15000 })
  })

  test('approve an address for a token', async ({ page }) => {
    await page.goto('/token/12')
    await page.waitForSelector('h1', { timeout: 30000 })
    await connectWallet(page)

    // Open Transfer / Approve modal
    const transferApproveBtn = page.locator('button:has-text("Transfer / Approve"), button:has-text("Transfer")')
    await expect(transferApproveBtn.first()).toBeVisible({ timeout: 15000 })
    await transferApproveBtn.first().click()

    // Wait for modal to appear
    const modalOverlay = page.locator('.fixed.inset-0')
    const approveTab = modalOverlay.locator('button', { hasText: 'Approve' }).first()
    await expect(approveTab).toBeVisible({ timeout: 10000 })
    await approveTab.click()

    // Wait for Approve tab content — placeholder changes to "Approved address"
    const addrInput = page.locator('input[placeholder*="Approved address"]')
    await expect(addrInput).toBeVisible({ timeout: 10000 })
    await addrInput.fill(BUYER_ADDR)

    // Click the Approve submit button (full-width purple button that appears on Approve tab)
    const approveSubmit = modalOverlay.locator('button', { hasText: 'Approve' }).last()
    await approveSubmit.click()

    // Verify transaction confirmed
    await expect(page.locator('[data-sonner-toast] :text("confirmed")')).toBeVisible({ timeout: 30000 })
  })

  test('accept an offer on owned token', async ({ page }) => {
    // Make an offer via RPC as BUYER (can't switch wallets in same page)
    await boostBalance(BUYER_ADDR)
    await makeOfferViaRpc(20, 25000)

    // Now view as deployer and accept
    await page.goto('/token/20')
    await page.waitForSelector('h1', { timeout: 30000 })
    await connectWallet(page)

    // Look for Accept button in offers section
    const acceptBtn = page.locator('button:has-text("Accept")')
    await expect(acceptBtn.first()).toBeVisible({ timeout: 15000 })
    await acceptBtn.first().click()
    await waitForTx(page)

    // After accepting, deployer no longer owns the token
    await expect(page.locator('text=Manage Listing')).not.toBeVisible({ timeout: 15000 })
  })

  test('update listing price shows new price in UI', async ({ page }) => {
    await page.goto('/token/60')
    await page.waitForSelector('h1', { timeout: 30000 })
    await connectWallet(page)
    await expect(page.locator('text=Manage Listing')).toBeVisible({ timeout: 15000 })

    // Current price is 25,000 — update to 75000
    const priceInput = page.locator('input[placeholder*="price" i], input[placeholder*="XDC" i]').first()
    await expect(priceInput).toBeVisible({ timeout: 10000 })
    await priceInput.fill('75000')

    const updateBtn = page.locator('button:has-text("Update Price")')
    await expect(updateBtn).toBeVisible({ timeout: 5000 })
    await updateBtn.click()
    await expect(page.locator('[data-sonner-toast] :text("confirmed")')).toBeVisible({ timeout: 30000 })

    // // Old K format:
    // await expect(page.locator('text=75.0K')).toBeVisible({ timeout: 15000 })
    // UI should show updated price — full number with commas (OpenSea-style)
    await expect(page.locator('text=75,000')).toBeVisible({ timeout: 15000 })
  })

  test('update price to fractional and verify display', async ({ page }) => {
    await page.goto('/token/70')
    await page.waitForSelector('h1', { timeout: 30000 })
    await connectWallet(page)
    await expect(page.locator('text=Manage Listing')).toBeVisible({ timeout: 15000 })

    // Update from 25000 to fractional price 25000.28925
    const priceInput = page.locator('input[placeholder*="price" i], input[placeholder*="XDC" i]').first()
    await expect(priceInput).toBeVisible({ timeout: 10000 })
    await priceInput.fill('25000.28925')

    const updateBtn = page.locator('button:has-text("Update Price")')
    await expect(updateBtn).toBeVisible({ timeout: 5000 })
    await updateBtn.click()
    await expect(page.locator('[data-sonner-toast] :text("confirmed")')).toBeVisible({ timeout: 30000 })

    // Verify fractional price displayed (OpenSea-style: 25,000.29 — 2 decimals for >= 1)
    await expect(page.locator('text=25,000.29')).toBeVisible({ timeout: 15000 })
  })

  test('list delisted token at different price', async ({ page }) => {
    await page.goto('/token/61')
    await page.waitForSelector('h1', { timeout: 30000 })
    await connectWallet(page)
    await expect(page.locator('text=Manage Listing')).toBeVisible({ timeout: 15000 })

    // Delist first
    const delistBtn = page.locator('button:has-text("Remove from Sale")')
    await expect(delistBtn).toBeVisible({ timeout: 10000 })
    await delistBtn.click()
    await expect(page.locator('[data-sonner-toast] :text("confirmed")')).toBeVisible({ timeout: 30000 })

    // Current Price section should disappear
    await expect(page.locator('text=Current Price')).not.toBeVisible({ timeout: 15000 })

    // Relist at 50000 XDC (different from original 25000)
    const priceInput = page.locator('input[placeholder*="Price in XDC"]').first()
    await expect(priceInput).toBeVisible({ timeout: 10000 })
    await priceInput.fill('50000')

    const listBtn = page.locator('button:has-text("List for Sale")')
    await expect(listBtn).toBeVisible({ timeout: 5000 })
    await listBtn.click()
    await expect(page.locator('[data-sonner-toast] :text("confirmed")')).toBeVisible({ timeout: 30000 })

    // // Old K format:
    // await expect(page.locator('text=50.0K')).toBeVisible({ timeout: 15000 })
    // UI should show new price — full number with commas (OpenSea-style)
    await expect(page.locator('text=50,000')).toBeVisible({ timeout: 15000 })
  })

  test('owner does not see Buy button or Make an Offer on own token', async ({ page }) => {
    await page.goto('/token/62')
    await page.waitForSelector('h1', { timeout: 30000 })
    await connectWallet(page)

    // Should see Manage Listing (confirms we're the owner)
    await expect(page.locator('text=Manage Listing')).toBeVisible({ timeout: 15000 })
    // Should NOT see Buy Now
    await expect(page.locator('button:has-text("Buy Now")')).not.toBeVisible({ timeout: 3000 })
    // Should NOT see Make an Offer section
    await expect(page.locator('text=Make an Offer')).not.toBeVisible({ timeout: 3000 })
  })
})

// ════════════════════════════════════════════════════
// TOKEN DETAIL — BUYER ACTIONS
// ════════════════════════════════════════════════════

test.describe('Buyer - Token Detail Actions', () => {
  test.beforeEach(async ({ page }) => {
    await boostBalance(BUYER_ADDR)
    await setupWallet(page, BUYER)
  })

  test('see Buy Now button on listed token (not owner)', async ({ page }) => {
    await page.goto('/token/1')
    await page.waitForSelector('h1', { timeout: 30000 })
    await connectWallet(page)

    await expect(page.locator('button:has-text("Buy Now")')).toBeVisible({ timeout: 15000 })
  })

  test('buy a fractional-priced token', async ({ page }) => {
    // Deployer updates token 71 to fractional price via RPC (setup, not the action under test)
    await updatePriceViaRpc(71, '25000.28925')

    await page.goto('/token/71')
    await page.waitForSelector('h1', { timeout: 30000 })
    await connectWallet(page)

    // Verify fractional price visible before buying
    await expect(page.locator('text=25,000.29')).toBeVisible({ timeout: 15000 })

    const buyBtn = page.locator('button:has-text("Buy Now")')
    await expect(buyBtn).toBeVisible({ timeout: 15000 })
    await buyBtn.click()
    await waitForTx(page)

    // After buy: buyer now owns it
    await expect(buyBtn).not.toBeVisible({ timeout: 15000 })
    await expect(page.locator('text=Manage Listing')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('text=/Owned by.*you/i')).toBeVisible({ timeout: 15000 })
  })

  test('buy a listed token', async ({ page }) => {
    await page.goto('/token/2')
    await page.waitForSelector('h1', { timeout: 30000 })
    await connectWallet(page)

    const buyBtn = page.locator('button:has-text("Buy Now")')
    await expect(buyBtn).toBeVisible({ timeout: 15000 })
    await buyBtn.click()
    await waitForTx(page)

    // After buy: Buy Now gone, now showing owner UI
    await expect(buyBtn).not.toBeVisible({ timeout: 15000 })
    await expect(page.locator('text=Manage Listing')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('text=/Owned by.*you/i')).toBeVisible({ timeout: 15000 })
  })

  test('make an offer on a token', async ({ page }) => {
    await page.goto('/token/3')
    await page.waitForSelector('h1', { timeout: 30000 })
    await connectWallet(page)

    // const offerInput = page.locator('input[type="number"]').first()
    const offerInput = page.locator('input[placeholder*="offer" i]').first()
    await expect(offerInput).toBeVisible({ timeout: 10000 })
    await offerInput.fill('25000')

    const submitBtn = page.locator('button:has-text("Make Offer")')
    await submitBtn.click()
    await expect(page.locator('[data-sonner-toast] :text("confirmed")')).toBeVisible({ timeout: 30000 })

    // After offer: "Your offer" display with amount and "Withdraw Offer" should appear
    await expect(page.locator('text=/Your offer/i')).toBeVisible({ timeout: 20000 })
    await expect(page.locator('button:has-text("Withdraw Offer")')).toBeVisible({ timeout: 10000 })
  })

  test('withdraw an offer', async ({ page }) => {
    // Make an offer via RPC as BUYER
    await makeOfferViaRpc(4, 25000)

    // Navigate and connect
    await page.goto('/token/4')
    await page.waitForSelector('h1', { timeout: 30000 })
    await connectWallet(page)

    // Should see "Withdraw Offer" button (offer exists for this address)
    const withdrawBtn = page.locator('button:has-text("Withdraw Offer")')
    await expect(withdrawBtn).toBeVisible({ timeout: 30000 })
    await withdrawBtn.click()
    await expect(page.locator('[data-sonner-toast] :text("confirmed")')).toBeVisible({ timeout: 30000 })

    // After withdraw: Withdraw gone, back to "Make Offer", "Your offer" gone
    await expect(withdrawBtn).not.toBeVisible({ timeout: 15000 })
    await expect(page.locator('button:has-text("Make Offer")')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('text=/Your offer/i')).not.toBeVisible({ timeout: 5000 })
  })

  test('update an existing offer with higher amount', async ({ page }) => {
    // Make initial offer via RPC
    await makeOfferViaRpc(8, 25000)

    await page.goto('/token/8')
    await page.waitForSelector('h1', { timeout: 30000 })
    await connectWallet(page)

    // Wait for existing offer to load — "Your offer" and "Withdraw Offer" appear
    await expect(page.locator('text=/Your offer/i')).toBeVisible({ timeout: 30000 })
    await expect(page.locator('button:has-text("Withdraw Offer")')).toBeVisible({ timeout: 10000 })

    // Fill higher offer amount
    // const offerInput = page.locator('input[type="number"]').first()
    const offerInput = page.locator('input[placeholder*="offer" i]').first()
    await expect(offerInput).toBeVisible({ timeout: 10000 })
    await offerInput.fill('50000')

    // Click Update Offer (button text changes when offer exists)
    const updateBtn = page.locator('button:has-text("Update Offer")')
    await expect(updateBtn).toBeVisible({ timeout: 10000 })
    await updateBtn.click()
    await expect(page.locator('[data-sonner-toast] :text("confirmed")')).toBeVisible({ timeout: 30000 })

    // // Old K format:
    // await expect(page.locator('text=50.0K').first()).toBeVisible({ timeout: 20000 })
    // UI should show updated offer amount — full number with commas (OpenSea-style)
    await expect(page.locator('text=50,000').first()).toBeVisible({ timeout: 20000 })
  })

  test('multiple bidders can make offers on same token', async ({ page }) => {
    // BUYER offer already set up by beforeEach wallet — make offer via RPC
    await makeOfferViaRpc(9, 25000) // BUYER offers 25000
    // THIRD makes offer via impersonation
    await rpc('hardhat_impersonateAccount', [THIRD_ADDR])
    await rpc('hardhat_setBalance', [THIRD_ADDR, '0xC9F2C9CD04674EDEA40000000'])
    const tokenHex = '0x' + BigInt(9).toString(16).padStart(64, '0')
    const valueWei = '0x' + (BigInt('35000') * BigInt('1000000000000000000')).toString(16)
    await sendTx({
      from: THIRD_ADDR,
      to: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
      data: '0x9a2f6474' + tokenHex.slice(2), // makeOffer(uint256)
      value: valueWei,
      gas: '0x200000',
    })
    await rpc('hardhat_stopImpersonatingAccount', [THIRD_ADDR])

    // View token page — both offers should be visible to anyone
    await page.goto('/token/9')
    await page.waitForSelector('h1', { timeout: 30000 })
    await connectWallet(page)

    // Click Offers tab to see all offers
    const offersTab = page.locator('button:has-text("Offers")')
    await expect(offersTab.first()).toBeVisible({ timeout: 15000 })
    await offersTab.first().click()

    // Should show 2 offers — both rows visible
    await expect(page.locator('text=/Offers \\(2\\)/')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('text=/25,000/').first()).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=/35,000/').first()).toBeVisible({ timeout: 10000 })
  })

  test('multiple sales show in sales history tab', async ({ page }) => {
    // Buy token 10 as BUYER, then list and sell to THIRD
    await buyTokenViaRpc(10, BUYER_ADDR)
    await listTokenViaRpc(10, BUYER_ADDR, '30000')
    await buyTokenViaRpc(10, THIRD_ADDR)

    // View token page — should see 2 sales in history
    await page.goto('/token/10')
    await page.waitForSelector('h1', { timeout: 30000 })

    const historyTab = page.locator('button:has-text("Sales"), button:has-text("History")')
    await historyTab.first().click()

    // Should show 2 sales
    await expect(page.locator('text=/Sales.*\\(2\\)|History.*\\(2\\)/').first()).toBeVisible({ timeout: 15000 })
  })

  test('three bidders make offers on same token with row count', async ({ page }) => {
    // BUYER, THIRD, and a 4th account all make offers
    await makeOfferViaRpc(11, 25000)
    const FOURTH_ADDR = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65'
    for (const [addr, amount] of [[THIRD_ADDR, '35000'], [FOURTH_ADDR, '40000']]) {
      await rpc('hardhat_impersonateAccount', [addr])
      await rpc('hardhat_setBalance', [addr, '0xC9F2C9CD04674EDEA40000000'])
      const tokenHex = BigInt(11).toString(16).padStart(64, '0')
      const valueWei = '0x' + (BigInt(amount) * BigInt('1000000000000000000')).toString(16)
      await sendTx({
        from: addr,
        to: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
        data: '0x9a2f6474' + tokenHex,
        value: valueWei,
        gas: '0x200000',
      })
      await rpc('hardhat_stopImpersonatingAccount', [addr])
    }

    await page.goto('/token/11')
    await page.waitForSelector('h1', { timeout: 30000 })

    const offersTab = page.locator('button:has-text("Offers")')
    await offersTab.first().click()

    // Should show exactly 3 offers
    await expect(page.locator('text=/Offers \\(3\\)/')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('text=/25,000/').first()).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=/35,000/').first()).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=/40,000/').first()).toBeVisible({ timeout: 10000 })
  })

  test('sales history row count matches header count', async ({ page }) => {
    // Sale 1: deployer -> BUYER
    await buyTokenViaRpc(12, BUYER_ADDR)
    // BUYER lists and THIRD buys (Sale 2)
    await listTokenViaRpc(12, BUYER_ADDR, '30000')
    await buyTokenViaRpc(12, THIRD_ADDR)

    // View token page — should see 2 sales with matching row count
    await page.goto('/token/12')
    await page.waitForSelector('h1', { timeout: 30000 })

    const historyTab = page.locator('button:has-text("Sales"), button:has-text("History")')
    await historyTab.first().click()

    await expect(page.locator('text=/Sales History \\(2\\)/')).toBeVisible({ timeout: 15000 })
    // Verify row count matches
    const rows = page.locator('table tbody tr')
    await expect(rows).toHaveCount(2, { timeout: 10000 })
  })

  test('cannot buy own token after purchasing', async ({ page }) => {
    await buyTokenAs(page, 15)

    // Buy Now should not be visible (we own it now)
    await expect(page.locator('button:has-text("Buy Now")')).not.toBeVisible({ timeout: 5000 })
    // Should see Manage Listing instead
    await expect(page.locator('text=Manage Listing')).toBeVisible({ timeout: 15000 })
  })
})

// ════════════════════════════════════════════════════
// TOKEN DETAIL — ERROR CASES
// ════════════════════════════════════════════════════

test.describe('Error Handling', () => {
  // // Old test — before frontend MIN_PRICE validation, button submitted and contract rejected with toast:
  // test('offer below minimum shows error toast', async ({ page }) => {
  //   await boostBalance(BUYER_ADDR)
  //   await setupWallet(page, BUYER)
  //   await page.goto('/token/30')
  //   await page.waitForSelector('h1', { timeout: 30000 })
  //   await connectWallet(page)
  //   const offerInput = page.locator('input[type="number"], input[placeholder*="offer" i], input[placeholder*="amount" i]').first()
  //   await expect(offerInput).toBeVisible({ timeout: 10000 })
  //   await offerInput.fill('1000')
  //   const submitBtn = page.locator('button:has-text("Make Offer")')
  //   await submitBtn.first().click()
  //   await expect(page.locator('text=Price must be at least 25,000 XDC')).toBeVisible({ timeout: 15000 })
  // })
  // Frontend now blocks offers below MIN_PRICE — button disabled + red error shown inline
  test('offer below minimum shows inline error and disables button', async ({ page }) => {
    await boostBalance(BUYER_ADDR)
    await setupWallet(page, BUYER)
    await page.goto('/token/30')
    await page.waitForSelector('h1', { timeout: 30000 })
    await connectWallet(page)

    // const offerInput = page.locator('input[type="number"]').first()
    const offerInput = page.locator('input[placeholder*="offer" i]').first()
    await expect(offerInput).toBeVisible({ timeout: 10000 })
    await offerInput.fill('1000') // Below MIN_PRICE of 25000

    // Should show inline red error message
    await expect(page.locator('text=Minimum offer is 25,000 XDC')).toBeVisible({ timeout: 5000 })

    // Button should be disabled
    const submitBtn = page.locator('button:has-text("Make Offer")')
    await expect(submitBtn.first()).toBeDisabled()
  })

  test('insufficient funds shows error toast', async ({ page }) => {
    // Don't boost balance — use default which is less than token price
    await setupWallet(page, THIRD)
    await page.goto('/token/31')
    await page.waitForSelector('h1', { timeout: 30000 })
    await connectWallet(page)

    const buyBtn = page.locator('button:has-text("Buy Now")')
    await expect(buyBtn).toBeVisible({ timeout: 15000 })
    await buyBtn.click()

    await expect(page.locator('text=Insufficient funds')).toBeVisible({ timeout: 15000 })
  })

  // // Old test — before frontend MIN_PRICE validation, button submitted and contract rejected with toast:
  // test('list below minimum price shows error toast', async ({ page }) => {
  //   await setupWallet(page, DEPLOYER)
  //   await page.goto('/token/63')
  //   await page.waitForSelector('h1', { timeout: 30000 })
  //   await connectWallet(page)
  //   await expect(page.locator('text=Manage Listing')).toBeVisible({ timeout: 15000 })
  //   const delistBtn = page.locator('button:has-text("Remove from Sale")')
  //   await expect(delistBtn).toBeVisible({ timeout: 10000 })
  //   await delistBtn.click()
  //   await expect(page.locator('[data-sonner-toast] :text("confirmed")')).toBeVisible({ timeout: 30000 })
  //   await expect(delistBtn).not.toBeVisible({ timeout: 15000 })
  //   const listBtn = page.locator('button:has-text("List for Sale")')
  //   await expect(listBtn).toBeVisible({ timeout: 15000 })
  //   const priceInput = page.locator('input[placeholder*="Price in XDC"]').first()
  //   await expect(priceInput).toBeVisible({ timeout: 10000 })
  //   await priceInput.fill('1000')
  //   await listBtn.click()
  //   await expect(page.locator('text=Price must be at least 25,000 XDC')).toBeVisible({ timeout: 15000 })
  // })
  // Frontend now blocks listing below MIN_PRICE — button disabled + red error shown inline
  test('list below minimum price shows inline error and disables button', async ({ page }) => {
    await setupWallet(page, DEPLOYER)
    await page.goto('/token/63')
    await page.waitForSelector('h1', { timeout: 30000 })
    await connectWallet(page)
    await expect(page.locator('text=Manage Listing')).toBeVisible({ timeout: 15000 })

    // Delist first so we can relist at bad price
    const delistBtn = page.locator('button:has-text("Remove from Sale")')
    await expect(delistBtn).toBeVisible({ timeout: 10000 })
    await delistBtn.click()
    await expect(page.locator('[data-sonner-toast] :text("confirmed")')).toBeVisible({ timeout: 30000 })

    // Verify UI swapped: Remove from Sale gone, List for Sale appeared
    await expect(delistBtn).not.toBeVisible({ timeout: 15000 })
    const listBtn = page.locator('button:has-text("List for Sale")')
    await expect(listBtn).toBeVisible({ timeout: 15000 })

    // Try to list at 1000 XDC (below 25000 minimum)
    const priceInput = page.locator('input[placeholder*="Price in XDC"]').first()
    await expect(priceInput).toBeVisible({ timeout: 10000 })
    await priceInput.fill('1000')

    // Should show inline red error message
    await expect(page.locator('text=Minimum price is 25,000 XDC')).toBeVisible({ timeout: 5000 })

    // Button should be disabled
    await expect(listBtn).toBeDisabled()
  })

  // // Old test — before frontend same-price validation, button submitted and contract rejected with toast:
  // test('update to same price shows error toast', async ({ page }) => {
  //   await setupWallet(page, DEPLOYER)
  //   await page.goto('/token/64')
  //   await page.waitForSelector('h1', { timeout: 30000 })
  //   await connectWallet(page)
  //   await expect(page.locator('text=Manage Listing')).toBeVisible({ timeout: 15000 })
  //   const priceInput = page.locator('input[placeholder*="price" i], input[placeholder*="XDC" i]').first()
  //   await expect(priceInput).toBeVisible({ timeout: 10000 })
  //   await priceInput.fill('25000')
  //   const updateBtn = page.locator('button:has-text("Update Price")')
  //   await updateBtn.click()
  //   await expect(page.locator('text=New price must be different from current price')).toBeVisible({ timeout: 15000 })
  // })
  // Frontend now blocks same-price update — button disabled + red error shown inline
  test('update to same price shows inline error and disables button', async ({ page }) => {
    await setupWallet(page, DEPLOYER)
    await page.goto('/token/64')
    await page.waitForSelector('h1', { timeout: 30000 })
    await connectWallet(page)
    await expect(page.locator('text=Manage Listing')).toBeVisible({ timeout: 15000 })

    // Token is listed at 25000 — try to update to same price
    const priceInput = page.locator('input[placeholder*="price" i], input[placeholder*="XDC" i]').first()
    await expect(priceInput).toBeVisible({ timeout: 10000 })
    await priceInput.fill('25000')

    // Should show inline red error message
    await expect(page.locator('text=New price must be different from current price')).toBeVisible({ timeout: 5000 })

    // Button should be disabled
    const updateBtn = page.locator('button:has-text("Update Price")')
    await expect(updateBtn).toBeDisabled()
  })
})

// ════════════════════════════════════════════════════
// TOKEN DETAIL — VIEW (NO WALLET)
// ════════════════════════════════════════════════════

test.describe('Token Detail - Disconnected', () => {
  test('shows token image, name, and traits', async ({ page }) => {
    await page.goto('/token/0')
    await page.waitForSelector('h1', { timeout: 60000 })

    await expect(page.locator('h1')).toContainText('Ethereum Killer')
    await expect(page.locator('img').first()).toBeVisible()
    // Traits section — use first() to avoid strict mode
    await expect(page.locator('text=/BACKGROUND|Background/').first()).toBeVisible({ timeout: 10000 })
  })

  test('shows owner link', async ({ page }) => {
    await page.goto('/token/1')
    await page.waitForSelector('h1', { timeout: 30000 })
    await expect(page.locator('text=Owned by')).toBeVisible({ timeout: 10000 })
  })

  test('shows price for listed token', async ({ page }) => {
    await page.goto('/token/1')
    await page.waitForSelector('h1', { timeout: 30000 })
    await expect(page.locator('text=Current Price')).toBeVisible({ timeout: 10000 })
  })

  test('shows offers and sales history tabs', async ({ page }) => {
    await page.goto('/token/1')
    await page.waitForSelector('h1', { timeout: 30000 })

    const offersTab = page.locator('button:has-text("Offers")')
    await expect(offersTab.first()).toBeVisible({ timeout: 10000 })
    const historyTab = page.locator('button:has-text("Sales"), button:has-text("History")')
    await expect(historyTab.first()).toBeVisible()
  })

  test('no Buy button when wallet disconnected', async ({ page }) => {
    await page.goto('/token/1')
    await page.waitForSelector('h1', { timeout: 30000 })
    await expect(page.locator('button:has-text("Buy Now")')).not.toBeVisible({ timeout: 5000 })
  })

  test('original token (id 0) shows Original traits', async ({ page }) => {
    await page.goto('/token/0')
    await page.waitForSelector('h1', { timeout: 30000 })
    await expect(page.locator('text=/Original/i').first()).toBeVisible({ timeout: 10000 })
  })

  test('nonexistent token shows not found', async ({ page }) => {
    await page.goto('/token/99999')
    // Token doesn't exist — should show "Token Not Found"
    await expect(page.locator('text=Token Not Found')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('text=/Owned by/i')).not.toBeVisible({ timeout: 3000 })
  })
})

// ════════════════════════════════════════════════════
// PROFILE PAGE
// ════════════════════════════════════════════════════

test.describe('Profile Page', () => {
  test('own profile shows My Profile heading and Operators tab', async ({ page }) => {
    await setupWallet(page, DEPLOYER)
    await page.goto(`/profile/${DEPLOYER_ADDR}`)
    await page.waitForSelector('h1', { timeout: 30000 })
    await connectWallet(page)

    await expect(page.locator('h1:has-text("My Profile")')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('button:has-text("Operators")')).toBeVisible()
  })

  test('other profile does not show Operators tab', async ({ page }) => {
    await setupWallet(page, BUYER)
    await page.goto(`/profile/${DEPLOYER_ADDR}`)
    await page.waitForSelector('h1', { timeout: 30000 })

    await expect(page.locator('button:has-text("Operators")')).not.toBeVisible({ timeout: 5000 })
  })

  test('deployer profile shows token count and NFT grid', async ({ page }) => {
    await page.goto(`/profile/${DEPLOYER_ADDR}`)
    await page.waitForSelector('h1', { timeout: 30000 })

    // Should show NFT count
    await expect(page.locator('text=/\\d+.*NFTs?/i').first()).toBeVisible({ timeout: 15000 })
    // Should show NFT cards
    await expect(page.locator('[class*="grid"] a, [class*="grid"] [class*="card"]').first()).toBeVisible({ timeout: 15000 })
  })

  test('profile offers tab shows offers after making one', async ({ page }) => {
    // Make an offer via RPC as buyer
    await boostBalance(BUYER_ADDR)
    await makeOfferViaRpc(40, 25000)

    await setupWallet(page, BUYER)
    await page.goto(`/profile/${BUYER_ADDR}`)
    await page.waitForSelector('h1', { timeout: 30000 })
    await connectWallet(page)

    const offersTab = page.locator('button:has-text("Offers")')
    await expect(offersTab).toBeVisible({ timeout: 10000 })
    await offersTab.click()

    // Should show the offer for token #0040
    await expect(page.locator('text=0040')).toBeVisible({ timeout: 15000 })
  })

  test('profile offers tab shows multiple offers', async ({ page }) => {
    await boostBalance(BUYER_ADDR)
    await makeOfferViaRpc(42, 25000)
    await makeOfferViaRpc(43, 30000)

    await setupWallet(page, BUYER)
    await page.goto(`/profile/${BUYER_ADDR}`)
    await page.waitForSelector('h1', { timeout: 30000 })
    await connectWallet(page)

    const offersTab = page.locator('button:has-text("Offers")')
    await expect(offersTab).toBeVisible({ timeout: 10000 })
    await offersTab.click()

    // Both offers should appear
    await expect(page.locator('text=0042')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('text=0043')).toBeVisible({ timeout: 10000 })
  })

  test('withdraw offer from profile page', async ({ page }) => {
    // Make an offer via RPC on a unique token
    await boostBalance(BUYER_ADDR)
    await makeOfferViaRpc(41, 25000)

    await setupWallet(page, BUYER)
    await page.goto(`/profile/${BUYER_ADDR}`)
    await page.waitForSelector('h1', { timeout: 30000 })
    await connectWallet(page)

    // Verify wallet connected
    await expect(page.locator('h1:has-text("My Profile")')).toBeVisible({ timeout: 15000 })

    const offersTab = page.locator('button:has-text("Offers")')
    await offersTab.click()

    // Verify our offer for token 41 is visible
    await expect(page.locator('text=0041')).toBeVisible({ timeout: 15000 })

    // Find the Withdraw button in the same row as token #0041
    const offerRow = page.locator('tr', { hasText: '0041' })
    const withdrawBtn = offerRow.locator('button:has-text("Withdraw")')
    await expect(withdrawBtn).toBeVisible({ timeout: 10000 })

    // Click Withdraw for THIS specific offer
    await withdrawBtn.click()
    await waitForTx(page)

    // Verify on-chain: offer should be withdrawn (price = 0)
    const tokenHex = BigInt(41).toString(16).padStart(64, '0')
    const addrPadded = BUYER_ADDR.slice(2).toLowerCase().padStart(64, '0')
    const result = await rpc('eth_call', [{
      to: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
      data: '0xec4fa665' + tokenHex + addrPadded,
    }, 'latest'])
    const priceWei = BigInt('0x' + result.slice(130, 194))
    expect(priceWei).toBe(0n)
  })

  test('set approval for all (operators tab)', async ({ page }) => {
    await setupWallet(page, DEPLOYER)
    await page.goto(`/profile/${DEPLOYER_ADDR}`)
    await page.waitForSelector('h1', { timeout: 30000 })
    await connectWallet(page)

    await expect(page.locator('h1:has-text("My Profile")')).toBeVisible({ timeout: 15000 })

    const operatorsTab = page.locator('button:has-text("Operators")')
    await operatorsTab.click()

    const operatorInput = page.locator('input[placeholder*="0x"]')
    await expect(operatorInput).toBeVisible({ timeout: 10000 })
    await operatorInput.fill(BUYER_ADDR)

    const approveBtn = page.locator('button:has-text("Approve")')
    await approveBtn.first().click()
    await expect(page.locator('[data-sonner-toast] :text("confirmed")')).toBeVisible({ timeout: 30000 })

    // Verify on-chain: isApprovedForAll(deployer, buyer) should return true
    // Function selector: isApprovedForAll(address,address) = 0xe985e9c5
    const ownerPadded = DEPLOYER_ADDR.slice(2).toLowerCase().padStart(64, '0')
    const operatorPadded = BUYER_ADDR.slice(2).toLowerCase().padStart(64, '0')
    const result = await rpc('eth_call', [{
      to: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
      data: '0xe985e9c5' + ownerPadded + operatorPadded,
    }, 'latest'])
    // Result is 0x...0001 if approved
    expect(BigInt(result)).toBe(1n)
  })

  test('revoke operator via operators tab', async ({ page }) => {
    // First approve THIRD as operator via RPC so we have something to revoke
    const ownerPadded = THIRD_ADDR.slice(2).toLowerCase().padStart(64, '0')
    const approvedPadded = '0000000000000000000000000000000000000000000000000000000000000001'
    await sendTx({
      from: DEPLOYER_ADDR,
      to: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
      data: '0xa22cb465' + ownerPadded + approvedPadded, // setApprovalForAll(address,bool)
      gas: '0x100000',
    })

    await setupWallet(page, DEPLOYER)
    await page.goto(`/profile/${DEPLOYER_ADDR}`)
    await page.waitForSelector('h1', { timeout: 30000 })
    await connectWallet(page)

    await expect(page.locator('h1:has-text("My Profile")')).toBeVisible({ timeout: 15000 })

    const operatorsTab = page.locator('button:has-text("Operators")')
    await operatorsTab.click()

    const operatorInput = page.locator('input[placeholder*="0x"]')
    await expect(operatorInput).toBeVisible({ timeout: 5000 })
    await operatorInput.fill(THIRD_ADDR)

    // Click Revoke button
    const revokeBtn = page.locator('button:has-text("Revoke")')
    await expect(revokeBtn).toBeVisible({ timeout: 5000 })
    await revokeBtn.click()

    await expect(page.locator('[data-sonner-toast] :text("confirmed")')).toBeVisible({ timeout: 30000 })
  })

  test('profile NFTs tab shows token after buying', async ({ page }) => {
    await boostBalance(BUYER_ADDR)
    await setupWallet(page, BUYER)

    // Buy token 65
    await page.goto('/token/65')
    await page.waitForSelector('h1', { timeout: 30000 })
    await connectWallet(page)

    const buyBtn = page.locator('button:has-text("Buy Now")')
    await expect(buyBtn).toBeVisible({ timeout: 15000 })
    await buyBtn.click()
    await expect(page.locator('[data-sonner-toast] :text("confirmed")')).toBeVisible({ timeout: 30000 })

    // Navigate to buyer's profile
    await page.goto(`/profile/${BUYER_ADDR}`)
    await page.waitForSelector('h1', { timeout: 30000 })

    // NFTs tab should show at least 1 NFT owned
    await expect(page.locator('text=/1 NFT/i')).toBeVisible({ timeout: 15000 })
    // Token 65 should be in the grid (displayed as #0065)
    await expect(page.locator('text=0065')).toBeVisible({ timeout: 15000 })
  })

  test('profile NFTs tab shows multiple tokens after buying', async ({ page }) => {
    // Buy 3 tokens via RPC
    await buyTokenViaRpc(64, BUYER_ADDR)
    await buyTokenViaRpc(65, BUYER_ADDR)
    await buyTokenViaRpc(66, BUYER_ADDR)

    await setupWallet(page, BUYER)
    await page.goto(`/profile/${BUYER_ADDR}`)
    await page.waitForSelector('h1', { timeout: 30000 })
    await connectWallet(page)

    // Should show 3 NFTs
    await expect(page.locator('text=/3 NFT/i')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('text=0064')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('text=0065')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=0066')).toBeVisible({ timeout: 10000 })
  })
})

// ════════════════════════════════════════════════════
// ACTIVITY PAGE
// ════════════════════════════════════════════════════

test.describe('Activity Page', () => {
  test('shows sales and offers tabs', async ({ page }) => {
    await page.goto('/activity')
    await page.waitForSelector('h1', { timeout: 30000 })

    await expect(page.locator('button:has-text("Sales")')).toBeVisible()
    await expect(page.locator('button:has-text("Offers")')).toBeVisible()
  })

  test('shows sale after buying a token', async ({ page }) => {
    await boostBalance(BUYER_ADDR)
    await setupWallet(page, BUYER)
    await buyTokenAs(page, 50)

    await page.goto('/activity')
    await page.waitForSelector('h1', { timeout: 30000 })

    const salesTab = page.locator('button:has-text("Sales")')
    await salesTab.click()

    // Should show token #0050 in sales table
    await expect(page.locator('text=0050')).toBeVisible({ timeout: 15000 })
  })

  test('shows offer after making one', async ({ page }) => {
    // Make offer via RPC
    await boostBalance(BUYER_ADDR)
    await makeOfferViaRpc(51, 25000)

    await page.goto('/activity')
    await page.waitForSelector('h1', { timeout: 30000 })

    const offersTab = page.locator('button:has-text("Offers")')
    await offersTab.click()

    // Should show token #0051 in offers table
    await expect(page.locator('text=0051')).toBeVisible({ timeout: 15000 })
  })

  test('activity sales tab shows correct token ID after buy', async ({ page }) => {
    await boostBalance(BUYER_ADDR)
    await setupWallet(page, BUYER)

    // Buy token 70 via UI
    await page.goto('/token/70')
    await page.waitForSelector('h1', { timeout: 30000 })
    await connectWallet(page)

    const buyBtn = page.locator('button:has-text("Buy Now")')
    await expect(buyBtn).toBeVisible({ timeout: 15000 })
    await buyBtn.click()
    await expect(page.locator('[data-sonner-toast] :text("confirmed")')).toBeVisible({ timeout: 30000 })

    // Navigate to activity page
    await page.goto('/activity')
    await page.waitForSelector('h1', { timeout: 30000 })

    // Sales tab should be visible (default or click it)
    const salesTab = page.locator('button:has-text("Sales")')
    await salesTab.click()

    // Should show token #0070 in the sales table
    await expect(page.locator('text=0070')).toBeVisible({ timeout: 15000 })
  })

  test('activity offers tab shows correct token ID after offer', async ({ page }) => {
    await boostBalance(BUYER_ADDR)
    await setupWallet(page, BUYER)

    // Make offer on token 71 via UI
    await page.goto('/token/71')
    await page.waitForSelector('h1', { timeout: 30000 })
    await connectWallet(page)

    // const offerInput = page.locator('input[type="number"]').first()
    const offerInput = page.locator('input[placeholder*="offer" i]').first()
    await expect(offerInput).toBeVisible({ timeout: 10000 })
    await offerInput.fill('30000')

    const submitBtn = page.locator('button:has-text("Make Offer")')
    await submitBtn.click()
    await expect(page.locator('[data-sonner-toast] :text("confirmed")')).toBeVisible({ timeout: 30000 })

    // Navigate to activity page
    await page.goto('/activity')
    await page.waitForSelector('h1', { timeout: 30000 })

    const offersTab = page.locator('button:has-text("Offers")')
    await offersTab.click()

    // Should show token #0071 in the offers table
    await expect(page.locator('text=0071')).toBeVisible({ timeout: 15000 })
  })

  test('multiple sales show in activity sales feed', async ({ page }) => {
    // Buy two tokens via RPC
    await buyTokenViaRpc(80, BUYER_ADDR)
    await buyTokenViaRpc(81, BUYER_ADDR)

    await page.goto('/activity')
    await page.waitForSelector('h1', { timeout: 30000 })

    const salesTab = page.locator('button:has-text("Sales")')
    await salesTab.click()

    // Both tokens should appear
    await expect(page.locator('text=0080')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('text=0081')).toBeVisible({ timeout: 10000 })
  })

  test('three sales show correct count in activity', async ({ page }) => {
    await buyTokenViaRpc(84, BUYER_ADDR)
    await buyTokenViaRpc(85, BUYER_ADDR)
    await buyTokenViaRpc(86, BUYER_ADDR)

    await page.goto('/activity')
    await page.waitForSelector('h1', { timeout: 30000 })

    const salesTab = page.locator('button:has-text("Sales")')
    await salesTab.click()

    // Count text should show 3
    await expect(page.locator('text=/3.*total sales/')).toBeVisible({ timeout: 15000 })
    // All three should appear
    await expect(page.locator('text=0084')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=0085')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=0086')).toBeVisible({ timeout: 10000 })
    // Row count matches
    await expect(page.locator('table tbody tr')).toHaveCount(3, { timeout: 10000 })
  })

  test('three offers show correct count in activity', async ({ page }) => {
    await makeOfferViaRpc(87, 25000)
    await makeOfferViaRpc(88, 30000)
    const FOURTH_ADDR = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65'
    await rpc('hardhat_impersonateAccount', [FOURTH_ADDR])
    await rpc('hardhat_setBalance', [FOURTH_ADDR, '0xC9F2C9CD04674EDEA40000000'])
    const tokenHex = BigInt(89).toString(16).padStart(64, '0')
    const valueWei = '0x' + (BigInt('35000') * BigInt('1000000000000000000')).toString(16)
    await sendTx({
      from: FOURTH_ADDR,
      to: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
      data: '0x9a2f6474' + tokenHex,
      value: valueWei,
      gas: '0x200000',
    })
    await rpc('hardhat_stopImpersonatingAccount', [FOURTH_ADDR])

    await page.goto('/activity')
    await page.waitForSelector('h1', { timeout: 30000 })

    const offersTab = page.locator('button:has-text("Offers")')
    await offersTab.click()

    await expect(page.locator('text=/3 total offers/')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('text=0087')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=0088')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=0089')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('table tbody tr')).toHaveCount(3, { timeout: 10000 })
  })

  test('multiple offers show in activity offers feed', async ({ page }) => {
    // Make offers on two different tokens
    await makeOfferViaRpc(82, 25000)
    // THIRD makes offer on token 83
    await rpc('hardhat_impersonateAccount', [THIRD_ADDR])
    await rpc('hardhat_setBalance', [THIRD_ADDR, '0xC9F2C9CD04674EDEA40000000'])
    const tokenHex = BigInt(83).toString(16).padStart(64, '0')
    const valueWei = '0x' + (BigInt('30000') * BigInt('1000000000000000000')).toString(16)
    await sendTx({
      from: THIRD_ADDR,
      to: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
      data: '0x9a2f6474' + tokenHex, // makeOffer(uint256)
      value: valueWei,
      gas: '0x200000',
    })
    await rpc('hardhat_stopImpersonatingAccount', [THIRD_ADDR])

    await page.goto('/activity')
    await page.waitForSelector('h1', { timeout: 30000 })

    const offersTab = page.locator('button:has-text("Offers")')
    await offersTab.click()

    // Both offers should appear
    await expect(page.locator('text=0082')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('text=0083')).toBeVisible({ timeout: 10000 })

    // Verify total count shown matches actual rows
    const countText = await page.locator('text=/\\d+ total offers/').textContent()
    const expectedCount = parseInt(countText)
    await expect(page.locator('table tbody tr')).toHaveCount(expectedCount, { timeout: 10000 })
  })

  test('accept offer shows sale in activity', async ({ page }) => {
    // Setup: make offer as BUYER via RPC
    await boostBalance(BUYER_ADDR)
    await makeOfferViaRpc(72, 25000)

    // Accept as deployer via UI
    await setupWallet(page, DEPLOYER)
    await page.goto('/token/72')
    await page.waitForSelector('h1', { timeout: 30000 })
    await connectWallet(page)

    const acceptBtn = page.locator('button:has-text("Accept")')
    await expect(acceptBtn.first()).toBeVisible({ timeout: 15000 })
    await acceptBtn.first().click()
    await expect(page.locator('[data-sonner-toast] :text("confirmed")')).toBeVisible({ timeout: 30000 })

    // Navigate to activity — sale should appear
    await page.goto('/activity')
    await page.waitForSelector('h1', { timeout: 30000 })

    const salesTab = page.locator('button:has-text("Sales")')
    await salesTab.click()

    // Token #0072 should appear in sales
    await expect(page.locator('text=0072')).toBeVisible({ timeout: 15000 })
  })
})

// ════════════════════════════════════════════════════
// BROWSE PAGE
// ════════════════════════════════════════════════════

test.describe('Browse Page', () => {
  test('loads NFT grid', async ({ page }) => {
    await page.goto('/browse')
    await page.waitForSelector('h1', { timeout: 60000 })

    const cards = page.locator('[class*="grid"] a, [class*="grid"] [class*="card"]')
    await expect(cards.first()).toBeVisible({ timeout: 15000 })
  })

  test('For Sale tab filters correctly', async ({ page }) => {
    await page.goto('/browse')
    await expect(page.locator('h1:has-text("Browse Collection")')).toBeVisible({ timeout: 60000 })

    // Click the For Sale tab
    const forSaleTab = page.locator('button', { hasText: /For Sale/i }).first()
    await forSaleTab.click()

    // Should show NFT grid and URL should update
    const cards = page.locator('[class*="grid"] a, [class*="grid"] [class*="card"]')
    await expect(cards.first()).toBeVisible({ timeout: 30000 })
    expect(page.url().toLowerCase()).toContain('tab=forsale')
  })

  test('pagination works', async ({ page }) => {
    await page.goto('/browse')
    // Wait for grid to load
    const cards = page.locator('[class*="grid"] a, [class*="grid"] [class*="card"]')
    await expect(cards.first()).toBeVisible({ timeout: 30000 })

    const nextBtn = page.locator('button:has-text("Next"), button[aria-label="Next page"]')
    await expect(nextBtn).toBeVisible({ timeout: 10000 })
    await nextBtn.click()
    await page.waitForURL(/page=2/, { timeout: 10000 })
    expect(page.url()).toContain('page=2')
  })

  test('sort changes order', async ({ page }) => {
    await page.goto('/browse')
    const cards = page.locator('[class*="grid"] a, [class*="grid"] [class*="card"]')
    await expect(cards.first()).toBeVisible({ timeout: 30000 })

    const sortBtn = page.locator('button:has-text("Sort"), select, [class*="sort"]').first()
    await expect(sortBtn).toBeVisible({ timeout: 10000 })
    await sortBtn.click()
  })

  test('trait filter updates URL params', async ({ page }) => {
    await page.goto('/browse')
    const cards = page.locator('[class*="grid"] a, [class*="grid"] [class*="card"]')
    await expect(cards.first()).toBeVisible({ timeout: 30000 })

    const bgFilter = page.locator('button:has-text("Background"), summary:has-text("Background")')
    await expect(bgFilter).toBeVisible({ timeout: 10000 })
    await bgFilter.click()

    const firstTrait = page.locator('label, input[type="checkbox"]').nth(0)
    await expect(firstTrait).toBeVisible({ timeout: 5000 })
    await firstTrait.click()
    await page.waitForURL(/bg=/, { timeout: 10000 })
    expect(page.url()).toContain('bg=')
  })

  test('price range filter works on For Sale tab', async ({ page }) => {
    await page.goto('/browse?tab=forSale')
    const cards = page.locator('[class*="grid"] a, [class*="grid"] [class*="card"]')
    await expect(cards.first()).toBeVisible({ timeout: 30000 })

    const minInput = page.locator('input[placeholder*="min" i], input[placeholder*="Min" i]').first()
    await expect(minInput).toBeVisible({ timeout: 10000 })
    await minInput.fill('25000')
    await page.waitForURL(/pmin=25000/, { timeout: 10000 })
    expect(page.url()).toContain('pmin=25000')
  })

  test('NFT card click navigates to token detail', async ({ page }) => {
    await page.goto('/browse')
    const firstCard = page.locator('[class*="grid"] a').first()
    await expect(firstCard).toBeVisible({ timeout: 30000 })
    await firstCard.click()
    await page.waitForURL(/\/token\/\d+/, { timeout: 10000 })
    expect(page.url()).toMatch(/\/token\/\d+/)
  })
})

// ════════════════════════════════════════════════════
// HOME PAGE
// ════════════════════════════════════════════════════

test.describe('Home Page', () => {
  test('shows collection stats', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('h1', { timeout: 60000 })

    await expect(page.locator('text=/Floor Price|Volume|Minted|Owners/i').first()).toBeVisible({ timeout: 15000 })
  })

  test('Browse Collection link navigates to browse', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('h1', { timeout: 30000 })

    const browseLink = page.locator('a:has-text("Browse"), button:has-text("Browse")')
    await browseLink.first().click()
    await page.waitForURL(/\/browse/, { timeout: 10000 })
  })
})

// ════════════════════════════════════════════════════
// NAVIGATION & SEARCH
// ════════════════════════════════════════════════════

test.describe('Navigation & Search', () => {
  test('navbar links work', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('h1', { timeout: 60000 })

    await page.locator('nav a:has-text("Browse"), header a:has-text("Browse")').first().click()
    await page.waitForURL(/\/browse/, { timeout: 10000 })

    await page.locator('nav a:has-text("Activity"), header a:has-text("Activity")').first().click()
    await page.waitForURL(/\/activity/, { timeout: 10000 })
  })

  test('search by token ID navigates to token page', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('h1', { timeout: 30000 })

    const searchInput = page.locator('input[placeholder*="Search" i], input[placeholder*="Token ID" i]')
    await searchInput.fill('42')
    await searchInput.press('Enter')

    await page.waitForURL(/\/token\/42/, { timeout: 10000 })
  })

  test('search by address navigates to profile', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('h1', { timeout: 30000 })

    const searchInput = page.locator('input[placeholder*="Search" i], input[placeholder*="Token ID" i]')
    await searchInput.fill(DEPLOYER_ADDR)
    await searchInput.press('Enter')

    await page.waitForURL(new RegExp(`/profile/${DEPLOYER_ADDR}`, 'i'), { timeout: 10000 })
  })
})

// ════════════════════════════════════════════════════
// ADMIN PAGE
// ════════════════════════════════════════════════════

test.describe('Admin Page', () => {
  test('owner can see admin controls', async ({ page }) => {
    await setupWallet(page, DEPLOYER)
    await page.goto('/admin')
    await page.waitForSelector('h1', { timeout: 30000 })
    await connectWallet(page)

    await expect(page.locator('text=/Royalty|Ownership|Owner/i').first()).toBeVisible({ timeout: 15000 })
  })

  test('non-owner sees access denied on admin', async ({ page }) => {
    await setupWallet(page, BUYER)
    await page.goto('/admin')
    await page.waitForSelector('h1', { timeout: 30000 })
    await connectWallet(page)

    await expect(page.locator('text=/not.*owner|connect.*wallet/i').first()).toBeVisible({ timeout: 15000 })
  })
})

// ════════════════════════════════════════════════════
// ORIGINAL 1/1 NFT
// ════════════════════════════════════════════════════

const ORIGINAL_MARKETPLACE = '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9'
const ORIGINAL_NFT = '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9'
const ORIGINAL_OWNER = '0xb3C7c1c14f83f57370fcE247Ec359BE8584C3902'

// List the Original via RPC as the impersonated owner
async function listOriginalViaRpc(priceInEther) {
  // Impersonate original owner
  await rpc('hardhat_impersonateAccount', [ORIGINAL_OWNER])
  await rpc('hardhat_setBalance', [ORIGINAL_OWNER, '0xC9F2C9CD04674EDEA40000000'])

  // listOriginal(uint256 price)
  const [whole, frac = ''] = priceInEther.split('.')
  const weiStr = whole + frac.padEnd(18, '0')
  const priceHex = BigInt(weiStr).toString(16).padStart(64, '0')
  const data = '0xb74d4003' + priceHex // listOriginal(uint256)

  await sendTx({
    from: ORIGINAL_OWNER,
    to: ORIGINAL_MARKETPLACE,
    data,
    gas: '0x100000',
  })
  await rpc('hardhat_stopImpersonatingAccount', [ORIGINAL_OWNER])
}

// Transfer the Original NFT to a Hardhat account so we can use it in mock wallet
async function transferOriginalTo(toAddress) {
  await rpc('hardhat_impersonateAccount', [ORIGINAL_OWNER])
  await rpc('hardhat_setBalance', [ORIGINAL_OWNER, '0xC9F2C9CD04674EDEA40000000'])

  // transferFrom(address from, address to, uint256 tokenId)
  const from = ORIGINAL_OWNER.slice(2).toLowerCase().padStart(64, '0')
  const to = toAddress.slice(2).toLowerCase().padStart(64, '0')
  const tokenId = '0000000000000000000000000000000000000000000000000000000000000001'
  const data = '0x23b872dd' + from + to + tokenId

  await sendTx({
    from: ORIGINAL_OWNER,
    to: ORIGINAL_NFT,
    data,
    gas: '0x100000',
  })
  await rpc('hardhat_stopImpersonatingAccount', [ORIGINAL_OWNER])
}

// Approve marketplace as operator on OriginalNFT (via RPC impersonation)
async function approveMarketplaceViaRpc(ownerAddress) {
  await rpc('hardhat_impersonateAccount', [ownerAddress])
  await rpc('hardhat_setBalance', [ownerAddress, '0xC9F2C9CD04674EDEA40000000'])

  // setApprovalForAll(address operator, bool approved)
  const operator = ORIGINAL_MARKETPLACE.slice(2).toLowerCase().padStart(64, '0')
  const approved = '0000000000000000000000000000000000000000000000000000000000000001'
  const data = '0xa22cb465' + operator + approved

  await sendTx({
    from: ownerAddress,
    to: ORIGINAL_NFT,
    data,
    gas: '0x100000',
  })
  await rpc('hardhat_stopImpersonatingAccount', [ownerAddress])
}

// Revoke marketplace approval on OriginalNFT (via RPC impersonation)
async function revokeMarketplaceViaRpc(ownerAddress) {
  await rpc('hardhat_impersonateAccount', [ownerAddress])
  await rpc('hardhat_setBalance', [ownerAddress, '0xC9F2C9CD04674EDEA40000000'])

  // setApprovalForAll(address operator, bool approved = false)
  const operator = ORIGINAL_MARKETPLACE.slice(2).toLowerCase().padStart(64, '0')
  const approved = '0000000000000000000000000000000000000000000000000000000000000000'
  const data = '0xa22cb465' + operator + approved

  await sendTx({
    from: ownerAddress,
    to: ORIGINAL_NFT,
    data,
    gas: '0x100000',
  })
  await rpc('hardhat_stopImpersonatingAccount', [ownerAddress])
}

// Delist original via RPC
async function delistOriginalViaRpc(ownerAddress) {
  await rpc('hardhat_impersonateAccount', [ownerAddress])
  await rpc('hardhat_setBalance', [ownerAddress, '0xC9F2C9CD04674EDEA40000000'])

  const data = '0xd07726db' // delistOriginal()

  await sendTx({
    from: ownerAddress,
    to: ORIGINAL_MARKETPLACE,
    data,
    gas: '0x100000',
  })
  await rpc('hardhat_stopImpersonatingAccount', [ownerAddress])
}

// List original as a specific owner (who already has NFT + approval)
async function listOriginalAsViaRpc(ownerAddress, priceInEther) {
  await rpc('hardhat_impersonateAccount', [ownerAddress])
  await rpc('hardhat_setBalance', [ownerAddress, '0xC9F2C9CD04674EDEA40000000'])

  const [whole, frac = ''] = priceInEther.split('.')
  const weiStr = whole + frac.padEnd(18, '0')
  const priceHex = BigInt(weiStr).toString(16).padStart(64, '0')
  const data = '0xb74d4003' + priceHex // listOriginal(uint256)

  await sendTx({
    from: ownerAddress,
    to: ORIGINAL_MARKETPLACE,
    data,
    gas: '0x100000',
  })
  await rpc('hardhat_stopImpersonatingAccount', [ownerAddress])
}

async function makeOriginalOfferViaRpc(fromAddress, amountInEther) {
  await rpc('hardhat_impersonateAccount', [fromAddress])
  await rpc('hardhat_setBalance', [fromAddress, '0xC9F2C9CD04674EDEA40000000'])
  const valueWei = '0x' + (BigInt(amountInEther) * BigInt('1000000000000000000')).toString(16)
  await sendTx({
    from: fromAddress,
    to: ORIGINAL_MARKETPLACE,
    data: '0xa8e3f8cf', // makeOriginalOffer()
    value: valueWei,
    gas: '0x200000',
  })
  await rpc('hardhat_stopImpersonatingAccount', [fromAddress])
}

test.describe('Original 1/1 NFT', () => {
  test('original page loads and shows token info', async ({ page }) => {
    await setupWallet(page, BUYER)
    await page.goto('/token/original')
    await page.waitForSelector('h1', { timeout: 30000 })

    await expect(page.locator('h1')).toHaveText('Ethereum Killer — The Original')
    await expect(page.locator('text=/Original 1\\/1/i')).toBeVisible()
    await expect(page.locator('img[alt="Ethereum Killer — The Original"]')).toBeVisible()
  })

  test('browse page shows Original card', async ({ page }) => {
    await setupWallet(page, BUYER)
    await page.goto('/browse')
    await page.waitForSelector('h1', { timeout: 30000 })

    const originalCard = page.locator('a[href="/token/original"]')
    await expect(originalCard).toBeVisible({ timeout: 15000 })
    await expect(originalCard.locator('text=/Original.*1 of 1/i')).toBeVisible()
  })

  test('original page shows not listed when not for sale', async ({ page }) => {
    await setupWallet(page, BUYER)
    await page.goto('/token/original')
    await page.waitForSelector('h1', { timeout: 30000 })
    await connectWallet(page)

    // Should show "Make an Offer" section but no "Buy Now"
    await expect(page.locator('text=/Make an Offer/i')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('button:has-text("Buy Now")')).not.toBeVisible()
  })

  test('non-owner can make and cancel an offer', async ({ page }) => {
    await boostBalance(BUYER_ADDR)
    await setupWallet(page, BUYER)
    await page.goto('/token/original')
    await page.waitForSelector('h1', { timeout: 30000 })
    await connectWallet(page)

    // Make offer
    const offerInput = page.locator('input[placeholder*="Offer"]').first()
    await expect(offerInput).toBeVisible({ timeout: 15000 })
    await offerInput.fill('30000')
    await page.locator('button:has-text("Make Offer")').click()
    await waitForTx(page)

    // Verify offer shows
    await expect(page.locator('text=/30,000/').first()).toBeVisible({ timeout: 15000 })

    // Cancel offer
    await page.locator('button:has-text("Withdraw Offer")').click()
    await waitForTx(page)

    // Offer should be gone
    await expect(page.locator('text=/Your offer/i')).not.toBeVisible({ timeout: 10000 })
  })

  test('non-owner can update offer with higher amount', async ({ page }) => {
    // Make initial offer via RPC
    await makeOriginalOfferViaRpc(BUYER_ADDR, '30000')

    await setupWallet(page, BUYER)
    await page.goto('/token/original')
    await page.waitForSelector('h1', { timeout: 30000 })
    await connectWallet(page)

    // Should see existing offer and Withdraw button
    await expect(page.locator('text=/Your offer/i')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('button:has-text("Withdraw Offer")')).toBeVisible({ timeout: 10000 })

    // Fill higher offer
    const offerInput = page.locator('input[placeholder*="offer" i]').first()
    await expect(offerInput).toBeVisible({ timeout: 10000 })
    await offerInput.fill('50000')

    // Click Update Offer
    const updateBtn = page.locator('button:has-text("Update Offer")')
    await expect(updateBtn).toBeVisible({ timeout: 10000 })
    await updateBtn.click()
    await waitForTx(page)

    // Should show updated amount
    await expect(page.locator('text=/50,000/').first()).toBeVisible({ timeout: 15000 })
  })

  test('multiple bidders can make offers on original', async ({ page }) => {
    // Two bidders make offers via RPC
    await makeOriginalOfferViaRpc(BUYER_ADDR, '30000')
    await makeOriginalOfferViaRpc(THIRD_ADDR, '40000')

    // Owner views incoming offers
    await transferOriginalTo(DEPLOYER_ADDR)
    await approveMarketplaceViaRpc(DEPLOYER_ADDR)

    await setupWallet(page, DEPLOYER)
    await page.goto('/token/original')
    await page.waitForSelector('h1', { timeout: 30000 })
    await connectWallet(page)

    // Should see Incoming Offers with both bidders
    await expect(page.locator('text=/Incoming Offers/i')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('text=/30,000/')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=/40,000/')).toBeVisible({ timeout: 10000 })
  })

  test('three bidders make offers on original with all visible', async ({ page }) => {
    const FOURTH_ADDR = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65'
    await makeOriginalOfferViaRpc(BUYER_ADDR, '30000')
    await makeOriginalOfferViaRpc(THIRD_ADDR, '40000')
    await makeOriginalOfferViaRpc(FOURTH_ADDR, '50000')

    await transferOriginalTo(DEPLOYER_ADDR)
    await approveMarketplaceViaRpc(DEPLOYER_ADDR)

    await setupWallet(page, DEPLOYER)
    await page.goto('/token/original')
    await page.waitForSelector('h1', { timeout: 30000 })
    await connectWallet(page)

    await expect(page.locator('text=/Incoming Offers/i')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('text=/30,000/')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=/40,000/')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=/50,000/')).toBeVisible({ timeout: 10000 })
  })

  test('owner sees approve marketplace warning when not approved', async ({ page }) => {
    // Transfer NFT to DEPLOYER so we can use mock wallet, then revoke approval
    await transferOriginalTo(DEPLOYER_ADDR)
    await revokeMarketplaceViaRpc(DEPLOYER_ADDR)

    await setupWallet(page, DEPLOYER)
    await page.goto('/token/original')
    await page.waitForSelector('h1', { timeout: 30000 })
    await connectWallet(page)

    // Should see the yellow approve warning
    await expect(page.locator('text=/Marketplace not approved/i')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('button:has-text("Approve Marketplace")')).toBeVisible()
    // Should NOT see "Manage Listing" yet
    await expect(page.locator('text=/Manage Listing/i')).not.toBeVisible()
  })

  test('owner approves marketplace and sees manage listing', async ({ page }) => {
    // Transfer NFT to DEPLOYER, revoke approval
    await transferOriginalTo(DEPLOYER_ADDR)
    await revokeMarketplaceViaRpc(DEPLOYER_ADDR)

    await setupWallet(page, DEPLOYER)
    await page.goto('/token/original')
    await page.waitForSelector('h1', { timeout: 30000 })
    await connectWallet(page)

    // Click approve
    await expect(page.locator('button:has-text("Approve Marketplace")')).toBeVisible({ timeout: 15000 })
    await page.locator('button:has-text("Approve Marketplace")').click()
    await waitForTx(page)

    // After approval, "Manage Listing" should appear
    await expect(page.locator('text=/Manage Listing/i')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('text=/Marketplace not approved/i')).not.toBeVisible()
  })

  test('owner lists, updates price, and delists', async ({ page }) => {
    // Transfer NFT to DEPLOYER with approval
    await transferOriginalTo(DEPLOYER_ADDR)
    await approveMarketplaceViaRpc(DEPLOYER_ADDR)

    await setupWallet(page, DEPLOYER)
    await page.goto('/token/original')
    await page.waitForSelector('h1', { timeout: 30000 })
    await connectWallet(page)

    // List at 50,000 XDC
    await expect(page.locator('text=/Manage Listing/i')).toBeVisible({ timeout: 15000 })
    const priceInput = page.locator('input[placeholder*="Price in XDC"]').first()
    await priceInput.fill('50000')
    await page.locator('button:has-text("List for Sale")').click()
    await waitForTx(page)

    // Verify price shows
    await expect(page.locator('text=/50,000/')).toBeVisible({ timeout: 15000 })

    // Update price to 75,000
    const updateInput = page.locator('input[placeholder*="New price"]').first()
    await expect(updateInput).toBeVisible({ timeout: 15000 })
    await updateInput.fill('75000')
    await page.locator('button:has-text("Update Price")').click()
    await waitForTx(page)

    // Verify new price
    await expect(page.locator('text=/75,000/')).toBeVisible({ timeout: 15000 })

    // Delist
    await page.locator('button:has-text("Remove from Sale")').click()
    await waitForTx(page)

    // Price section should be gone
    await expect(page.locator('text=/Current Price/i')).not.toBeVisible({ timeout: 10000 })
    // Manage Listing should still be visible (marketplace still approved)
    await expect(page.locator('text=/Manage Listing/i')).toBeVisible()
    // Should show "List for Sale" again, not the approve warning
    await expect(page.locator('button:has-text("List for Sale")')).toBeVisible()
    await expect(page.locator('text=/Marketplace not approved/i')).not.toBeVisible()
  })

  test('non-owner can buy when listed', async ({ page }) => {
    // List via RPC at 50,000
    await listOriginalViaRpc('50000')
    await boostBalance(BUYER_ADDR)

    await setupWallet(page, BUYER)
    await page.goto('/token/original')
    await page.waitForSelector('h1', { timeout: 30000 })
    await connectWallet(page)

    // Should see price and Buy Now
    await expect(page.locator('text=/50,000/')).toBeVisible({ timeout: 15000 })
    await page.locator('button:has-text("Buy Now")').click()
    await waitForTx(page)

    // After purchase, should show "Owned by you"
    await expect(page.locator('text=/Owned by.*you/i')).toBeVisible({ timeout: 15000 })
    // Sales history should have 1 entry
    await expect(page.locator('text=/Sales History.*1/i')).toBeVisible({ timeout: 10000 })
  })

  test('browse page shows live price when listed', async ({ page }) => {
    await listOriginalViaRpc('50000')

    await setupWallet(page, BUYER)
    await page.goto('/browse')
    await page.waitForSelector('h1', { timeout: 30000 })

    const originalCard = page.locator('a[href="/token/original"]')
    await expect(originalCard).toBeVisible({ timeout: 15000 })
    // Should show the price on the card
    await expect(originalCard.locator('text=/50,000.*XDC/i')).toBeVisible({ timeout: 15000 })
  })

  test('profile page shows Original when owned', async ({ page }) => {
    // Transfer to DEPLOYER
    await transferOriginalTo(DEPLOYER_ADDR)

    await setupWallet(page, DEPLOYER)
    await page.goto(`/profile/${DEPLOYER_ADDR}`)
    await page.waitForSelector('h1', { timeout: 30000 })
    await connectWallet(page)

    // Should see Original card in NFTs tab
    const originalCard = page.locator('a[href="/token/original"]')
    await expect(originalCard).toBeVisible({ timeout: 15000 })
    await expect(originalCard.locator('text=/Original 1\\/1/i')).toBeVisible()
  })

  test('profile page shows Original above regular NFTs', async ({ page }) => {
    // DEPLOYER owns the 10k collection NFTs — transfer Original to them too
    await transferOriginalTo(DEPLOYER_ADDR)

    await setupWallet(page, DEPLOYER)
    await page.goto(`/profile/${DEPLOYER_ADDR}`)
    await page.waitForSelector('h1', { timeout: 30000 })
    await connectWallet(page)

    // Original card should be pinned above the grid
    const originalCard = page.locator('a[href="/token/original"]')
    await expect(originalCard).toBeVisible({ timeout: 15000 })

    // NFT grid should also be visible with regular tokens
    const nftGrid = page.locator('[class*="grid"]').first()
    await expect(nftGrid).toBeVisible({ timeout: 15000 })

    // Original card should come before the grid in DOM order
    const originalBox = await originalCard.boundingBox()
    const gridBox = await nftGrid.boundingBox()
    expect(originalBox.y).toBeLessThan(gridBox.y)
  })

  test('profile page does not show Original when not owned', async ({ page }) => {
    // BUYER does not own the Original (it stays with ORIGINAL_OWNER)
    await setupWallet(page, BUYER)
    await page.goto(`/profile/${BUYER_ADDR}`)
    await page.waitForSelector('h1', { timeout: 30000 })
    await connectWallet(page)

    // Original card should NOT be visible
    await expect(page.locator('a[href="/token/original"]')).not.toBeVisible({ timeout: 5000 })
  })

  test('new owner must approve marketplace after buying', async ({ page }) => {
    // List via RPC, BUYER buys through UI
    await listOriginalViaRpc('50000')
    await boostBalance(BUYER_ADDR)

    await setupWallet(page, BUYER)
    await page.goto('/token/original')
    await page.waitForSelector('h1', { timeout: 30000 })
    await connectWallet(page)

    // Buy it
    await expect(page.locator('button:has-text("Buy Now")')).toBeVisible({ timeout: 15000 })
    await page.locator('button:has-text("Buy Now")').click()
    await waitForTx(page)

    // Now BUYER is the new owner — should see approve warning (not manage listing)
    await expect(page.locator('text=/Marketplace not approved/i')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('text=/Manage Listing/i')).not.toBeVisible()
  })

  test('browse page shows View arrow when not listed', async ({ page }) => {
    // Original is not listed by default
    await setupWallet(page, BUYER)
    await page.goto('/browse')
    await page.waitForSelector('h1', { timeout: 30000 })

    const originalCard = page.locator('a[href="/token/original"]')
    await expect(originalCard).toBeVisible({ timeout: 15000 })
    // Should show "View →" not a price
    await expect(originalCard.locator('text=/View/i')).toBeVisible()
    await expect(originalCard.locator('text=/XDC/i')).not.toBeVisible()
  })

  test('min price validation prevents listing below 25000', async ({ page }) => {
    // Transfer to DEPLOYER with approval
    await transferOriginalTo(DEPLOYER_ADDR)
    await approveMarketplaceViaRpc(DEPLOYER_ADDR)

    await setupWallet(page, DEPLOYER)
    await page.goto('/token/original')
    await page.waitForSelector('h1', { timeout: 30000 })
    await connectWallet(page)

    await expect(page.locator('text=/Manage Listing/i')).toBeVisible({ timeout: 15000 })
    const priceInput = page.locator('input[placeholder*="Price in XDC"]').first()
    await priceInput.fill('10000')

    // Should show min price error
    await expect(page.locator('text=/Minimum price is 25,000/i')).toBeVisible({ timeout: 5000 })
    // List button should be disabled
    await expect(page.locator('button:has-text("List for Sale")')).toBeDisabled()
  })

  test('owner sees incoming offers and can accept', async ({ page }) => {
    // Transfer to DEPLOYER, approve marketplace
    await transferOriginalTo(DEPLOYER_ADDR)
    await approveMarketplaceViaRpc(DEPLOYER_ADDR)
    await boostBalance(BUYER_ADDR)

    // BUYER makes offer via RPC
    await rpc('hardhat_impersonateAccount', [BUYER_ADDR])
    const offerWei = '0x' + (BigInt('30000') * BigInt('1000000000000000000')).toString(16)
    await sendTx({
      from: BUYER_ADDR,
      to: ORIGINAL_MARKETPLACE,
      data: '0xa8e3f8cf', // makeOriginalOffer()
      value: offerWei,
      gas: '0x100000',
    })
    await rpc('hardhat_stopImpersonatingAccount', [BUYER_ADDR])

    // Owner visits page
    await setupWallet(page, DEPLOYER)
    await page.goto('/token/original')
    await page.waitForSelector('h1', { timeout: 30000 })
    await connectWallet(page)

    // Should see "Incoming Offers" section
    await expect(page.locator('text=/Incoming Offers/i')).toBeVisible({ timeout: 15000 })
    // Should see the offer amount
    await expect(page.locator('text=/30,000/')).toBeVisible({ timeout: 10000 })
    // Should see Accept button
    const acceptBtn = page.locator('button:has-text("Accept")')
    await expect(acceptBtn).toBeVisible()

    // Accept the offer
    await acceptBtn.click()
    await waitForTx(page)

    // After accept, DEPLOYER no longer owns it — should see offer section is gone
    // and "Owned by" should change
    await expect(page.locator('text=/Incoming Offers/i')).not.toBeVisible({ timeout: 10000 })
    // Sales history should show 1 entry
    await expect(page.locator('text=/Sales History.*1/i')).toBeVisible({ timeout: 10000 })
  })

  test('owner can list at 100,000,000 XDC', async ({ page }) => {
    await transferOriginalTo(DEPLOYER_ADDR)
    await approveMarketplaceViaRpc(DEPLOYER_ADDR)

    await setupWallet(page, DEPLOYER)
    await page.goto('/token/original')
    await page.waitForSelector('h1', { timeout: 30000 })
    await connectWallet(page)

    // List at 100,000,000 XDC
    await expect(page.locator('text=/Manage Listing/i')).toBeVisible({ timeout: 15000 })
    const priceInput = page.locator('input[placeholder*="Price in XDC"]').first()
    await priceInput.fill('100000000')
    await page.locator('button:has-text("List for Sale")').click()
    await waitForTx(page)

    // Verify the large price displays correctly
    await expect(page.locator('text=/100,000,000/')).toBeVisible({ timeout: 15000 })
  })

  test('multiple original sales show in sales history', async ({ page }) => {
    // Sale 1: list and buy as BUYER
    await listOriginalViaRpc('50000')
    await rpc('hardhat_impersonateAccount', [BUYER_ADDR])
    await rpc('hardhat_setBalance', [BUYER_ADDR, '0xC9F2C9CD04674EDEA40000000'])
    const price1Wei = '0x' + (BigInt('50000') * BigInt('1000000000000000000')).toString(16)
    const price1Hex = (BigInt('50000') * BigInt('1000000000000000000')).toString(16).padStart(64, '0')
    await sendTx({
      from: BUYER_ADDR,
      to: ORIGINAL_MARKETPLACE,
      data: '0x697bc66d' + price1Hex,
      value: price1Wei,
      gas: '0x200000',
    })
    await rpc('hardhat_stopImpersonatingAccount', [BUYER_ADDR])

    // Sale 2: BUYER lists, THIRD buys
    await approveMarketplaceViaRpc(BUYER_ADDR)
    await listOriginalAsViaRpc(BUYER_ADDR, '60000')
    await rpc('hardhat_impersonateAccount', [THIRD_ADDR])
    await rpc('hardhat_setBalance', [THIRD_ADDR, '0xC9F2C9CD04674EDEA40000000'])
    const price2Wei = '0x' + (BigInt('60000') * BigInt('1000000000000000000')).toString(16)
    const price2Hex = (BigInt('60000') * BigInt('1000000000000000000')).toString(16).padStart(64, '0')
    await sendTx({
      from: THIRD_ADDR,
      to: ORIGINAL_MARKETPLACE,
      data: '0x697bc66d' + price2Hex,
      value: price2Wei,
      gas: '0x200000',
    })
    await rpc('hardhat_stopImpersonatingAccount', [THIRD_ADDR])

    // View original page — should show 2 sales
    await page.goto('/token/original')
    await page.waitForSelector('h1', { timeout: 30000 })
    await expect(page.locator('text=/Sales History.*\\(2\\)/i')).toBeVisible({ timeout: 15000 })
  })

  test('multiple original sales show in activity feed', async ({ page }) => {
    // Same setup: 2 sales
    await listOriginalViaRpc('50000')
    await rpc('hardhat_impersonateAccount', [BUYER_ADDR])
    await rpc('hardhat_setBalance', [BUYER_ADDR, '0xC9F2C9CD04674EDEA40000000'])
    const price1Wei = '0x' + (BigInt('50000') * BigInt('1000000000000000000')).toString(16)
    const price1Hex = (BigInt('50000') * BigInt('1000000000000000000')).toString(16).padStart(64, '0')
    await sendTx({
      from: BUYER_ADDR,
      to: ORIGINAL_MARKETPLACE,
      data: '0x697bc66d' + price1Hex,
      value: price1Wei,
      gas: '0x200000',
    })
    await rpc('hardhat_stopImpersonatingAccount', [BUYER_ADDR])

    await approveMarketplaceViaRpc(BUYER_ADDR)
    await listOriginalAsViaRpc(BUYER_ADDR, '60000')
    await rpc('hardhat_impersonateAccount', [THIRD_ADDR])
    await rpc('hardhat_setBalance', [THIRD_ADDR, '0xC9F2C9CD04674EDEA40000000'])
    const price2Wei = '0x' + (BigInt('60000') * BigInt('1000000000000000000')).toString(16)
    const price2Hex = (BigInt('60000') * BigInt('1000000000000000000')).toString(16).padStart(64, '0')
    await sendTx({
      from: THIRD_ADDR,
      to: ORIGINAL_MARKETPLACE,
      data: '0x697bc66d' + price2Hex,
      value: price2Wei,
      gas: '0x200000',
    })
    await rpc('hardhat_stopImpersonatingAccount', [THIRD_ADDR])

    await page.goto('/activity')
    await page.waitForSelector('h1', { timeout: 30000 })

    // Sales tab should show Original 1/1 Sales section with 2 rows
    await expect(page.locator('text=/Original 1\\/1 Sales/i')).toBeVisible({ timeout: 15000 })
    const originalRows = page.locator('table:near(:text("Original 1/1 Sales")) tbody tr')
    await expect(originalRows).toHaveCount(2, { timeout: 10000 })
  })

  test('sale appears in activity feed', async ({ page }) => {
    // List and buy via RPC
    await listOriginalViaRpc('50000')
    await boostBalance(BUYER_ADDR)

    // Buy via RPC as BUYER
    await rpc('hardhat_impersonateAccount', [BUYER_ADDR])
    const priceWei = '0x' + (BigInt('50000') * BigInt('1000000000000000000')).toString(16)
    const priceHex = (BigInt('50000') * BigInt('1000000000000000000')).toString(16).padStart(64, '0')
    const data = '0x697bc66d' + priceHex // buyOriginal(uint256 expectedPrice)
    await sendTx({
      from: BUYER_ADDR,
      to: ORIGINAL_MARKETPLACE,
      data,
      value: priceWei,
      gas: '0x200000',
    })
    await rpc('hardhat_stopImpersonatingAccount', [BUYER_ADDR])

    await setupWallet(page, BUYER)
    await page.goto('/activity')
    await page.waitForSelector('h1', { timeout: 30000 })

    // Should see "Original 1/1 Sales" section
    await expect(page.locator('text=/Original 1\\/1 Sales/i')).toBeVisible({ timeout: 15000 })
    // Should see the Original sale entry
    await expect(page.locator('a[href="/token/original"]:has-text("Original")')).toBeVisible({ timeout: 10000 })
  })
})
