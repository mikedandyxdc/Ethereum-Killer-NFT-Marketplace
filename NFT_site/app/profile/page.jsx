'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAccount } from 'wagmi'

export default function ProfileRedirect() {
  const { address, isConnected } = useAccount()
  const router = useRouter()

  useEffect(() => {
    if (isConnected && address) {
      router.replace(`/profile/${address}`)
    }
  }, [isConnected, address, router])

  if (!isConnected) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold text-white mb-2">Profile</h1>
        <p className="text-xdc-muted">Connect your wallet to view your profile.</p>
      </div>
    )
  }

  return (
    <div className="text-center py-16">
      <p className="text-xdc-muted">Redirecting...</p>
    </div>
  )
}
