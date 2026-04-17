'use client'

import { useContractWrite } from '@/hooks/useContract'
import { formatXDC, formatAddress } from '@/utils/format'

export default function AcceptOffer({ tokenId, offers }) {
  const { write, isPending, isConfirming } = useContractWrite('acceptOffer')
  const loading = isPending || isConfirming

  if (!offers?.length) return null

  function handleAccept(bidder) {
    write([BigInt(tokenId), bidder])
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-xdc-text">Accept an Offer</h4>
      {offers.map((offer, i) => (
        <div key={i} className="flex items-center justify-between bg-xdc-dark rounded-lg p-3">
          <div>
            <p className="text-sm text-xdc-text">{formatAddress(offer.bidder)}</p>
            <p className="text-xs text-xdc-accent font-semibold">{formatXDC(offer.price)} XDC</p>
          </div>
          <button
            onClick={() => handleAccept(offer.bidder)}
            disabled={loading}
            className="px-3 py-1.5 rounded bg-green-600 text-white text-xs font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {loading ? '...' : 'Accept'}
          </button>
        </div>
      ))}
    </div>
  )
}
