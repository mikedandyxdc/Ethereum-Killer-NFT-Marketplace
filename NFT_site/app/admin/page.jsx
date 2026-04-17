'use client'

import { useState } from 'react'
import { useAccount } from 'wagmi'
import { useContractRead, useContractWrite } from '@/hooks/useContract'
import { formatAddress } from '@/utils/format'

export default function AdminPage() {
  const { address: connectedAddress } = useAccount()
  const { data: owner } = useContractRead('owner')
  const { data: royaltyOwner } = useContractRead('ROYALTY_OWNER')

  const [newRoyaltyOwner, setNewRoyaltyOwner] = useState('')
  const [newOwner, setNewOwner] = useState('')
  const [confirmRenounce, setConfirmRenounce] = useState(false)

  const { write: setRoyaltyOwner, isPending: royaltyPending } = useContractWrite('setRoyaltyOwner')
  const { write: transferOwnership, isPending: transferPending } = useContractWrite('transferOwnership')
  const { write: renounceOwnership, isPending: renouncePending } = useContractWrite('renounceOwnership')

  const isOwner = connectedAddress && owner && connectedAddress.toLowerCase() === owner.toLowerCase()

  if (!isOwner) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold text-white mb-2">Admin</h1>
        <p className="text-xdc-muted">
          {connectedAddress
            ? 'You are not the contract owner.'
            : 'Connect your wallet to access admin controls.'}
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-white">Admin Panel</h1>

      {/* Info */}
      <div className="bg-xdc-card border border-xdc-border rounded-xl p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-xdc-muted">Contract Owner</span>
          <span className="text-xdc-text">{formatAddress(owner)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-xdc-muted">Royalty Owner</span>
          <span className="text-xdc-text">{royaltyOwner ? formatAddress(royaltyOwner) : '—'}</span>
        </div>
      </div>

      {/* Set Royalty Owner */}
      <div className="bg-xdc-card border border-xdc-border rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-medium text-white">Set Royalty Owner</h3>
        <input
          type="text"
          value={newRoyaltyOwner}
          onChange={(e) => setNewRoyaltyOwner(e.target.value)}
          placeholder="New royalty owner address (0x...)"
          className="w-full bg-xdc-dark border border-xdc-border rounded-lg px-3 py-2 text-sm text-xdc-text placeholder-xdc-muted focus:outline-none focus:border-xdc-accent"
        />
        <button
          onClick={() => { setRoyaltyOwner([newRoyaltyOwner]); setNewRoyaltyOwner('') }}
          disabled={royaltyPending || !newRoyaltyOwner}
          className="w-full py-2 rounded-lg bg-xdc-accent text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors"
        >
          {royaltyPending ? 'Updating...' : 'Update Royalty Owner'}
        </button>
      </div>

      {/* Transfer Ownership */}
      <div className="bg-xdc-card border border-xdc-border rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-medium text-white">Transfer Ownership</h3>
        <input
          type="text"
          value={newOwner}
          onChange={(e) => setNewOwner(e.target.value)}
          placeholder="New owner address (0x...)"
          className="w-full bg-xdc-dark border border-xdc-border rounded-lg px-3 py-2 text-sm text-xdc-text placeholder-xdc-muted focus:outline-none focus:border-xdc-accent"
        />
        <button
          onClick={() => { transferOwnership([newOwner]); setNewOwner('') }}
          disabled={transferPending || !newOwner}
          className="w-full py-2 rounded-lg bg-yellow-600 text-white text-sm font-medium hover:bg-yellow-700 disabled:opacity-50 transition-colors"
        >
          {transferPending ? 'Transferring...' : 'Transfer Ownership'}
        </button>
      </div>

      {/* Renounce Ownership */}
      <div className="bg-xdc-card border border-xdc-border rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-medium text-red-400">Renounce Ownership</h3>
        <p className="text-xs text-xdc-muted">This is irreversible. You will permanently lose admin access.</p>
        {!confirmRenounce ? (
          <button
            onClick={() => setConfirmRenounce(true)}
            className="w-full py-2 rounded-lg border border-red-500/50 text-red-400 text-sm font-medium hover:bg-red-500/10 transition-colors"
          >
            Renounce Ownership
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-red-400 font-medium">Are you sure? This cannot be undone.</p>
            <div className="flex gap-2">
              <button
                onClick={() => { renounceOwnership([]); setConfirmRenounce(false) }}
                disabled={renouncePending}
                className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {renouncePending ? 'Renouncing...' : 'Yes, Renounce'}
              </button>
              <button
                onClick={() => setConfirmRenounce(false)}
                className="flex-1 py-2 rounded-lg border border-xdc-border text-xdc-muted text-sm hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
