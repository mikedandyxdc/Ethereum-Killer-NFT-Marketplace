import { createConnector } from 'wagmi'
import { injected } from 'wagmi/connectors'

export const xdcPayWallet = () => ({
  id: 'xdcpay',
  name: 'XDCPay',
  iconUrl: '/xdcpay-icon.png',
  iconBackground: '#3a5a8c',
  installed: typeof window !== 'undefined' && window.ethereum?.isXDCPay,
  downloadUrls: {
    chrome: 'https://chromewebstore.google.com/detail/xdcpay/dgimfmajflciajjbhbkibdbfmpncbnmj',
  },
  createConnector: (walletDetails) =>
    createConnector((config) => ({
      ...injected({
        target: () => ({
          id: 'xdcpay',
          name: 'XDCPay',
          provider: typeof window !== 'undefined' ? window.ethereum : undefined,
        }),
      })(config),
      ...walletDetails,
    })),
})
