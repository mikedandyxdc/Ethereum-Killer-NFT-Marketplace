'use client'

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react'
import { useParams } from 'next/navigation'
import { useAccount } from 'wagmi'
import { useQueryState, parseAsInteger, parseAsString, parseAsBoolean } from 'nuqs'
import { useQuery } from '@tanstack/react-query'
import { useContractRead, useContractWrite } from '@/hooks/useContract'
import { useOriginalRead } from '@/hooks/useOriginalContract'
import { usePagination } from '@/hooks/usePagination'
import { contractConfig, publicClient } from '@/lib/contract'
import { formatAddress, formatXDC, formatTokenId } from '@/utils/format'
import { loadMetadata, getTokenMetadata, computeAllRarityScores } from '@/utils/metadata'
import NFTGrid from '@/components/nft/NFTGrid'
import Pagination from '@/components/ui/Pagination'
import SortToggle from '@/components/ui/SortToggle'
import Link from 'next/link'

const PAGE_SIZE = 24
const BATCH_SIZE = 500

// publicClient imported from @/lib/contract

// Wrapped in Suspense — required because nuqs uses useSearchParams internally.
// Without this wrapper, Next.js build fails with:
// "useSearchParams() should be wrapped in a suspense boundary"
export default function ProfilePage() {
  return (
    <Suspense>
      <ProfilePageInner />
    </Suspense>
  )
}

