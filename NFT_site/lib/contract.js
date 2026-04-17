import abi from './abi.json'
import { createPublicClient, http, fallback } from 'viem'
import { xdc, hardhatLocalhost } from '@/lib/chains'

const isLocalhost = process.env.NEXT_PUBLIC_NETWORK === 'localhost'

const activeChain = isLocalhost ? hardhatLocalhost : xdc

export const xdcRpcs = [
  http('https://erpc.xinfin.network'),
  http('https://rpc.ankr.com/xdc'),
  http('https://erpc.xdcrpc.com'),
  http('https://xdc.public-rpc.com'),
  http('https://rpc.primenumbers.xyz'),
]

export const publicClient = createPublicClient({
  chain: activeChain,
  transport: isLocalhost ? http('http://127.0.0.1:8545') : fallback(xdcRpcs),
})

// Localhost (Hardhat) - deterministic addresses, same for everyone
// export const CONTRACT_ADDRESS = '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0'
// export const ORDER_STATISTICS_TREE_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3'
// export const CUSTOM_MIN_HEAP_ADDRESS = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512'
// Mainnet (XDC)
// export const CONTRACT_ADDRESS = '0x1343AD5D396438eE12a7E50b3927792Ea1e6b6Ab'
// export const ORDER_STATISTICS_TREE_ADDRESS = '0xF990007ee8b948284552d605d5e04BcC9b362960'
// export const CUSTOM_MIN_HEAP_ADDRESS = '0xE2D37697E278f7d768b64187053dDc04a6ce3bC0'

export const CONTRACT_ADDRESS = isLocalhost
  ? '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0'
  : '0x1343AD5D396438eE12a7E50b3927792Ea1e6b6Ab'
export const ORDER_STATISTICS_TREE_ADDRESS = isLocalhost
  ? '0x5FbDB2315678afecb367f032d93F642f64180aa3'
  : '0xF990007ee8b948284552d605d5e04BcC9b362960'
export const CUSTOM_MIN_HEAP_ADDRESS = isLocalhost
  ? '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512'
  : '0xE2D37697E278f7d768b64187053dDc04a6ce3bC0'

export const contractConfig = {
  address: CONTRACT_ADDRESS,
  abi,
}

export { abi }
