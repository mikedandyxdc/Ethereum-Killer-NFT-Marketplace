import { createConnector } from 'wagmi'

// Wait for D'CENT provider with event listener + timeout (same pattern as @metamask/detect-provider)
async function waitForDcentProvider(timeout = 3000) {
  // Already there (sync injection)
  if (typeof window !== 'undefined' && window.ethereum?.isDcentWallet) {
    return window.ethereum
  }

  // Wait for async injection
  if (typeof window === 'undefined') return null

  return new Promise((resolve) => {
    let resolved = false

    const handler = () => {
      if (window.ethereum?.isDcentWallet && !resolved) {
        resolved = true
        window.removeEventListener('ethereum#initialized', handler)
        resolve(window.ethereum)
      }
    }

    window.addEventListener('ethereum#initialized', handler)

    // Also poll in case event was already fired before we started listening
    const interval = setInterval(() => {
      if (window.ethereum?.isDcentWallet && !resolved) {
        resolved = true
        clearInterval(interval)
        window.removeEventListener('ethereum#initialized', handler)
        resolve(window.ethereum)
      }
    }, 100)

    // Timeout → not in D'CENT in-app browser, fall back to USB bridge
    setTimeout(() => {
      if (!resolved) {
        resolved = true
        clearInterval(interval)
        window.removeEventListener('ethereum#initialized', handler)
        resolve(null)
      }
    }, timeout)
  })
}

// Export for testing
export { waitForDcentProvider }

// Unified D'CENT connector — detects in-app browser vs desktop at connect time
function createDcentConnector(config) {
  let provider = null
  let account = null

  async function getDesktopProvider() {
    // Dynamic import to avoid SSR issues — dcent-provider uses browser APIs
    const DcentProvider = (await import('dcent-provider')).default
    // dcent-provider's ProviderFactory calls engine.start() automatically unless
    // opts.stopped is true (provider-factory/index.js:84). Without stopped: true,
    // PollingBlockTracker fires immediately and errors when no wallet is connected.
    // We call p.start() manually in connect() when the user actually clicks.
    const p = new DcentProvider({
      rpcUrl: 'https://erpc.xinfin.network',
      chainId: config.chains[0].id,
      stopped: true,
    })
    // Add EIP-1193 request() method
    p.request = ({ method, params }) => p.send(method, params)
    return p
  }

  return {
    id: 'dcent',
    name: "D'CENT",
    type: 'dcent',

    async setup() {},

    async connect() {
      let p = await this.getProvider()
      // If no injected provider found, create desktop provider now (user clicked connect)
      if (!p) {
        p = await getDesktopProvider()
        provider = p
        // start() is required — web3-provider-engine won't process RPC requests without it.
        // Called here (not in getDesktopProvider) so polling only begins when user actually connects.
        if (p.start) p.start()
      }
      let accounts
      // Injected provider uses request(), desktop uses send()
      if (p.isDcentWallet || p.request) {
        try {
          accounts = await p.request({ method: 'eth_requestAccounts' })
        } catch {
          accounts = await p.send('eth_requestAccounts')
        }
      } else {
        accounts = await p.send('eth_requestAccounts')
      }
      account = accounts[0]
      return {
        accounts: [account],
        chainId: config.chains[0].id,
      }
    },

    async disconnect() {
      // Stop web3-provider-engine block polling on disconnect — without this,
      // PollingBlockTracker keeps firing in the background and throws errors
      // when the wallet is no longer connected. Standard practice per:
      // https://github.com/WalletConnect/walletconnect-monorepo/issues/357
      if (provider?.stop) provider.stop()
      account = null
      provider = null
    },

    async getAccounts() {
      if (!account) return []
      return [account]
    },

    async getChainId() {
      return config.chains[0].id
    },

    async getProvider() {
      if (provider) return provider
      // Check at runtime — not init time
      const injected = await waitForDcentProvider()
      if (injected) {
        provider = injected
      }
      // Don't create desktop provider here — it auto-polls and throws errors.
      // Desktop provider is created lazily in connect() only when user clicks.
      return provider
    },

    async isAuthorized() {
      const accounts = await this.getAccounts()
      return accounts.length > 0
    },

    async switchChain({ chainId }) {
      const chain = config.chains.find(c => c.id === chainId)
      if (!chain) throw new Error(`Chain ${chainId} not found`)
      provider = null
      await this.getProvider()
      return chain
    },

    onAccountsChanged(accounts) {
      if (accounts.length === 0) {
        account = null
      } else {
        account = accounts[0]
      }
    },

    onChainChanged() {},
    onDisconnect() {
      // Same as disconnect() — stop block polling to prevent PollingBlockTracker errors
      if (provider?.stop) provider.stop()
      account = null
      provider = null
    },
  }
}

export const dcentWallet = () => ({
  id: 'dcent',
  name: "D'CENT",
  iconUrl: '/dcent-icon.png',
  iconBackground: '#2c2c2c',
  installed: true,
  downloadUrls: {
    android: 'https://play.google.com/store/apps/details?id=com.kr.iotrust.dcent.wallet',
    ios: 'https://apps.apple.com/app/dcent-wallet/id1447206611',
  },
  createConnector: (walletDetails) =>
    createConnector((config) => ({
      ...createDcentConnector(config),
      ...walletDetails,
    })),
})
