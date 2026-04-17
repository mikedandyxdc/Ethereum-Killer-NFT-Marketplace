'use client'

import { connectorsForWallets, RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
// import { metaMaskWallet } from '@rainbow-me/rainbowkit/wallets'
import { metamaskWallet } from '@/lib/metamaskWallet'
import { createConfig, http, fallback, WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { xdc, xdcTestnet, hardhatLocalhost } from '@/lib/chains'
import { xdcRpcs } from '@/lib/contract'

const isLocalhost = process.env.NEXT_PUBLIC_NETWORK === 'localhost'
import { xdcPayWallet } from '@/lib/xdcPayWallet'
import { dcentWallet } from '@/lib/dcentWallet'

import '@rainbow-me/rainbowkit/styles.css'

const connectors = connectorsForWallets(
  [
    {
      groupName: 'Recommended',
      wallets: [metamaskWallet, xdcPayWallet, dcentWallet],
    },
  ],
  {
    appName: 'Ethereum Killer NFT',
    projectId: 'none',
  }
)

const config = createConfig({
  connectors,
  // chains: [hardhatLocalhost, xdc, xdcTestnet],
  // chains: [xdc, xdcTestnet, hardhatLocalhost],
  chains: isLocalhost ? [hardhatLocalhost] : [xdc],
  transports: {
    [hardhatLocalhost.id]: http('http://127.0.0.1:8545'),
    // [xdc.id]: http('https://erpc.xinfin.network'),
    [xdc.id]: fallback(xdcRpcs),
    [xdcTestnet.id]: http('https://erpc.apothem.network'),
  },
  ssr: true,
})

const queryClient = new QueryClient()

export default function Providers({ children }) {
  return (
    <NuqsAdapter>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          {/* modalSize="compact" hides the "What is a wallet?" / "Learn More" right panel.
              disclaimer renders a marker div; CSS in globals.css hides the wrapper + divider. */}
          <RainbowKitProvider
            modalSize="compact"
            appInfo={{ disclaimer: () => <div data-rk-hide-footer /> }}
            theme={darkTheme({
              accentColor: '#3b82f6',
              borderRadius: 'medium',
            })}
          >
            {children}
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </NuqsAdapter>
  )
}
