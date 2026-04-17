'use client'

import { useState, useEffect } from 'react'
import { useContractWrite } from '@/hooks/useContract'
import { parseXDC } from '@/utils/format'
import NumberInput from '@/components/ui/NumberInput'

const MIN_PRICE = 25000

export default function ListingActions({ tokenId, isForSale, currentPrice }) {
  const [price, setPrice] = useState('')
  const { write: listForSale, isPending: listPending, isSuccess: listSuccess } = useContractWrite('listTokenForSale')
  const { write: removeFromSale, isPending: removePending } = useContractWrite('removeTokenFromSale')
  const { write: updatePrice, isPending: updatePending, isSuccess: updateSuccess } = useContractWrite('updateTokenPrice')

  // Clear price input only after transaction succeeds
  useEffect(() => {
    if (listSuccess || updateSuccess) setPrice('')
  }, [listSuccess, updateSuccess])

  const loading = listPending || removePending || updatePending
  const priceNum = Number(price)
  const belowMin = price !== '' && priceNum < MIN_PRICE
  const samePrice = isForSale && price !== '' && !belowMin && currentPrice && parseXDC(price) === currentPrice

  function handleList() {
    const wei = parseXDC(price)
    if (wei <= 0n) return
    // listForSale([BigInt(tokenId), wei])
    // setPrice('') // moved to useEffect on success
    listForSale([BigInt(tokenId), wei])
  }

  function handleUpdatePrice() {
    const wei = parseXDC(price)
    if (wei <= 0n) return
    // updatePrice([BigInt(tokenId), wei])
    // setPrice('') // moved to useEffect on success
    updatePrice([BigInt(tokenId), wei])
  }

  function handleDelist() {
    removeFromSale([BigInt(tokenId)])
  }

  if (isForSale) {
    return (
      <div className="space-y-3">
        <div className="space-y-1">
          <div className="flex gap-2">
            {/* <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="New price in XDC (min 25,000)"
              className={...}
            /> */}
            <NumberInput
              value={price}
              onChange={setPrice}
              placeholder="New price in XDC (min 25,000)"
              className={`flex-1 bg-xdc-dark border rounded-lg px-3 py-2 text-sm text-xdc-text placeholder-xdc-muted focus:outline-none ${belowMin || samePrice ? 'border-red-500 focus:border-red-500' : 'border-xdc-border focus:border-xdc-accent'}`}
            />
            <button
              onClick={handleUpdatePrice}
              disabled={loading || !price || belowMin || samePrice}
              className="px-4 py-2 rounded-lg bg-xdc-accent text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              {updatePending ? '...' : 'Update Price'}
            </button>
          </div>
          {belowMin && <p className="text-xs text-red-400">Minimum price is 25,000 XDC</p>}
          {samePrice && <p className="text-xs text-red-400">New price must be different from current price</p>}
        </div>
        <button
          onClick={handleDelist}
          disabled={loading}
          className="w-full py-2 rounded-lg border border-red-500/50 text-red-400 text-sm font-medium hover:bg-red-500/10 disabled:opacity-50 transition-colors"
        >
          {removePending ? 'Removing...' : 'Remove from Sale'}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        {/* <input type="number" ... /> — replaced with NumberInput for comma formatting */}
        <NumberInput
          value={price}
          onChange={setPrice}
          placeholder="Price in XDC (min 25,000)"
          className={`flex-1 bg-xdc-dark border rounded-lg px-3 py-2 text-sm text-xdc-text placeholder-xdc-muted focus:outline-none ${belowMin ? 'border-red-500 focus:border-red-500' : 'border-xdc-border focus:border-xdc-accent'}`}
        />
        <button
          onClick={handleList}
          disabled={loading || !price || belowMin}
          className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {listPending ? '...' : 'List for Sale'}
        </button>
      </div>
      {belowMin && <p className="text-xs text-red-400">Minimum price is 25,000 XDC</p>}
    </div>
  )
}
