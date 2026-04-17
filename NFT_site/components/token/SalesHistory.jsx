'use client'

import { useState } from 'react'
import { useContractRead } from '@/hooks/useContract'
import { formatXDC, formatAddress, formatTimestamp } from '@/utils/format'
import Pagination from '@/components/ui/Pagination'
import SortToggle from '@/components/ui/SortToggle'

const PAGE_SIZE = 10

export default function SalesHistory({ tokenId }) {
  const [page, setPage] = useState(1)
  const [ascending, setAscending] = useState(false)

  const { data: totalCount } = useContractRead('getTokenSalesHistoryCount', [BigInt(tokenId)])
  const count = Number(totalCount || 0)

  const fetchCount = Math.min(PAGE_SIZE, count - (page - 1) * PAGE_SIZE)
  const start = (page - 1) * PAGE_SIZE

  const { data: sales, isLoading } = useContractRead(
    'getTokenSalesHistory',
    count > 0 ? [BigInt(tokenId), BigInt(Math.max(0, start)), BigInt(Math.max(1, fetchCount)), ascending] : undefined,
    { enabled: count > 0 }
  )

  const actualSales = count > 0 ? sales || [] : []
  const totalPages = Math.ceil(count / PAGE_SIZE)

  if (count === 0 || actualSales.length === 0) {
    return <p className="text-sm text-xdc-muted py-4">No sales history yet.</p>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-xdc-text">Sales History ({count})</h4>
        <SortToggle label="Date" ascending={ascending} onToggle={() => setAscending(!ascending)} />
      </div>

      {isLoading ? (
        <p className="text-sm text-xdc-muted">Loading...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xdc-muted border-b border-xdc-border">
                <th className="text-left py-2 font-medium">Seller</th>
                <th className="text-left py-2 font-medium">Buyer</th>
                <th className="text-right py-2 font-medium">Price</th>
                <th className="text-right py-2 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {actualSales.map((sale, i) => (
                <tr key={i} className="border-b border-xdc-border/50">
                  <td className="py-2 text-xdc-text">{formatAddress(sale.seller)}</td>
                  <td className="py-2 text-xdc-text">{formatAddress(sale.buyer)}</td>
                  <td className="py-2 text-right text-xdc-accent font-semibold">{formatXDC(sale.price)} XDC</td>
                  <td className="py-2 text-right text-xdc-muted">{formatTimestamp(sale.timestamp)}</td>
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
