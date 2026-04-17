import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { waitForDcentProvider } from '../../lib/dcentWallet'

describe('waitForDcentProvider', () => {
  let originalWindow

  beforeEach(() => {
    // Reset window.ethereum before each test
    delete globalThis.window
    globalThis.window = {
      ethereum: undefined,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns provider immediately if isDcentWallet is already set (sync injection)', async () => {
    const mockProvider = { isDcentWallet: true, request: vi.fn() }
    window.ethereum = mockProvider

    const result = await waitForDcentProvider(1000)
    expect(result).toBe(mockProvider)
  })

  it('returns null if no provider after timeout (desktop — not in D\'CENT browser)', async () => {
    window.ethereum = undefined

    const result = await waitForDcentProvider(200)
    expect(result).toBe(null)
  })

  it('returns null if provider exists but isDcentWallet is false (other wallet installed)', async () => {
    window.ethereum = { isMetaMask: true }

    const result = await waitForDcentProvider(200)
    expect(result).toBe(null)
  })

  it('detects async injection via ethereum#initialized event', async () => {
    window.ethereum = undefined

    // Capture the event listener
    let eventHandler
    window.addEventListener = vi.fn((event, handler) => {
      if (event === 'ethereum#initialized') {
        eventHandler = handler
      }
    })
    window.removeEventListener = vi.fn()

    const promise = waitForDcentProvider(3000)

    // Simulate async injection after 50ms
    setTimeout(() => {
      window.ethereum = { isDcentWallet: true, request: vi.fn() }
      eventHandler()
    }, 50)

    const result = await promise
    expect(result).toBe(window.ethereum)
    expect(result.isDcentWallet).toBe(true)
    expect(window.removeEventListener).toHaveBeenCalledWith('ethereum#initialized', eventHandler)
  })

  it('detects async injection via polling when event missed', async () => {
    window.ethereum = undefined

    // addEventListener does nothing (simulates event already fired before listener attached)
    window.addEventListener = vi.fn()
    window.removeEventListener = vi.fn()

    const promise = waitForDcentProvider(3000)

    // Simulate provider appearing after 150ms (event already fired, polling catches it)
    setTimeout(() => {
      window.ethereum = { isDcentWallet: true, request: vi.fn() }
    }, 150)

    const result = await promise
    expect(result).toBe(window.ethereum)
    expect(result.isDcentWallet).toBe(true)
  })

  it('does not resolve twice if both event and poll detect provider', async () => {
    window.ethereum = undefined

    let eventHandler
    window.addEventListener = vi.fn((event, handler) => {
      if (event === 'ethereum#initialized') {
        eventHandler = handler
      }
    })
    window.removeEventListener = vi.fn()

    const promise = waitForDcentProvider(3000)

    // Provider appears
    setTimeout(() => {
      window.ethereum = { isDcentWallet: true, request: vi.fn() }
      // Both event and poll could fire — only one should resolve
      eventHandler()
    }, 50)

    const result = await promise
    expect(result.isDcentWallet).toBe(true)
    // Should clean up — removeEventListener called
    expect(window.removeEventListener).toHaveBeenCalled()
  })

  it('cleans up event listener and interval on timeout', async () => {
    window.ethereum = undefined
    window.addEventListener = vi.fn()
    window.removeEventListener = vi.fn()

    const result = await waitForDcentProvider(200)

    expect(result).toBe(null)
    expect(window.removeEventListener).toHaveBeenCalledWith(
      'ethereum#initialized',
      expect.any(Function)
    )
  })

  it('respects custom timeout value', async () => {
    window.ethereum = undefined
    window.addEventListener = vi.fn()
    window.removeEventListener = vi.fn()

    const start = Date.now()
    const result = await waitForDcentProvider(100)
    const elapsed = Date.now() - start

    expect(result).toBe(null)
    expect(elapsed).toBeGreaterThanOrEqual(90)
    expect(elapsed).toBeLessThan(300)
  })

  it('returns null in SSR environment (no window)', async () => {
    // Simulate SSR — no window
    delete globalThis.window

    const result = await waitForDcentProvider(100)
    expect(result).toBe(null)
  })
})
