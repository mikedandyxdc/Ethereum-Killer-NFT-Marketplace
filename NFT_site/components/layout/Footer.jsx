'use client'

import { useReadContract, useChainId } from 'wagmi'
import { contractConfig, CONTRACT_ADDRESS, ORDER_STATISTICS_TREE_ADDRESS, CUSTOM_MIN_HEAP_ADDRESS } from '@/lib/contract'
import { ORIGINAL_MARKETPLACE_ADDRESS, ORIGINAL_NFT_ADDRESS } from '@/lib/originalContract'

// const EXPLORER_URLS = {
//   50: 'https://explorer.xinfin.network',
//   51: 'https://explorer.apothem.network',
// }
const EXPLORER_URLS = {
  50: 'https://xdcscan.com',
  51: 'https://testnet.xdcscan.com',
}


export default function Footer() {
  const chainId = useChainId()
  const explorerUrl = EXPLORER_URLS[chainId]

  const { data: website } = useReadContract({
    ...contractConfig,
    functionName: 'website',
  })

  const { data: xHandle } = useReadContract({
    ...contractConfig,
    functionName: 'x',
  })

  const contracts = [
    { label: 'Ethereum Killer', address: CONTRACT_ADDRESS },
    { label: 'Order Statistics Tree', address: ORDER_STATISTICS_TREE_ADDRESS },
    { label: 'Min Heap', address: CUSTOM_MIN_HEAP_ADDRESS },
    { label: 'Original NFT', address: ORIGINAL_NFT_ADDRESS },
    { label: 'Original NFT Marketplace', address: ORIGINAL_MARKETPLACE_ADDRESS },
  ]

  return (
    <footer className="border-t border-xdc-border mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col gap-4 text-sm text-xdc-muted">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>Ethereum Killer NFT &mdash; Fully on-chain marketplace on XDC Network</p>
          <div className="flex items-center gap-4">
            {website && (
              <a href={website} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                Website
              </a>
            )}
            {xHandle && (
              <a href={`https://x.com/${xHandle}`} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                X / Twitter
              </a>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-xs">
          {contracts.map(({ label, address }) => (
            <span key={label}>
              {label}:{' '}
              {explorerUrl ? (
                <a
                  href={`${explorerUrl}/address/${address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono hover:text-white transition-colors"
                >
                  {address}
                </a>
              ) : (
                <span className="font-mono">{address}</span>
              )}
            </span>
          ))}
        </div>
      </div>
    </footer>
  )
}
