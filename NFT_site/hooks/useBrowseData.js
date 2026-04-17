'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef } from 'react'
import { parseEther } from 'viem'
import { contractConfig, publicClient } from '@/lib/contract'
import { loadMetadata, getTokenMetadata, getTraitValue, getAllTraitValues, TRAIT_TYPES, computeAllRarityScores } from '@/utils/metadata'

const BATCH_SIZE = 500
const PRICE_BATCH = 5000

async function fetchAllTokenIds(functionName, countFunctionName) {
  const count = await publicClient.readContract({
    ...contractConfig,
    functionName: countFunctionName,
  })
  const total = Number(count)
  if (total === 0) return []

  const ids = []
  for (let start = 0; start < total; start += BATCH_SIZE) {
    const batchCount = Math.min(BATCH_SIZE, total - start)
    const batch = await publicClient.readContract({
      ...contractConfig,
      functionName,
      args: [BigInt(start), BigInt(batchCount), true],
    })
    ids.push(...batch.map(Number))
  }
  return ids
}

async function fetchPricesForIds(tokenIds) {
  if (!tokenIds.length) return {}
  const priceMap = {}
  for (let i = 0; i < tokenIds.length; i += PRICE_BATCH) {
    const batch = tokenIds.slice(i, i + PRICE_BATCH)
    const result = await publicClient.readContract({
      ...contractConfig,
      functionName: 'getTokenPrices',
      args: [batch.map((id) => BigInt(id))],
    })
    batch.forEach((id, idx) => {
      priceMap[id] = result[idx]
    })
  }
  return priceMap
}

// Single fetch function that loads everything
async function fetchBrowseData() {
  const meta = await loadMetadata()

  const [forSaleIds, notForSaleIds] = await Promise.all([
    fetchAllTokenIds('getForSaleTokens', 'getForSaleTokensCount'),
    fetchAllTokenIds('getNotForSaleTokens', 'getNotForSaleTokensCount'),
  ])

  const traitOptions = {}
  TRAIT_TYPES.forEach((t) => {
    traitOptions[t] = getAllTraitValues(meta, t)
  })

  const rarityScores = computeAllRarityScores(meta)

  const prices = await fetchPricesForIds(forSaleIds)

  return { metadata: meta, forSaleIds, notForSaleIds, traitOptions, rarityScores, prices }
}

// Lightweight count check — 2 RPC calls to detect if listings changed
async function fetchCounts() {
  const [forSale, notForSale] = await Promise.all([
    publicClient.readContract({ ...contractConfig, functionName: 'getForSaleTokensCount' }),
    publicClient.readContract({ ...contractConfig, functionName: 'getNotForSaleTokensCount' }),
  ])
  return { forSale: Number(forSale), notForSale: Number(notForSale) }
}

export function useBrowseData() {
  const queryClient = useQueryClient()
  const lastCounts = useRef({ forSale: -1, notForSale: -1 })

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['browseData'],
    queryFn: fetchBrowseData,
    staleTime: 2 * 60_000,    // data considered fresh for 2 min — no refetch on back-nav
    gcTime: 10 * 60_000,      // keep in cache for 10 min after unmount
    refetchOnWindowFocus: false,
  })

  // Poll counts every 30s — only trigger full refetch if listings changed
  useEffect(() => {
    if (!data) return
    // Seed with current counts so first check doesn't false-trigger
    lastCounts.current = { forSale: data.forSaleIds.length, notForSale: data.notForSaleIds.length }

    const interval = setInterval(async () => {
      try {
        const counts = await fetchCounts()
        if (counts.forSale !== lastCounts.current.forSale || counts.notForSale !== lastCounts.current.notForSale) {
          lastCounts.current = counts
          refetch()
        }
      } catch {
        // RPC hiccup — skip this cycle
      }
    }, 30_000)

    return () => clearInterval(interval)
  }, [data, refetch])

  // On-demand price fetch for specific tokens (merges into cached data)
  const fetchPricesForTokens = useCallback(async (tokenIds) => {
    if (!tokenIds.length || !data) return
    const missing = tokenIds.filter((id) => data.prices[id] === undefined)
    if (!missing.length) return

    try {
      const result = await publicClient.readContract({
        ...contractConfig,
        functionName: 'getTokenPrices',
        args: [missing.map((id) => BigInt(id))],
      })

      const newPrices = { ...data.prices }
      missing.forEach((id, idx) => {
        newPrices[id] = result[idx]
      })

      // Update the cached data with new prices
      queryClient.setQueryData(['browseData'], (old) => ({
        ...old,
        prices: newPrices,
      }))
    } catch (err) {
      console.error('Failed to fetch prices:', err)
    }
  }, [data, queryClient])

  return {
    loading: isLoading,
    loadingStatus: isLoading ? 'Loading collection data...' : '',
    error: error?.message || null,
    metadata: data?.metadata || null,
    forSaleIds: data?.forSaleIds || [],
    notForSaleIds: data?.notForSaleIds || [],
    prices: data?.prices || {},
    rarityScores: data?.rarityScores || {},
    traitOptions: data?.traitOptions || {},
    fetchPricesForTokens,
    refresh: refetch,
  }
}

export function filterTokens({ tokenIds, metadata, prices, rarityScores, selectedTraits, priceRange, sortBy, ascending }) {
  if (!metadata) return []

  let tokens = tokenIds.map((id) => {
    const key = String(id).padStart(4, '0')
    return {
      tokenId: id,
      metadata: metadata[key],
      price: prices[id],
      rarity: rarityScores[key] || 0,
    }
  })

  // Filter by traits
  for (const traitType of TRAIT_TYPES) {
    const selected = selectedTraits[traitType]
    if (selected?.length > 0) {
      tokens = tokens.filter((t) => {
        const val = getTraitValue(t.metadata, traitType)
        return selected.includes(val)
      })
    }
  }

  // Filter by price range (only applies to tokens with loaded prices)
  if (priceRange.min !== '' || priceRange.max !== '') {
    const minWei = priceRange.min !== '' ? parseEther(priceRange.min) : 0n
    const maxWei = priceRange.max !== '' ? parseEther(priceRange.max) : BigInt(2) ** BigInt(256) - BigInt(1)
    tokens = tokens.filter((t) => {
      if (t.price === undefined) return false
      return t.price >= minWei && t.price <= maxWei
    })
  }

  // Sort
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

  return tokens.map((t) => ({
    tokenId: t.tokenId,
    metadata: t.metadata,
    price: t.price,
    isForSale: t.price !== undefined,
    rarity: t.rarity,
  }))
}
