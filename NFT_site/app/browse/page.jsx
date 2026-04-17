'use client'

import { useMemo, useEffect, Suspense } from 'react'
import { useQueryState, parseAsInteger, parseAsString, parseAsBoolean, parseAsArrayOf } from 'nuqs'
import { useBrowseData, filterTokens } from '@/hooks/useBrowseData'
import { useOriginalRead } from '@/hooks/useOriginalContract'
import { usePagination } from '@/hooks/usePagination'
import NFTGrid from '@/components/nft/NFTGrid'
import TraitFilter from '@/components/nft/TraitFilter'
import Pagination from '@/components/ui/Pagination'
import SortToggle from '@/components/ui/SortToggle'
import { TRAIT_TYPES } from '@/utils/metadata'
import { formatXDC } from '@/utils/format'

// Wrapped in Suspense — required because nuqs uses useSearchParams internally.
// Without this wrapper, Next.js build fails with:
// "useSearchParams() should be wrapped in a suspense boundary"
export default function BrowsePage() {
  return (
    <Suspense>
      <BrowsePageInner />
    </Suspense>
  )
}

function BrowsePageInner() {
  const { loading, loadingStatus, error, metadata, forSaleIds, notForSaleIds, prices, rarityScores, traitOptions, fetchPricesForTokens } = useBrowseData()
  const { data: originalPrice } = useOriginalRead('originalPrice', [], { refetchInterval: 10000 })
  const { data: originalForSale } = useOriginalRead('isOriginalForSale', [], { refetchInterval: 10000 })

  const [tab, setTab] = useQueryState('tab', parseAsString.withDefault('all'))
  const [sortBy, setSortBy] = useQueryState('sort', parseAsString.withDefault('tokenId'))
  const [ascending, setAscending] = useQueryState('asc', parseAsBoolean.withDefault(true))
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1))

  const [bgFilter, setBgFilter] = useQueryState('bg', parseAsArrayOf(parseAsString, ',').withDefault([]))
  const [tuxFilter, setTuxFilter] = useQueryState('tux', parseAsArrayOf(parseAsString, ',').withDefault([]))
  const [hairFilter, setHairFilter] = useQueryState('hair', parseAsArrayOf(parseAsString, ',').withDefault([]))
  const [tieFilter, setTieFilter] = useQueryState('tie', parseAsArrayOf(parseAsString, ',').withDefault([]))
  const [weaponFilter, setWeaponFilter] = useQueryState('weapon', parseAsArrayOf(parseAsString, ',').withDefault([]))
  const [priceMin, setPriceMin] = useQueryState('pmin', parseAsString.withDefault(''))
  const [priceMax, setPriceMax] = useQueryState('pmax', parseAsString.withDefault(''))

  const traitSetters = { Background: setBgFilter, Tuxedo: setTuxFilter, Hair: setHairFilter, Tie: setTieFilter, Weapon: setWeaponFilter }
  const selectedTraits = { Background: bgFilter, Tuxedo: tuxFilter, Hair: hairFilter, Tie: tieFilter, Weapon: weaponFilter }
  const priceRange = { min: priceMin, max: priceMax }

  function handleTraitChange(traitType, values) {
    traitSetters[traitType](values.length > 0 ? values : null)
    setPage(1)
  }

  function handlePriceRangeChange(range) {
    setPriceMin(range.min || null)
    setPriceMax(range.max || null)
    setPage(1)
  }

  function handleTabChange(newTab) {
    setTab(newTab)
    setPage(1)
  }

  function handleSortChange(newSort) {
    setSortBy(newSort)
    setPage(1)
  }

  function handleAscendingToggle() {
    setAscending(!ascending)
    setPage(1)
  }

  const allIds = useMemo(() => [...forSaleIds, ...notForSaleIds], [forSaleIds, notForSaleIds])
  const tokenIds = tab === 'all' ? allIds : tab === 'forSale' ? forSaleIds : notForSaleIds

  const filteredTokens = useMemo(() => {
    return filterTokens({
      tokenIds,
      metadata,
      prices,
      rarityScores,
      selectedTraits,
      priceRange: tab !== 'notForSale' ? priceRange : { min: '', max: '' },
      sortBy,
      ascending,
    })
  }, [tokenIds, metadata, prices, rarityScores, selectedTraits, priceRange, sortBy, ascending, tab])

  const { totalPages, paginatedItems, totalItems } = usePagination(filteredTokens, 24, page)

  // Keep page in bounds
  useEffect(() => {
    if (page > totalPages && totalPages > 0) {
      setPage(totalPages)
    }
  }, [page, totalPages, setPage])

  // Fetch prices for tokens on the current page
  useEffect(() => {
    if (paginatedItems.length > 0 && tab !== 'notForSale') {
      const pageTokenIds = paginatedItems.map((t) => t.tokenId)
      fetchPricesForTokens(pageTokenIds)
    }
  }, [paginatedItems, tab, fetchPricesForTokens])

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-red-400 font-medium">Failed to load collection data</p>
        <p className="text-xs text-xdc-muted mt-2">{error}</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="text-center py-16">
        <p className="text-xdc-muted">Loading collection data...</p>
        <p className="text-xs text-xdc-muted mt-2">{loadingStatus || 'Connecting to network...'}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Browse Collection</h1>
        <p className="text-sm text-xdc-muted">{totalItems} tokens</p>
      </div>

      {/* Original 1/1 — pinned featured card */}
      <a href="/token/original" className="block group">
        <div className="flex items-center gap-4 bg-xdc-card border border-xdc-border rounded-xl p-3 hover:border-xdc-accent transition-colors">
          <img
            src="/nfts/original_thumb"
            alt="Original"
            className="w-16 h-16 rounded-lg object-cover"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-xdc-accent font-semibold uppercase tracking-wider">Original · 1 of 1</p>
            <p className="text-white font-bold text-sm truncate">Ethereum Killer — The Original</p>
          </div>
          <div className="text-right">
            {originalForSale && originalPrice > 0n ? (
              <p className="text-sm font-semibold text-xdc-accent">{formatXDC(originalPrice)} XDC</p>
            ) : (
              <p className="text-xs text-xdc-muted">View →</p>
            )}
          </div>
        </div>
      </a>

      {/* Tabs + Sort */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex bg-xdc-card border border-xdc-border rounded-lg overflow-hidden">
          <button
            onClick={() => handleTabChange('all')}
            className={`px-4 py-2 text-sm ${tab === 'all' ? 'bg-xdc-accent text-white' : 'text-xdc-muted hover:text-white'}`}
          >
            All ({allIds.length})
          </button>
          <button
            onClick={() => handleTabChange('forSale')}
            className={`px-4 py-2 text-sm ${tab === 'forSale' ? 'bg-xdc-accent text-white' : 'text-xdc-muted hover:text-white'}`}
          >
            For Sale ({forSaleIds.length})
          </button>
          <button
            onClick={() => handleTabChange('notForSale')}
            className={`px-4 py-2 text-sm ${tab === 'notForSale' ? 'bg-xdc-accent text-white' : 'text-xdc-muted hover:text-white'}`}
          >
            Not For Sale ({notForSaleIds.length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(e) => handleSortChange(e.target.value)}
            className="bg-xdc-card border border-xdc-border rounded-lg px-3 py-1.5 text-sm text-xdc-text focus:outline-none focus:border-xdc-accent"
          >
            <option value="tokenId">Token ID</option>
            {tab !== 'notForSale' && <option value="price">Price</option>}
            <option value="rarity">Rarity</option>
          </select>
          <SortToggle label="" ascending={ascending} onToggle={handleAscendingToggle} />
        </div>
      </div>

      {/* Content: Filter + Grid */}
      <div className="flex flex-col lg:flex-row gap-6">
        <TraitFilter
          traitOptions={traitOptions}
          selectedTraits={selectedTraits}
          onTraitChange={handleTraitChange}
          priceRange={tab !== 'notForSale' ? priceRange : { min: '', max: '' }}
          onPriceRangeChange={tab !== 'notForSale' ? handlePriceRangeChange : () => {}}
        />

        <div className="flex-1">
          <NFTGrid tokens={paginatedItems} />
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      </div>
    </div>
  )
}
