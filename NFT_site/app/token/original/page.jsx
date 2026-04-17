'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAccount } from 'wagmi'
import { useOriginalRead, useOriginalNftRead, useOriginalWrite, useOriginalNftWrite } from '@/hooks/useOriginalContract'
import { ORIGINAL_MARKETPLACE_ADDRESS } from '@/lib/originalContract'
import { formatXDC, formatAddress, formatTimestamp, parseXDC } from '@/utils/format'
import NumberInput from '@/components/ui/NumberInput'

const MIN_PRICE = 25000

export default function OriginalTokenPage() {
  const router = useRouter()
  const { address: connectedAddress } = useAccount()
  const [activeTab, setActiveTab] = useState('history')
  const [listPrice, setListPrice] = useState('')
  const [offerAmount, setOfferAmount] = useState('')

  // Read marketplace state
  const { data: owner } = useOriginalRead('getOriginalOwner', [], { refetchInterval: 10000 })
  const { data: price } = useOriginalRead('originalPrice', [], { refetchInterval: 10000 })
  const { data: isForSale } = useOriginalRead('isOriginalForSale', [], { refetchInterval: 10000 })
  const { data: salesHistory } = useOriginalRead('getOriginalSalesHistory', [], { refetchInterval: 10000 })
  const { data: myOffer } = useOriginalRead(
    'originalOffers',
    connectedAddress ? [connectedAddress] : undefined,
    { enabled: !!connectedAddress, refetchInterval: 10000 }
  )

  // Read bidders list (for owner to see and accept offers)
  const { data: bidders } = useOriginalRead('getOriginalBidders', [], { refetchInterval: 10000 })

  // Read each bidder's offer amount
  const bidder0Offer = useOriginalRead('originalOffers', bidders?.[0] ? [bidders[0]] : undefined, { enabled: !!bidders?.[0], refetchInterval: 10000 })
  const bidder1Offer = useOriginalRead('originalOffers', bidders?.[1] ? [bidders[1]] : undefined, { enabled: !!bidders?.[1], refetchInterval: 10000 })
  const bidder2Offer = useOriginalRead('originalOffers', bidders?.[2] ? [bidders[2]] : undefined, { enabled: !!bidders?.[2], refetchInterval: 10000 })
  const bidder3Offer = useOriginalRead('originalOffers', bidders?.[3] ? [bidders[3]] : undefined, { enabled: !!bidders?.[3], refetchInterval: 10000 })
  const bidder4Offer = useOriginalRead('originalOffers', bidders?.[4] ? [bidders[4]] : undefined, { enabled: !!bidders?.[4], refetchInterval: 10000 })

  const activeOffers = useMemo(() => {
    if (!bidders || bidders.length === 0) return []
    const offerReads = [bidder0Offer, bidder1Offer, bidder2Offer, bidder3Offer, bidder4Offer]
    return bidders
      .map((addr, i) => ({ bidder: addr, amount: offerReads[i]?.data }))
      .filter((o) => o.amount && o.amount > 0n)
      .sort((a, b) => (b.amount > a.amount ? 1 : b.amount < a.amount ? -1 : 0))
  }, [bidders, bidder0Offer.data, bidder1Offer.data, bidder2Offer.data, bidder3Offer.data, bidder4Offer.data])

  // Check if marketplace is approved as operator on OriginalNFT
  const { data: isApproved } = useOriginalNftRead(
    'isApprovedForAll',
    owner ? [owner, ORIGINAL_MARKETPLACE_ADDRESS] : undefined,
    { enabled: !!owner, refetchInterval: 10000 }
  )

  // Write hooks
  const { write: listOriginal, isPending: listPending, isConfirming: listConfirming, isSuccess: listSuccess } = useOriginalWrite('listOriginal')
  const { write: delistOriginal, isPending: delistPending, isConfirming: delistConfirming } = useOriginalWrite('delistOriginal')
  const { write: updateOriginalPrice, isPending: updatePending, isConfirming: updateConfirming, isSuccess: updateSuccess } = useOriginalWrite('updateOriginalPrice')
  const { write: buyOriginal, isPending: buyPending, isConfirming: buyConfirming } = useOriginalWrite('buyOriginal')
  const { write: makeOriginalOffer, isPending: offerPending, isConfirming: offerConfirming } = useOriginalWrite('makeOriginalOffer')
  const { write: withdrawOriginalOffer, isPending: cancelPending, isConfirming: cancelConfirming } = useOriginalWrite('withdrawOriginalOffer')
  const { write: acceptOriginalOffer, isPending: acceptPending, isConfirming: acceptConfirming } = useOriginalWrite('acceptOriginalOffer')
  const { write: approveMarketplace, isPending: approvePending, isConfirming: approveConfirming } = useOriginalNftWrite('setApprovalForAll')

  const isOwner = connectedAddress && owner && connectedAddress.toLowerCase() === owner.toLowerCase()
  const hasOffer = myOffer && myOffer > 0n
  const loading = listPending || listConfirming || delistPending || delistConfirming || updatePending || updateConfirming || buyPending || buyConfirming || offerPending || offerConfirming || cancelPending || cancelConfirming || acceptPending || acceptConfirming || approvePending || approveConfirming

  const priceNum = Number(listPrice)
  const belowMin = listPrice !== '' && priceNum < MIN_PRICE
  const samePrice = isForSale && listPrice !== '' && !belowMin && price && parseXDC(listPrice) === price

  // Calculate volume from sales history
  const totalVolume = salesHistory?.reduce((sum, sale) => sum + sale.price, 0n) ?? 0n

  // Clear price input only after transaction succeeds
  useEffect(() => {
    if (listSuccess || updateSuccess) setListPrice('')
  }, [listSuccess, updateSuccess])

  function handleList() {
    const wei = parseXDC(listPrice)
    if (wei <= 0n) return
    // listOriginal([wei])
    // setListPrice('') // moved to useEffect on success
    listOriginal([wei])
  }

  function handleUpdatePrice() {
    const wei = parseXDC(listPrice)
    if (wei <= 0n) return
    // updateOriginalPrice([wei])
    // setListPrice('') // moved to useEffect on success
    updateOriginalPrice([wei])
  }

  function handleDelist() {
    delistOriginal([])
  }

  function handleBuy() {
    buyOriginal([price], price)
  }

  function handleMakeOffer() {
    const wei = parseXDC(offerAmount)
    if (wei <= 0n) return
    makeOriginalOffer([], wei)
    setOfferAmount('')
  }

  function handleCancelOffer() {
    withdrawOriginalOffer([])
  }

  function handleAcceptOffer(bidderAddress) {
    acceptOriginalOffer([bidderAddress])
  }

  function handleApprove() {
    approveMarketplace([ORIGINAL_MARKETPLACE_ADDRESS, true])
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-xdc-muted hover:text-white transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
        </svg>
        Back
      </button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left: Image */}
        <div className="rounded-xl overflow-hidden border border-xdc-border">
          <img src="/nfts/original" alt="Ethereum Killer — The Original" className="w-full h-auto" />
        </div>

        {/* Right: Details + Actions */}
        <div className="space-y-6">
          <div>
            <p className="text-xs text-xdc-accent font-semibold uppercase tracking-wider mb-1">Original 1/1</p>
            <h1 className="text-2xl font-bold text-white">Ethereum Killer — The Original</h1>
            {owner && (
              <p className="text-sm text-xdc-muted mt-1">
                Owned by{' '}
                <a href={`/profile/${owner}`} className="text-xdc-accent hover:underline">
                  {isOwner ? 'you' : formatAddress(owner)}
                </a>
              </p>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-xdc-card border border-xdc-border rounded-lg p-3">
              <p className="text-xs text-xdc-muted">Sales</p>
              <p className="text-lg font-bold text-white">{salesHistory?.length ?? 0}</p>
            </div>
            <div className="bg-xdc-card border border-xdc-border rounded-lg p-3">
              <p className="text-xs text-xdc-muted">Volume</p>
              <p className="text-lg font-bold text-white">{formatXDC(totalVolume)} <span className="text-xs text-xdc-muted">XDC</span></p>
            </div>
          </div>

          {/* Price + Buy */}
          {isForSale && price > 0n && (
            <div className="bg-xdc-card border border-xdc-border rounded-xl p-4">
              <p className="text-xs text-xdc-muted uppercase">Current Price</p>
              <p className="text-3xl font-bold text-white mt-1">{formatXDC(price)} <span className="text-lg text-xdc-muted">XDC</span></p>
              {!isOwner && connectedAddress && (
                <button
                  onClick={handleBuy}
                  disabled={loading}
                  className="w-full mt-3 py-3 rounded-lg bg-xdc-accent text-white font-semibold hover:bg-blue-600 disabled:opacity-50 transition-colors"
                >
                  {buyPending || buyConfirming ? 'Buying...' : 'Buy Now'}
                </button>
              )}
            </div>
          )}

          {/* Owner: Approve Marketplace */}
          {isOwner && !isApproved && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
              <p className="text-sm text-yellow-400 mb-3">Marketplace not approved. Approve to list or accept offers.</p>
              <button
                onClick={handleApprove}
                disabled={loading}
                className="w-full py-2 rounded-lg bg-yellow-600 text-white text-sm font-semibold hover:bg-yellow-700 disabled:opacity-50 transition-colors"
              >
                {approvePending || approveConfirming ? 'Approving...' : 'Approve Marketplace'}
              </button>
            </div>
          )}

          {/* Owner: Manage Listing */}
          {isOwner && isApproved && (
            <div className="bg-xdc-card border border-xdc-border rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-medium text-xdc-text">Manage Listing</h3>
              {isForSale ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex gap-2">
                      {/* <input type="number" ... /> — replaced with NumberInput for comma formatting */}
                      <NumberInput
                        value={listPrice}
                        onChange={setListPrice}
                        placeholder="New price in XDC (min 25,000)"
                        className={`flex-1 bg-xdc-dark border rounded-lg px-3 py-2 text-sm text-xdc-text placeholder-xdc-muted focus:outline-none ${belowMin || samePrice ? 'border-red-500 focus:border-red-500' : 'border-xdc-border focus:border-xdc-accent'}`}
                      />
                      <button
                        onClick={handleUpdatePrice}
                        disabled={loading || !listPrice || belowMin || samePrice}
                        className="px-4 py-2 rounded-lg bg-xdc-accent text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors"
                      >
                        {updatePending || updateConfirming ? '...' : 'Update Price'}
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
                    {delistPending || delistConfirming ? 'Removing...' : 'Remove from Sale'}
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex gap-2">
                    {/* <input type="number" ... /> — replaced with NumberInput for comma formatting */}
                    <NumberInput
                      value={listPrice}
                      onChange={setListPrice}
                      placeholder="Price in XDC (min 25,000)"
                      className={`flex-1 bg-xdc-dark border rounded-lg px-3 py-2 text-sm text-xdc-text placeholder-xdc-muted focus:outline-none ${belowMin ? 'border-red-500 focus:border-red-500' : 'border-xdc-border focus:border-xdc-accent'}`}
                    />
                    <button
                      onClick={handleList}
                      disabled={loading || !listPrice || belowMin}
                      className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      {listPending || listConfirming ? '...' : 'List for Sale'}
                    </button>
                  </div>
                  {belowMin && <p className="text-xs text-red-400">Minimum price is 25,000 XDC</p>}
                </div>
              )}
            </div>
          )}

          {/* Owner: Incoming Offers */}
          {isOwner && isApproved && activeOffers.length > 0 && (
            <div className="bg-xdc-card border border-xdc-border rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-medium text-xdc-text">Incoming Offers ({activeOffers.length})</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xdc-muted border-b border-xdc-border">
                      <th className="text-left py-2 font-medium">Bidder</th>
                      <th className="text-right py-2 font-medium">Amount</th>
                      <th className="text-right py-2 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeOffers.map((offer) => (
                      <tr key={offer.bidder} className="border-b border-xdc-border/50">
                        <td className="py-2 text-xdc-text">
                          <a href={`/profile/${offer.bidder}`} className="hover:text-xdc-accent">{formatAddress(offer.bidder)}</a>
                        </td>
                        <td className="py-2 text-right text-xdc-accent font-semibold">{formatXDC(offer.amount)} XDC</td>
                        <td className="py-2 text-right">
                          <button
                            onClick={() => handleAcceptOffer(offer.bidder)}
                            disabled={loading}
                            className="px-3 py-1 rounded bg-green-600 text-white text-xs font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                          >
                            {acceptPending || acceptConfirming ? '...' : 'Accept'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Non-owner: Make Offer */}
          {!isOwner && connectedAddress && (
            <div className="bg-xdc-card border border-xdc-border rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-medium text-xdc-text">Make an Offer</h3>
              {hasOffer && (
                <div className="flex items-center justify-between bg-xdc-dark rounded-lg p-3">
                  <span className="text-sm text-xdc-muted">Your offer:</span>
                  <span className="text-sm font-semibold text-xdc-accent">{formatXDC(myOffer)} XDC</span>
                </div>
              )}
              <div className="flex gap-2">
                {/* <input type="number" ... /> — replaced with NumberInput for comma formatting */}
                <NumberInput
                  value={offerAmount}
                  onChange={setOfferAmount}
                  placeholder={hasOffer ? 'New offer amount in XDC' : 'Offer amount in XDC'}
                  className="flex-1 bg-xdc-dark border border-xdc-border rounded-lg px-3 py-2 text-sm text-xdc-text placeholder-xdc-muted focus:outline-none focus:border-xdc-accent"
                />
                <button
                  onClick={handleMakeOffer}
                  disabled={loading || !offerAmount}
                  className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
                >
                  {offerPending || offerConfirming ? '...' : hasOffer ? 'Update Offer' : 'Make Offer'}
                </button>
              </div>
              {hasOffer && (
                <button
                  onClick={handleCancelOffer}
                  disabled={loading}
                  className="w-full py-2 rounded-lg border border-xdc-border text-xdc-muted text-sm hover:border-red-500/50 hover:text-red-400 disabled:opacity-50 transition-colors"
                >
                  {cancelPending || cancelConfirming ? 'Withdrawing...' : 'Withdraw Offer'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom: Sales History */}
      <div className="bg-xdc-card border border-xdc-border rounded-xl p-4">
        <h3 className="text-sm font-medium text-xdc-text mb-3">Sales History ({salesHistory?.length ?? 0})</h3>
        {!salesHistory || salesHistory.length === 0 ? (
          <p className="text-sm text-xdc-muted py-4">No sales history yet.</p>
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
                {[...salesHistory].reverse().map((sale, i) => (
                  <tr key={i} className="border-b border-xdc-border/50">
                    <td className="py-2 text-xdc-text">
                      <a href={`/profile/${sale.seller}`} className="hover:text-xdc-accent">{formatAddress(sale.seller)}</a>
                    </td>
                    <td className="py-2 text-xdc-text">
                      <a href={`/profile/${sale.buyer}`} className="hover:text-xdc-accent">{formatAddress(sale.buyer)}</a>
                    </td>
                    <td className="py-2 text-right text-xdc-accent font-semibold">{formatXDC(sale.price)} XDC</td>
                    <td className="py-2 text-right text-xdc-muted">{formatTimestamp(sale.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
