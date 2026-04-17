'use client'

// import { useState } from 'react'
import { useQueryState, parseAsInteger, parseAsBoolean } from 'nuqs'
import Link from 'next/link'
import { useContractRead } from '@/hooks/useContract'
import { formatXDC, formatAddress, formatTokenId } from '@/utils/format'
import Pagination from '@/components/ui/Pagination'
import SortToggle from '@/components/ui/SortToggle'

const PAGE_SIZE = 20

export default function OffersFeed() {
  // const [page, setPage] = useState(1)
  // const [ascending, setAscending] = useState(false)
  const [page, setPage] = useQueryState('offersPage', parseAsInteger.withDefault(1))
  const [ascending, setAscending] = useQueryState('offersAsc', parseAsBoolean.withDefault(false))

  const { data: totalCount } = useContractRead('getGlobalOffersCount', [], { refetchInterval: 15000 })
  const count = Number(totalCount || 0)

  const fetchCount = Math.min(PAGE_SIZE, count - (page - 1) * PAGE_SIZE)
  const start = ascending ? (page - 1) * PAGE_SIZE : Math.min(count - 1, (page - 1) * PAGE_SIZE + fetchCount - 1)

  const { data: offers, isLoading } = useContractRead(
    'getGlobalOffers',
    count > 0 ? [BigInt(Math.max(0, start)), BigInt(Math.max(1, fetchCount)), ascending] : undefined,
    { enabled: count > 0, refetchInterval: 15000 }
  )

  const actualOffers = count > 0 ? offers || [] : []
  const totalPages = Math.ceil(count / PAGE_SIZE)

  // Short-circuit: render immediately when count is 0 — don't wait for second query's loading state
  if (totalCount !== undefined && count === 0) {
    return <p className="text-sm text-xdc-muted py-8 text-center">No offers yet.</p>
  }

  if (actualOffers.length === 0 && !isLoading && totalCount !== undefined) {
    return <p className="text-sm text-xdc-muted py-8 text-center">No offers yet.</p>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-xdc-muted">{count} total offers</p>
        <SortToggle label="Price" ascending={ascending} onToggle={() => setAscending(!ascending)} />
      </div>

      {isLoading ? (
        <p className="text-sm text-xdc-muted text-center py-8">Loading...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xdc-muted border-b border-xdc-border">
                <th className="text-left py-2 font-medium">Token</th>
                <th className="text-left py-2 font-medium">Bidder</th>
                <th className="text-right py-2 font-medium">Price</th>
              </tr>
            </thead>
            <tbody>
              {actualOffers.map((offer, i) => (
                <tr key={i} className="border-b border-xdc-border/50 hover:bg-xdc-card/50">
                  <td className="py-2">
                    <Link href={`/token/${offer.tokenId}`} className="text-xdc-accent hover:underline">
                      #{formatTokenId(offer.tokenId)}
                    </Link>
                  </td>
                  <td className="py-2 text-xdc-text">{formatAddress(offer.bidder)}</td>
                  <td className="py-2 text-right text-xdc-accent font-semibold">{formatXDC(offer.price)} XDC</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  )
}
