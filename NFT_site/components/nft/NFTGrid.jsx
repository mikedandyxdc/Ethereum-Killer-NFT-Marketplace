'use client'

import NFTCard from './NFTCard'

export default function NFTGrid({ tokens }) {
  if (!tokens?.length) {
    return (
      <div className="text-center py-16 text-xdc-muted">
        No tokens found.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {tokens.map((token) => (
        <NFTCard
          key={token.tokenId}
          tokenId={token.tokenId}
          metadata={token.metadata}
          price={token.price}
          isForSale={token.isForSale}
        />
      ))}
    </div>
  )
}
