'use client'

import { useState } from 'react'
import { useContractWrite } from '@/hooks/useContract'
import { parseXDC, formatXDC } from '@/utils/format'
import NumberInput from '@/components/ui/NumberInput'

const MIN_PRICE = 25000

export default function OfferActions({ tokenId, existingOffer }) {
  const [offerAmount, setOfferAmount] = useState('')
  const { write: makeOffer, isPending: makePending } = useContractWrite('makeOffer')
  const { write: withdrawOffer, isPending: withdrawPending } = useContractWrite('withdrawOffer')

  const loading = makePending || withdrawPending
  const offerNum = Number(offerAmount)
  const belowMin = offerAmount !== '' && offerNum < MIN_PRICE
  // const hasOffer = existingOffer && existingOffer > 0n
  const offerPrice = existingOffer?.price ?? 0n
  const hasOffer = offerPrice > 0n

  function handleMakeOffer() {
    const wei = parseXDC(offerAmount)
    if (wei <= 0n) return
    makeOffer([BigInt(tokenId)], wei)
    setOfferAmount('')
  }

  function handleWithdraw() {
    withdrawOffer([BigInt(tokenId)])
  }

  return (
    <div className="space-y-3">
      {hasOffer && (
        <div className="flex items-center justify-between bg-xdc-dark rounded-lg p-3">
          <span className="text-sm text-xdc-muted">Your offer:</span>
          <span className="text-sm font-semibold text-xdc-accent">{formatXDC(offerPrice)} XDC</span>
        </div>
      )}

      <div className="space-y-1">
        <div className="flex gap-2">
          {/* <input type="number" ... /> — replaced with NumberInput for comma formatting */}
          <NumberInput
            value={offerAmount}
            onChange={setOfferAmount}
            placeholder={hasOffer ? 'New offer in XDC (min 25,000)' : 'Offer amount in XDC (min 25,000)'}
            className={`flex-1 bg-xdc-dark border rounded-lg px-3 py-2 text-sm text-xdc-text placeholder-xdc-muted focus:outline-none ${belowMin ? 'border-red-500 focus:border-red-500' : 'border-xdc-border focus:border-xdc-accent'}`}
          />
          <button
            onClick={handleMakeOffer}
            disabled={loading || !offerAmount || belowMin}
            className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {makePending ? '...' : hasOffer ? 'Update Offer' : 'Make Offer'}
          </button>
        </div>
        {belowMin && <p className="text-xs text-red-400">Minimum offer is 25,000 XDC</p>}
      </div>

      {hasOffer && (
        <button
          onClick={handleWithdraw}
          disabled={loading}
          className="w-full py-2 rounded-lg border border-xdc-border text-xdc-muted text-sm hover:border-red-500/50 hover:text-red-400 disabled:opacity-50 transition-colors"
        >
          {withdrawPending ? 'Withdrawing...' : 'Withdraw Offer'}
        </button>
      )}
    </div>
  )
}
