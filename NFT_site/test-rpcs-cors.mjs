import { firefox } from 'playwright'

const RPCS = [
  'https://erpc.xinfin.network',
  'https://rpc.ankr.com/xdc',
  'https://erpc.xdcrpc.com',
  'https://xdc.public-rpc.com',
  'https://rpc.primenumbers.xyz',
]

const browser = await firefox.launch({ headless: true })
const ctx = await browser.newContext()
const page = await ctx.newPage()

// Navigate to any local page so we have an origin to make cross-origin requests from
await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })

console.log('Testing each RPC with a CORS fetch from http://localhost:3000 in Firefox...\n')

for (const rpc of RPCS) {
  const result = await page.evaluate(async (url) => {
    const t0 = Date.now()
    try {
      const r = await Promise.race([
        fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
        }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout-10s')), 10000)),
      ])
      const j = await r.json()
      return { ok: true, status: r.status, duration: Date.now() - t0, block: j.result }
    } catch (e) {
      return { ok: false, error: e.message, duration: Date.now() - t0 }
    }
  }, rpc)
  const tag = result.ok ? 'OK' : 'FAIL'
  console.log(`  ${tag.padEnd(5)} ${rpc.padEnd(40)} ${result.duration}ms  ${result.ok ? 'block=' + result.block : result.error}`)
}

await browser.close()
