'use client'

import Link from 'next/link'
import { formatXDC, formatTokenId } from '@/utils/format'

export default function NFTCard({ tokenId, metadata, price, isForSale }) {
  const paddedId = formatTokenId(tokenId)
  const name = metadata?.name || `Ethereum Killer #${paddedId}`
  const imageSrc = `/nfts_thumbnail/${encodeURIComponent(`Ethereum Killer#${paddedId}`)}`

  return (
    <Link
      href={`/token/${tokenId}`}
      className="group bg-xdc-card border border-xdc-border rounded-xl overflow-hidden hover:border-xdc-accent transition-all hover:-translate-y-1"
    >
      <div className="bg-xdc-dark overflow-hidden">
        <img
          src={imageSrc}
          alt={name}
          className="w-full h-auto group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
      </div>
      <div className="p-3">
        <p className="text-sm font-medium text-white truncate">#{paddedId}</p>
        <div className="mt-1.5 flex items-center justify-between">
          {/* {isForSale && price ? (
            <p className="text-sm text-xdc-accent font-semibold">{formatXDC(price)} XDC</p>
          ) : (
            <p className="text-xs text-xdc-muted">Not for sale</p>
          )} */}
          {isForSale && price ? (
            <p className="text-sm text-xdc-accent font-semibold">{formatXDC(price)} XDC</p>
          ) : price === null ? (
            <p className="text-xs text-xdc-muted">&nbsp;</p>
          ) : (
            <p className="text-xs text-xdc-muted">Not for sale</p>
          )}
        </div>
      </div>
    </Link>
  )
}
