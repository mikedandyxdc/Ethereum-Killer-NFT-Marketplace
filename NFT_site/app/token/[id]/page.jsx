'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAccount } from 'wagmi'
import { useContractRead } from '@/hooks/useContract'
import { formatXDC, formatTokenId, formatAddress } from '@/utils/format'
import { loadMetadata, getTokenMetadata } from '@/utils/metadata'
import BuyButton from '@/components/token/BuyButton'
import ListingActions from '@/components/token/ListingActions'
import OfferActions from '@/components/token/OfferActions'
import AcceptOffer from '@/components/token/AcceptOffer'
import OffersList from '@/components/token/OffersList'
import SalesHistory from '@/components/token/SalesHistory'
import TraitsDisplay from '@/components/token/TraitsDisplay'
import TransferModal from '@/components/token/TransferModal'

export default function TokenDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const tokenId = parseInt(id, 10)
  const { address: connectedAddress } = useAccount()
  const [metadata, setMetadata] = useState(null)
  const [showTransfer, setShowTransfer] = useState(false)
  const [activeTab, setActiveTab] = useState('offers')

  const paddedId = formatTokenId(tokenId)

  useEffect(() => {
    loadMetadata().then((all) => setMetadata(getTokenMetadata(all, tokenId)))
  }, [tokenId])

  const { data: owner, isError } = useContractRead('ownerOf', [BigInt(tokenId)], { refetchInterval: 10000 })
  const { data: isForSale } = useContractRead('isTokenForSale', [BigInt(tokenId)], { refetchInterval: 10000 })
  const { data: price } = useContractRead('getTokenPrice', [BigInt(tokenId)], { refetchInterval: 10000 })
  const { data: existingOffer } = useContractRead(
    'getCurrentOfferOfAddressForToken',
    connectedAddress ? [BigInt(tokenId), connectedAddress] : undefined,
    { enabled: !!connectedAddress, refetchInterval: 10000 }
  )
  const { data: offerCount } = useContractRead('getOffersForTokenCount', [BigInt(tokenId)], { refetchInterval: 10000 })

  // Load first page of offers for AcceptOffer component
  const count = Number(offerCount || 0)
  const { data: topOffers } = useContractRead(
    'getOffersForToken',
    count > 0 ? [BigInt(tokenId), BigInt(0), BigInt(Math.min(count, 10)), true] : undefined,
    { enabled: count > 0, refetchInterval: 10000 }
  )

  const isOwner = connectedAddress && owner && connectedAddress.toLowerCase() === owner.toLowerCase()

  if (isError) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold text-white mb-2">Token Not Found</h1>
        <p className="text-xdc-muted">Token #{paddedId} does not exist.</p>
      </div>
    )
  }

  const name = metadata?.name || `Ethereum Killer #${paddedId}`
  const imageSrc = `/nfts_full/${encodeURIComponent(`Ethereum Killer#${paddedId}`)}`

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
          <img src={imageSrc} alt={name} className="w-full h-auto" />
        </div>

        {/* Right: Details + Actions */}
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-white">{name}</h1>
            {owner && (
              <p className="text-sm text-xdc-muted mt-1">
                Owned by{' '}
                <a href={`/profile/${owner}`} className="text-xdc-accent hover:underline">
                  {isOwner ? 'you' : formatAddress(owner)}
                </a>
              </p>
            )}
          </div>

          {/* Price + Buy */}
          {isForSale && price && (
            <div className="bg-xdc-card border border-xdc-border rounded-xl p-4">
              <p className="text-xs text-xdc-muted uppercase">Current Price</p>
              <p className="text-3xl font-bold text-white mt-1">{formatXDC(price)} <span className="text-lg text-xdc-muted">XDC</span></p>
              {!isOwner && connectedAddress && (
                <div className="mt-3">
                  <BuyButton tokenId={tokenId} price={price} />
                </div>
              )}
            </div>
          )}

          {/* Owner Actions: List/Delist/Update Price */}
          {isOwner && (
            <div className="bg-xdc-card border border-xdc-border rounded-xl p-4 space-y-4">
              <h3 className="text-sm font-medium text-xdc-text">Manage Listing</h3>
              <ListingActions tokenId={tokenId} isForSale={isForSale} currentPrice={price} />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowTransfer(true)}
                  className="flex-1 py-2 rounded-lg border border-xdc-border text-sm text-xdc-muted hover:border-xdc-accent hover:text-white transition-colors"
                >
                  Transfer / Approve
                </button>
              </div>
            </div>
          )}

          {/* Non-owner: Make Offer */}
          {!isOwner && connectedAddress && (
            <div className="bg-xdc-card border border-xdc-border rounded-xl p-4">
              <h3 className="text-sm font-medium text-xdc-text mb-3">Make an Offer</h3>
              <OfferActions tokenId={tokenId} existingOffer={existingOffer} />
            </div>
          )}

          {/* Owner: Accept Offers */}
          {isOwner && topOffers?.length > 0 && (
            <div className="bg-xdc-card border border-xdc-border rounded-xl p-4">
              <AcceptOffer tokenId={tokenId} offers={topOffers} />
            </div>
          )}

          {/* Traits */}
          {metadata?.attributes && (
            <div>
              <h3 className="text-sm font-medium text-xdc-text mb-2">Traits</h3>
              <TraitsDisplay attributes={metadata.attributes} />
            </div>
          )}
        </div>
      </div>

      {/* Bottom: Offers + Sales History tabs */}
      <div className="bg-xdc-card border border-xdc-border rounded-xl p-4">
        <div className="flex gap-4 border-b border-xdc-border mb-4">
          {['offers', 'history'].map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`pb-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === t
                  ? 'border-xdc-accent text-white'
                  : 'border-transparent text-xdc-muted hover:text-white'
              }`}
            >
              {t === 'offers' ? 'Offers' : 'Sales History'}
            </button>
          ))}
        </div>

        {activeTab === 'offers' ? (
          <OffersList tokenId={tokenId} />
        ) : (
          <SalesHistory tokenId={tokenId} />
        )}
      </div>

      <TransferModal tokenId={tokenId} owner={owner} open={showTransfer} onClose={() => setShowTransfer(false)} />
    </div>
  )
}
