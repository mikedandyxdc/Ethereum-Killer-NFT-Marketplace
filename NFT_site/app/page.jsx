'use client'

import Link from 'next/link'
import { useContractRead } from '@/hooks/useContract'
import { formatXDC } from '@/utils/format'

function StatCard({ label, value, suffix }) {
  return (
    <div className="bg-xdc-card border border-xdc-border rounded-xl p-4 text-center">
      <p className="text-xdc-muted text-xs uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-white mt-1">
        {value ?? '—'}
        {suffix && <span className="text-sm text-xdc-muted ml-1">{suffix}</span>}
      </p>
    </div>
  )
}

export default function Home() {
  const { data: name } = useContractRead('name')
  const { data: description } = useContractRead('description')
  const { data: tokenCount } = useContractRead('getTokenCount')
  const { data: ownerCount } = useContractRead('getOwnerCount')
  const { data: floorPrice } = useContractRead('getFloorPrice')
  const { data: totalSales } = useContractRead('getTotalSalesCount')
  const { data: totalVolume } = useContractRead('totalVolume')
  const { data: maxSupply } = useContractRead('MAX_TOKEN_SUPPLY')
  const { data: royaltyFraction } = useContractRead('ROYALTY_FRACTION')

  return (
    <div className="space-y-8">
      {/* Hero Banner */}
      <div className="relative rounded-2xl overflow-hidden">
        <img
          src="/nfts/banner"
          alt="Ethereum Killer NFT Collection"
          className="w-full h-64 sm:h-80 object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-xdc-dark via-xdc-dark/40 to-transparent" />
        <div className="absolute bottom-0 left-0 p-6">
          <h1 className="text-3xl sm:text-4xl font-bold text-white">{name || 'Ethereum Killer'}</h1>
          <p className="text-xdc-muted mt-2 max-w-xl">{description || ''}</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard label="Floor Price" value={floorPrice ? formatXDC(floorPrice) : '—'} suffix="XDC" />
        <StatCard label="Total Volume" value={totalVolume ? formatXDC(totalVolume) : '0'} suffix="XDC" />
        <StatCard label="Minted" value={tokenCount !== undefined ? `${tokenCount}` : '—'} suffix={maxSupply ? `/ ${maxSupply}` : ''} />
        <StatCard label="Owners" value={ownerCount !== undefined ? `${ownerCount}` : '—'} />
        <StatCard label="Sales" value={totalSales !== undefined ? `${totalSales}` : '—'} />
      </div>

      {/* Royalty Info */}
      {royaltyFraction !== undefined && (
        <div className="text-center text-sm text-xdc-muted">
          Royalty: {Number(royaltyFraction) / 100}%
        </div>
      )}

      {/* CTA */}
      <div className="flex justify-center gap-4">
        <Link
          href="/browse"
          className="px-8 py-3 rounded-xl bg-xdc-accent text-white font-semibold hover:bg-blue-600 transition-colors"
        >
          Browse Collection
        </Link>
        <Link
          href="/activity"
          className="px-8 py-3 rounded-xl border border-xdc-border text-xdc-text hover:border-xdc-accent transition-colors"
        >
          View Activity
        </Link>
      </div>
    </div>
  )
}
