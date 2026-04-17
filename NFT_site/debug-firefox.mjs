import { firefox } from 'playwright'

const browser = await firefox.launch({ headless: true })
const context = await browser.newContext()
const page = await context.newPage()

const rpcCalls = []
page.on('request', req => {
  const url = req.url()
  if (/xinfin|ankr|xdcrpc|public-rpc|primenumbers/.test(url)) {
    rpcCalls.push({
      url,
      method: req.method(),
      body: req.method() === 'POST' ? req.postData() : null,
      time: Date.now(),
      settled: false,
      duration: null,
      status: null,
      failure: null,
    })
  }
})

page.on('response', res => {
  const url = res.url()
  if (!/xinfin|ankr|xdcrpc|public-rpc|primenumbers/.test(url)) return
  const match = rpcCalls.find(c => c.url === url && !c.settled)
  if (match) {
    match.settled = true
    match.duration = Date.now() - match.time
    match.status = res.status()
  }
})

page.on('requestfailed', req => {
  const url = req.url()
  if (!/xinfin|ankr|xdcrpc|public-rpc|primenumbers/.test(url)) return
  const match = rpcCalls.find(c => c.url === url && !c.settled)
  if (match) {
    match.failure = req.failure()?.errorText || 'unknown'
    match.duration = Date.now() - match.time
  }
})

const errors = []
page.on('pageerror', err => errors.push(err.message))

const consoleMsgs = []
page.on('console', msg => consoleMsgs.push(`[${msg.type()}] ${msg.text()}`))

console.log('Opening http://localhost:3000/browse in Firefox...')
const startTime = Date.now()

try {
  await page.goto('http://localhost:3000/browse', { waitUntil: 'domcontentloaded', timeout: 60000 })
  console.log(`DOM loaded in ${Date.now() - startTime}ms`)
} catch (e) {
  console.log(`Navigation failed after ${Date.now() - startTime}ms: ${e.message}`)
}

// Longer wait to see if they eventually resolve
await page.waitForTimeout(20000)

console.log(`\n=== Total RPC req/resp events: ${rpcCalls.length} ===`)
console.log('\n=== Per-request timeline ===')
rpcCalls.forEach((c, i) => {
  const status = c.failure ? `FAILED: ${c.failure}` :
                  c.settled ? `${c.status} in ${c.duration}ms` :
                  `PENDING after ${Date.now() - c.time}ms`
  const host = new URL(c.url).host
  let label = c.method
  if (c.body) {
    try {
      const j = JSON.parse(c.body)
      const arr = Array.isArray(j) ? j : [j]
      label = `${c.method} [${arr.map(x => `${x.method}(${(x.params?.[0]?.data || '').slice(0, 10)})`).join(', ')}]`
    } catch {}
  }
  console.log(`  [${i.toString().padStart(2)}] ${status.padEnd(40)} ${host} ${label.slice(0, 120)}`)
})

// Test: can we fetch the RPC directly from the page context?
console.log('\n=== Direct fetch test from page context ===')
try {
  const result = await page.evaluate(async () => {
    const t0 = Date.now()
    try {
      const r = await fetch('https://erpc.xinfin.network', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
      })
      const j = await r.json()
      return { ok: true, status: r.status, duration: Date.now() - t0, body: j }
    } catch (e) {
      return { ok: false, error: e.message, duration: Date.now() - t0 }
    }
  })
  console.log('  ', JSON.stringify(result))
} catch (e) {
  console.log('  direct fetch threw:', e.message)
}

console.log('\n=== Page errors ===')
errors.forEach(e => console.log('  ' + e))

console.log('\n=== Console (last 20) ===')
consoleMsgs.slice(-20).forEach(m => console.log('  ' + m))

await browser.close()
