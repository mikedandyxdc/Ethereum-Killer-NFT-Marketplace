'use client'

import { useState } from 'react'
import { useContractRead } from '@/hooks/useContract'
import { formatXDC, formatAddress } from '@/utils/format'
import Pagination from '@/components/ui/Pagination'
import SortToggle from '@/components/ui/SortToggle'

const PAGE_SIZE = 10

export default function OffersList({ tokenId }) {
  const [page, setPage] = useState(1)
  const [ascending, setAscending] = useState(false)

  const { data: totalCount } = useContractRead('getOffersForTokenCount', [BigInt(tokenId)])
  const count = Number(totalCount || 0)

  const fetchCount = Math.min(PAGE_SIZE, count - (page - 1) * PAGE_SIZE)
  const start = ascending ? (page - 1) * PAGE_SIZE : Math.min(count - 1, (page - 1) * PAGE_SIZE + fetchCount - 1)

  const { data: offers, isLoading } = useContractRead(
    'getOffersForToken',
    count > 0 ? [BigInt(tokenId), BigInt(Math.max(0, start)), BigInt(Math.max(1, fetchCount)), ascending] : undefined,
    { enabled: count > 0 }
  )

  const actualOffers = count > 0 ? offers || [] : []
  const totalPages = Math.ceil(count / PAGE_SIZE)

  if (count === 0 || actualOffers.length === 0) {
    return <p className="text-sm text-xdc-muted py-4">No offers yet.</p>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-xdc-text">Offers ({count})</h4>
        <SortToggle label="Price" ascending={ascending} onToggle={() => setAscending(!ascending)} />
      </div>

      {isLoading ? (
        <p className="text-sm text-xdc-muted">Loading...</p>
      ) : (
        <div className="space-y-2">
          {actualOffers.map((offer, i) => (
            <div key={i} className="flex items-center justify-between bg-xdc-dark rounded-lg p-3">
              <p className="text-sm text-xdc-text">{formatAddress(offer.bidder)}</p>
              <p className="text-sm font-semibold text-xdc-accent">{formatXDC(offer.price)} XDC</p>
            </div>
          ))}
        </div>
      )}

      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  )
}