function ProfilePageInner() {
  const { address } = useParams()
  const { address: connectedAddress } = useAccount()
  const isOwn = connectedAddress && connectedAddress.toLowerCase() === address.toLowerCase()

  const [tab, setTab] = useState('nfts')
  // const [ascending, setAscending] = useState(true)
  const [sortBy, setSortBy] = useQueryState('sort', parseAsString.withDefault('tokenId'))
  const [ascending, setAscending] = useQueryState('asc', parseAsBoolean.withDefault(true))
  const [metadata, setMetadata] = useState(null)
  const [operatorAddress, setOperatorAddress] = useState('')
  // const [ownedTokenIds, setOwnedTokenIds] = useState([])
  // const [loadingTokens, setLoadingTokens] = useState(false)
  //
  // useEffect(() => {
  //   loadMetadata().then(setMetadata)
  // }, [])
  //
  // // My NFTs
  // const { data: balance } = useContractRead('balanceOf', [address], { refetchInterval: 10000 })
  // const { data: ownedCount } = useContractRead('getOwnedTokensCount', [address], { refetchInterval: 10000 })
  // const tokenCount = Number(ownedCount || balance || 0)
  //
  // // Batch fetch owned tokens
  // useEffect(() => {
  //   if (tokenCount === 0) { setOwnedTokenIds([]); return }
  //   let cancelled = false
  //   async function fetchAll() {
  //     setLoadingTokens(true)
  //     const ids = []
  //     for (let start = 0; start < tokenCount; start += BATCH_SIZE) {
  //       const count = Math.min(BATCH_SIZE, tokenCount - start)
  //       const batch = await publicClient.readContract({
  //         ...contractConfig,
  //         functionName: 'getOwnedTokens',
  //         args: [address, BigInt(start), BigInt(count), ascending],
  //       })
  //       ids.push(...batch.map(Number))
  //     }
  //     if (!cancelled) {
  //       setOwnedTokenIds(ids)
  //       setLoadingTokens(false)
  //     }
  //   }
  //   fetchAll()
  //   return () => { cancelled = true }
  // }, [address, tokenCount, ascending])
  //
  // // Fetch prices for owned tokens
  // const [prices, setPrices] = useState({})
  // useEffect(() => {
  //   if (!ownedTokenIds.length) return
  //   let cancelled = false
  //   async function fetchPrices() {
  //     const BATCH = 5000
  //     const priceMap = {}
  //     for (let i = 0; i < ownedTokenIds.length; i += BATCH) {
  //       const batch = ownedTokenIds.slice(i, i + BATCH)
  //       const result = await publicClient.readContract({
  //         ...contractConfig,
  //         functionName: 'getTokenPrices',
  //         args: [batch.map(BigInt)],
  //       })
  //       batch.forEach((id, idx) => { priceMap[id] = result[idx] })
  //     }
  //     if (!cancelled) setPrices(priceMap)
  //   }
  //   fetchPrices()
  //   return () => { cancelled = true }
  // }, [ownedTokenIds])
  //
  // const ownedTokensList = useMemo(() => {
  //   if (!ownedTokenIds.length || !metadata) return []
  //   return ownedTokenIds.map((numId) => ({
  //     tokenId: numId,
  //     metadata: getTokenMetadata(metadata, numId),
  //     price: prices[numId] || null,
  //     isForSale: prices[numId] ? prices[numId] > 0n : false,
  //   }))
  // }, [ownedTokenIds, metadata, prices])

  useEffect(() => {
    loadMetadata().then(setMetadata)
  }, [])

  // My NFTs — cached with React Query (same pattern as /browse)
  const { data: profileData, isLoading: loadingTokens } = useQuery({
    // queryKey: ['profileTokens', address, ascending],
    queryKey: ['profileTokens', address],
    queryFn: async () => {
      // Fetch token count
      const count = await publicClient.readContract({
        ...contractConfig,
        functionName: 'getOwnedTokensCount',
        args: [address],
      })
      const tokenCount = Number(count)
      if (tokenCount === 0) return { tokenIds: [], prices: {} }

      // Fetch token IDs
      const ids = []
      for (let start = 0; start < tokenCount; start += BATCH_SIZE) {
        const batchCount = Math.min(BATCH_SIZE, tokenCount - start)
        const batch = await publicClient.readContract({
          ...contractConfig,
          functionName: 'getOwnedTokens',
          // args: [address, BigInt(start), BigInt(batchCount), ascending],
          args: [address, BigInt(start), BigInt(batchCount), true],
        })
        ids.push(...batch.map(Number))
      }

      // Fetch prices
      const PRICE_BATCH = 5000
      const priceMap = {}
      for (let i = 0; i < ids.length; i += PRICE_BATCH) {
        const batch = ids.slice(i, i + PRICE_BATCH)
        const result = await publicClient.readContract({
          ...contractConfig,
          functionName: 'getTokenPrices',
          args: [batch.map(BigInt)],
        })
        batch.forEach((id, idx) => { priceMap[id] = result[idx] })
      }

      return { tokenIds: ids, prices: priceMap }
    },
    staleTime: 2 * 60_000,    // data considered fresh for 2 min
    gcTime: 10 * 60_000,      // keep in cache for 10 min after unmount
    refetchOnWindowFocus: false,
  })

  const ownedTokenIds = profileData?.tokenIds || []
  const prices = profileData?.prices || {}

  const rarityScores = useMemo(() => {
    if (!metadata) return {}
    return computeAllRarityScores(metadata)
  }, [metadata])

  const ownedTokensList = useMemo(() => {
    if (!ownedTokenIds.length || !metadata) return []
    let tokens = ownedTokenIds.map((numId) => {
      const key = String(numId).padStart(4, '0')
      return {
        tokenId: numId,
        metadata: getTokenMetadata(metadata, numId),
        price: prices[numId] || null,
        isForSale: prices[numId] ? prices[numId] > 0n : false,
        rarity: rarityScores[key] || 0,
      }
    })

    // Sort (same logic as browse filterTokens)
    tokens.sort((a, b) => {
      let cmp = 0
      if (sortBy === 'price') {
        const pa = a.price || 0n
        const pb = b.price || 0n
        cmp = pa < pb ? -1 : pa > pb ? 1 : 0
      } else if (sortBy === 'rarity') {
        cmp = a.rarity - b.rarity
      } else {
        cmp = a.tokenId - b.tokenId
      }
      return ascending ? cmp : -cmp
    })

    return tokens
  }, [ownedTokenIds, metadata, prices, rarityScores, sortBy, ascending])

  // const [ownedPage, setOwnedPage] = useState(1)
  const [ownedPage, setOwnedPage] = useQueryState('page', parseAsInteger.withDefault(1))
  const ownedPagination = usePagination(ownedTokensList, PAGE_SIZE, ownedPage)

  // My Offers
  const { data: offersCount } = useContractRead('getOffersForBidderAddressCount', [address], { refetchInterval: 10000 })
  const myOffersCount = Number(offersCount || 0)

  const { data: myOffers } = useContractRead(
    'getOffersForBidderAddress',
    myOffersCount > 0 ? [address, BigInt(0), BigInt(myOffersCount), ascending] : undefined,
    { enabled: myOffersCount > 0, refetchInterval: 10000 }
  )

  // Withdraw offer
  const { write: withdrawOffer, isPending: withdrawPending } = useContractWrite('withdrawOffer')

  // Original NFT ownership
  const { data: originalOwner } = useOriginalRead('getOriginalOwner', [], { refetchInterval: 10000 })
  const { data: originalPrice } = useOriginalRead('originalPrice', [], { refetchInterval: 10000 })
  const { data: originalForSale } = useOriginalRead('isOriginalForSale', [], { refetchInterval: 10000 })
  const ownsOriginal = originalOwner && address && originalOwner.toLowerCase() === address.toLowerCase()

  // Operator management
  const { write: setApprovalForAll, isPending: approvalPending } = useContractWrite('setApprovalForAll')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          {isOwn ? 'My Profile' : 'Profile'}
        </h1>
        <p className="text-sm text-xdc-muted mt-1">{address}</p>
        {/* <p className="text-sm text-xdc-text mt-1">{tokenCount} NFTs owned</p> */}
        <p className="text-sm text-xdc-text mt-1">{ownedTokenIds.length} NFTs owned</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-xdc-border">
        {[
          // { key: 'nfts', label: `My NFTs (${tokenCount})` },
          { key: 'nfts', label: `My NFTs (${ownedTokenIds.length})` },
          { key: 'offers', label: `My Offers (${myOffersCount})` },
          ...(isOwn ? [{ key: 'operators', label: 'Operators' }] : []),
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`pb-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? 'border-xdc-accent text-white'
                : 'border-transparent text-xdc-muted hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* My NFTs Tab */}
      {tab === 'nfts' && (
        <div>
          {ownsOriginal && (
            <Link href="/token/original" className="block mb-4 group">
              <div className="flex items-center gap-4 bg-xdc-card border border-xdc-border rounded-xl p-3 hover:border-xdc-accent transition-colors">
                <img src="/nfts/original_thumb" alt="Original" className="w-16 h-16 rounded-lg object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-xdc-accent font-semibold uppercase tracking-wider">Original 1/1</p>
                  <p className="text-white font-bold text-sm truncate">Ethereum Killer — The Original</p>
                </div>
                <div className="text-right">
                  {originalForSale && originalPrice > 0n ? (
                    <p className="text-sm font-semibold text-xdc-accent">{formatXDC(originalPrice)} XDC</p>
                  ) : (
                    <p className="text-xs text-xdc-muted">Not listed</p>
                  )}
                </div>
              </div>
            </Link>
          )}
          {/* <div className="flex justify-end mb-3">
            <SortToggle label="Token ID" ascending={ascending} onToggle={() => setAscending(!ascending)} />
          </div> */}
          <div className="flex justify-end items-center gap-2 mb-3">
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); setOwnedPage(1) }}
              className="bg-xdc-card border border-xdc-border rounded-lg px-3 py-1.5 text-sm text-xdc-text focus:outline-none focus:border-xdc-accent"
            >
              <option value="tokenId">Token ID</option>
              <option value="price">Price</option>
              <option value="rarity">Rarity</option>
            </select>
            <SortToggle label="" ascending={ascending} onToggle={() => { setAscending(!ascending); setOwnedPage(1) }} />
          </div>
          {loadingTokens ? (
            <p className="text-sm text-xdc-muted py-8 text-center">Loading tokens...</p>
          ) : (
            <>
              <NFTGrid tokens={ownedPagination.paginatedItems} />
              <Pagination
                currentPage={ownedPage}
                totalPages={ownedPagination.totalPages}
                onPageChange={setOwnedPage}
              />
            </>
          )}
        </div>
      )}

      {/* My Offers Tab */}
      {tab === 'offers' && (
        <div>
          {myOffersCount === 0 ? (
            <p className="text-sm text-xdc-muted py-8 text-center">No active offers.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xdc-muted border-b border-xdc-border">
                    <th className="text-left py-2 font-medium">Token</th>
                    <th className="text-right py-2 font-medium">Offer Amount</th>
                    {isOwn && <th className="text-right py-2 font-medium">Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {(myOffersCount > 0 ? myOffers || [] : []).map((offer, i) => (
                    <tr key={i} className="border-b border-xdc-border/50">
                      <td className="py-2">
                        <Link href={`/token/${offer.tokenId}`} className="text-xdc-accent hover:underline">
                          #{formatTokenId(offer.tokenId)}
                        </Link>
                      </td>
                      <td className="py-2 text-right text-xdc-accent font-semibold">{formatXDC(offer.price)} XDC</td>
                      {isOwn && (
                        <td className="py-2 text-right">
                          <button
                            onClick={() => withdrawOffer([BigInt(offer.tokenId)])}
                            disabled={withdrawPending}
                            className="px-3 py-1 rounded bg-red-500/10 text-red-400 text-xs hover:bg-red-500/20 disabled:opacity-50 transition-colors"
                          >
                            Withdraw
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Operators Tab */}
      {tab === 'operators' && isOwn && (
        <div className="max-w-md space-y-4">
          <p className="text-sm text-xdc-muted">
            Approve or revoke an operator to manage all your tokens.
          </p>
          <input
            type="text"
            value={operatorAddress}
            onChange={(e) => setOperatorAddress(e.target.value)}
            placeholder="Operator address (0x...)"
            className="w-full bg-xdc-dark border border-xdc-border rounded-lg px-3 py-2 text-sm text-xdc-text placeholder-xdc-muted focus:outline-none focus:border-xdc-accent"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setApprovalForAll([operatorAddress, true])}
              disabled={approvalPending || !operatorAddress}
              className="flex-1 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              Approve
            </button>
            <button
              onClick={() => setApprovalForAll([operatorAddress, false])}
              disabled={approvalPending || !operatorAddress}
              className="flex-1 py-2 rounded-lg bg-red-500/80 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50 transition-colors"
            >
              Revoke
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
