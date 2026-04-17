'use client'

import { useContractWrite } from '@/hooks/useContract'

export default function BuyButton({ tokenId, price }) {
  const { write, isPending, isConfirming } = useContractWrite('buyToken')

  function handleBuy() {
    write([BigInt(tokenId), price], price)
  }

  const loading = isPending || isConfirming

  return (
    <button
      onClick={handleBuy}
      disabled={loading}
      className="w-full py-3 rounded-lg bg-xdc-accent text-white font-semibold hover:bg-blue-600 disabled:opacity-50 transition-colors"
    >
      {loading ? 'Buying...' : 'Buy Now'}
    </button>
  )
}
