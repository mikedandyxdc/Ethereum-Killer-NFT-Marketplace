import { defineChain } from 'viem'

export const xdc = defineChain({
  id: 50,
  name: 'XDC Network',
  nativeCurrency: {
    decimals: 18,
    name: 'XDC',
    symbol: 'XDC',
  },
  rpcUrls: {
    default: { http: ['https://erpc.xinfin.network'] },
  },
  blockExplorers: {
    // default: { name: 'XDC Explorer', url: 'https://explorer.xinfin.network' },
    default: { name: 'XDCScan', url: 'https://xdcscan.com' },
  },
})

export const xdcTestnet = defineChain({
  id: 51,
  name: 'XDC Apothem Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'TXDC',
    symbol: 'TXDC',
  },
  rpcUrls: {
    default: { http: ['https://erpc.apothem.network'] },
  },
  blockExplorers: {
    // default: { name: 'XDC Testnet Explorer', url: 'https://explorer.apothem.network' },
    default: { name: 'XDCScan Testnet', url: 'https://testnet.xdcscan.com' },
  },
  testnet: true,
})

export const hardhatLocalhost = defineChain({
  id: 1337,
  name: 'Hardhat Localhost',
  nativeCurrency: {
    decimals: 18,
    name: 'ETH',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: { http: ['http://127.0.0.1:8545'] },
  },
  testnet: true,
})
