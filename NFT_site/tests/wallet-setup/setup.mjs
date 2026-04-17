import { MetaMask, getExtensionId, unlockForFixture } from '@synthetixio/synpress/playwright'

const SEED_PHRASE = 'test test test test test test test test test test test junk'
const PASSWORD = 'TestPassword123!'

export async function walletSetup(context, extensionId) {
  const metamask = new MetaMask(context, context.pages()[0], PASSWORD, extensionId)

  await metamask.importWallet(SEED_PHRASE)

  // Add Hardhat localhost network
  await metamask.addNetwork({
    name: 'Hardhat',
    rpcUrl: 'http://127.0.0.1:8545',
    chainId: 1337,
    symbol: 'ETH',
  })

  return metamask
}
