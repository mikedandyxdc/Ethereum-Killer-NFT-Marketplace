import { formatEther, parseEther } from 'viem'

// // Old abbreviated format (K/M) — commented out in case we want to revert
// export function formatXDC(wei) {
//   if (!wei) return '0'
//   const val = formatEther(wei)
//   const num = parseFloat(val)
//   if (num === 0) return '0'
//   if (num < 0.001) return '<0.001'
//   if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`
//   if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
//   return num.toFixed(num < 1 ? 4 : 2)
// }

// OpenSea-style tiered precision: full number with commas, decimals based on range
// 0.0001–0.0999 → 4 decimals | 0.1–0.999 → 3 decimals | 1.00+ → 2 decimals
export function formatXDC(wei) {
  if (!wei) return '0'
  const val = formatEther(wei)
  const num = parseFloat(val)
  if (num === 0) return '0'
  if (num < 0.0001) return '<0.0001'
  let decimals
  if (num < 0.1) decimals = 4
  else if (num < 1) decimals = 3
  else decimals = 2
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  })
}

export function formatAddress(address) {
  if (!address) return ''
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function formatTimestamp(timestamp) {
  if (!timestamp) return ''
  const date = new Date(Number(timestamp) * 1000)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatTokenId(id) {
  return String(id).padStart(4, '0')
}

export function parseXDC(value) {
  try {
    // Strip commas before parsing — supports both "50,000" and "50000"
    return parseEther(String(value).replace(/,/g, ''))
  } catch {
    return BigInt(0)
  }
}
