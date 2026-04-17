import originalMarketplaceAbi from './originalMarketplaceAbi.json'
import originalNftAbi from './originalNftAbi.json'

const isLocalhost = process.env.NEXT_PUBLIC_NETWORK === 'localhost'

// Localhost (Hardhat) - deterministic addresses
// '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9' (OriginalNFT)
// '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9' (OriginalNFTMarketplace)
// Mainnet (XDC)
// '0xd6950d16402AEA3776881D3f72C13558444E8304' (OriginalNFT)
// '0xc4454DdB6EE5E9e6d77DE3D7b2b90eAa4FD59bca' (OriginalNFTMarketplace)
export const ORIGINAL_NFT_ADDRESS = isLocalhost
  ? '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9'
  : '0xd6950d16402AEA3776881D3f72C13558444E8304'
export const ORIGINAL_MARKETPLACE_ADDRESS = isLocalhost
  ? '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9'
  : '0xc4454DdB6EE5E9e6d77DE3D7b2b90eAa4FD59bca'

export const originalMarketplaceConfig = {
  address: ORIGINAL_MARKETPLACE_ADDRESS,
  abi: originalMarketplaceAbi,
}

export const originalNftConfig = {
  address: ORIGINAL_NFT_ADDRESS,
  abi: originalNftAbi,
}

export { originalMarketplaceAbi, originalNftAbi }
