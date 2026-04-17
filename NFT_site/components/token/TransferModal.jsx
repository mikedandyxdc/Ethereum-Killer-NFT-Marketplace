'use client'

import { useState } from 'react'
import { useContractWrite } from '@/hooks/useContract'
import Modal from '@/components/ui/Modal'

export default function TransferModal({ tokenId, owner, open, onClose }) {
  const [tab, setTab] = useState('transfer')
  const [toAddress, setToAddress] = useState('')
  const { write: transfer, isPending: transferPending } = useContractWrite('transferFrom')
  const { write: safeTransfer, isPending: safePending } = useContractWrite('safeTransferFrom')
  const { write: approve, isPending: approvePending } = useContractWrite('approve')

  const loading = transferPending || safePending || approvePending

  function handleTransfer() {
    if (!toAddress) return
    transfer([owner, toAddress, BigInt(tokenId)])
    setToAddress('')
  }

  function handleSafeTransfer() {
    if (!toAddress) return
    safeTransfer([owner, toAddress, BigInt(tokenId)])
    setToAddress('')
  }

  function handleApprove() {
    if (!toAddress) return
    approve([toAddress, BigInt(tokenId)])
    setToAddress('')
  }

  return (
    <Modal open={open} onClose={onClose} title="Transfer / Approve">
      <div className="flex gap-2 mb-4">
        {['transfer', 'approve'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded text-sm ${
              tab === t ? 'bg-xdc-accent text-white' : 'bg-xdc-dark text-xdc-muted'
            }`}
          >
            {t === 'transfer' ? 'Transfer' : 'Approve'}
          </button>
        ))}
      </div>

      <input
        type="text"
        value={toAddress}
        onChange={(e) => setToAddress(e.target.value)}
        placeholder={tab === 'transfer' ? 'Recipient address (0x...)' : 'Approved address (0x...)'}
        className="w-full bg-xdc-dark border border-xdc-border rounded-lg px-3 py-2 text-sm text-xdc-text placeholder-xdc-muted focus:outline-none focus:border-xdc-accent mb-3"
      />

      {tab === 'transfer' ? (
        <div className="flex gap-2">
          <button
            onClick={handleTransfer}
            disabled={loading || !toAddress}
            className="flex-1 py-2 rounded-lg bg-xdc-accent text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors"
          >
            {transferPending ? '...' : 'Transfer'}
          </button>
          <button
            onClick={handleSafeTransfer}
            disabled={loading || !toAddress}
            className="flex-1 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {safePending ? '...' : 'Safe Transfer'}
          </button>
        </div>
      ) : (
        <button
          onClick={handleApprove}
          disabled={loading || !toAddress}
          className="w-full py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
        >
          {approvePending ? '...' : 'Approve'}
        </button>
      )}
    </Modal>
  )
}
