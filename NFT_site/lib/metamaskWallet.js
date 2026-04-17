import { createConnector } from 'wagmi'
import { injected } from 'wagmi/connectors'

export const metamaskWallet = () => ({
  id: 'metamask',
  name: 'MetaMask',
  iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg',
  iconBackground: '#f5841f',
  installed: typeof window !== 'undefined' && window.ethereum?.isMetaMask,
  downloadUrls: {
    chrome: 'https://chromewebstore.google.com/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn',
    firefox: 'https://addons.mozilla.org/en-US/firefox/addon/ether-metamask/',
  },
  createConnector: (walletDetails) =>
    createConnector((config) => ({
      ...injected({
        target: () => ({
          id: 'metamask',
          name: 'MetaMask',
          provider: typeof window !== 'undefined' ? window.ethereum : undefined,
        }),
      })(config),
      ...walletDetails,
    })),
})
