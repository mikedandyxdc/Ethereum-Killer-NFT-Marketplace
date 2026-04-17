'use client'

// import { useState } from 'react'
import { useQueryState, parseAsInteger, parseAsBoolean } from 'nuqs'
import Link from 'next/link'
import { useContractRead } from '@/hooks/useContract'
import { useOriginalRead } from '@/hooks/useOriginalContract'
import { formatXDC, formatAddress, formatTimestamp, formatTokenId } from '@/utils/format'
import Pagination from '@/components/ui/Pagination'
import SortToggle from '@/components/ui/SortToggle'

const PAGE_SIZE = 20

export default function SalesFeed() {
  // const [page, setPage] = useState(1)
  // const [ascending, setAscending] = useState(false)
  const [page, setPage] = useQueryState('salesPage', parseAsInteger.withDefault(1))
  const [ascending, setAscending] = useQueryState('salesAsc', parseAsBoolean.withDefault(false))

  const { data: totalCount } = useContractRead('getGlobalSalesCount', [], { refetchInterval: 15000 })
  const count = Number(totalCount || 0)

  const fetchCount = Math.min(PAGE_SIZE, count - (page - 1) * PAGE_SIZE)
  const start = ascending ? (page - 1) * PAGE_SIZE : Math.min(count - 1, (page - 1) * PAGE_SIZE + fetchCount - 1)

  const { data: sales, isLoading } = useContractRead(
    'getGlobalSales',
    count > 0 ? [BigInt(Math.max(0, start)), BigInt(Math.max(1, fetchCount)), ascending] : undefined,
    { enabled: count > 0, refetchInterval: 15000 }
  )

  // Original NFT sales
  const { data: originalSales } = useOriginalRead('getOriginalSalesHistory', [], { refetchInterval: 15000 })

  const actualSales = count > 0 ? sales || [] : []
  const totalPages = Math.ceil(count / PAGE_SIZE)

  const hasOriginalSales = originalSales && originalSales.length > 0
  const noSales = totalCount !== undefined && count === 0 && !hasOriginalSales

  if (noSales) {
    return <p className="text-sm text-xdc-muted py-8 text-center">No sales yet.</p>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-xdc-muted">{count}{hasOriginalSales ? ` + ${originalSales.length} Original` : ''} total sales</p>
        <SortToggle label="Date" ascending={ascending} onToggle={() => setAscending(!ascending)} />
      </div>

      {/* Original NFT sales pinned at top */}
      {hasOriginalSales && page === 1 && (
        <div className="mb-4">
          <p className="text-xs text-xdc-accent font-semibold uppercase tracking-wider mb-2">Original 1/1 Sales</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xdc-muted border-b border-xdc-border">
                  <th className="text-left py-2 font-medium">Token</th>
                  <th className="text-left py-2 font-medium">Seller</th>
                  <th className="text-left py-2 font-medium">Buyer</th>
                  <th className="text-right py-2 font-medium">Price</th>
                  <th className="text-right py-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {[...originalSales].reverse().map((sale, i) => (
                  <tr key={`orig-${i}`} className="border-b border-xdc-border/50 hover:bg-xdc-card/50">
                    <td className="py-2">
                      <Link href="/token/original" className="text-xdc-accent hover:underline">
                        Original
                      </Link>
                    </td>
                    <td className="py-2 text-xdc-text">{formatAddress(sale.seller)}</td>
                    <td className="py-2 text-xdc-text">{formatAddress(sale.buyer)}</td>
                    <td className="py-2 text-right text-xdc-accent font-semibold">{formatXDC(sale.price)} XDC</td>
                    <td className="py-2 text-right text-xdc-muted">{formatTimestamp(sale.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Collection sales */}
      {isLoading ? (
        <p className="text-sm text-xdc-muted text-center py-8">Loading...</p>
      ) : actualSales.length > 0 ? (
        <div className="overflow-x-auto">
          {hasOriginalSales && page === 1 && (
            <p className="text-xs text-xdc-muted font-semibold uppercase tracking-wider mb-2">Collection Sales</p>
          )}
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xdc-muted border-b border-xdc-border">
                <th className="text-left py-2 font-medium">Token</th>
                <th className="text-left py-2 font-medium">Seller</th>
                <th className="text-left py-2 font-medium">Buyer</th>
                <th className="text-right py-2 font-medium">Price</th>
                <th className="text-right py-2 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {actualSales.map((sale, i) => (
                <tr key={i} className="border-b border-xdc-border/50 hover:bg-xdc-card/50">
                  <td className="py-2">
                    <Link href={`/token/${sale.tokenId}`} className="text-xdc-accent hover:underline">
                      #{formatTokenId(sale.tokenId)}
                    </Link>
                  </td>
                  <td className="py-2 text-xdc-text">{formatAddress(sale.seller)}</td>
                  <td className="py-2 text-xdc-text">{formatAddress(sale.buyer)}</td>
                  <td className="py-2 text-right text-xdc-accent font-semibold">{formatXDC(sale.price)} XDC</td>
                  <td className="py-2 text-right text-xdc-muted">{formatTimestamp(sale.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  )
}
