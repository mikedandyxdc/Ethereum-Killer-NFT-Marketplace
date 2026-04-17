let cachedMetadata = null

export async function loadMetadata() {
  if (cachedMetadata) return cachedMetadata

  // Bump ?v= when master_metadata.json changes to bust browser/CDN caches
  const res = await fetch('/metadata/master_metadata.json?v=2')
  const data = await res.json()

  // Flatten from { b1: { "0000": {...}, "0001": {...} }, b2: {...} } to { tokenId: metadata }
  const flat = {}
  for (const bg of Object.values(data)) {
    for (const [tokenId, meta] of Object.entries(bg)) {
      flat[tokenId] = meta
    }
  }

  cachedMetadata = flat
  return flat
}

export function getTokenMetadata(allMetadata, tokenId) {
  const key = String(tokenId).padStart(4, '0')
  return allMetadata[key] || null
}

export function getTraitValue(metadata, traitType) {
  if (!metadata?.attributes) return null
  const attr = metadata.attributes.find((a) => a.trait_type === traitType)
  return attr?.value || null
}

export function getAllTraitValues(allMetadata, traitType) {
  const values = new Set()
  for (const meta of Object.values(allMetadata)) {
    const val = getTraitValue(meta, traitType)
    if (val) values.add(val)
  }
  return [...values].sort()
}

export const TRAIT_TYPES = ['Background', 'Tuxedo', 'Hair', 'Tie', 'Weapon']

// Pre-compute all rarity scores efficiently — O(n) instead of O(n²)
let cachedRarityScores = null

export function computeAllRarityScores(allMetadata) {
  if (cachedRarityScores) return cachedRarityScores

  const totalTokens = Object.keys(allMetadata).length

  // Step 1: Count occurrences of each trait value (single pass)
  const traitCounts = {} // { "Background:Art Exhibition": 400, ... }
  for (const meta of Object.values(allMetadata)) {
    if (!meta?.attributes) continue
    for (const attr of meta.attributes) {
      const key = `${attr.trait_type}:${attr.value}`
      traitCounts[key] = (traitCounts[key] || 0) + 1
    }
  }

  // Step 2: Score each token using pre-computed counts (single pass)
  cachedRarityScores = {}
  for (const [tokenId, meta] of Object.entries(allMetadata)) {
    if (!meta?.attributes) {
      cachedRarityScores[tokenId] = 0
      continue
    }
    let score = 0
    for (const attr of meta.attributes) {
      const key = `${attr.trait_type}:${attr.value}`
      const count = traitCounts[key] || 1
      score += totalTokens / count
    }
    cachedRarityScores[tokenId] = Math.round(score * 100) / 100
  }

  return cachedRarityScores
}
