'use client'

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { originalMarketplaceConfig, originalNftConfig } from '@/lib/originalContract'
import { toast } from 'sonner'
import { useEffect } from 'react'

// Skip retries for contract reverts (will never succeed on retry),
// but allow retries for network errors (may self-heal)
const smartRetry = (count, error) => !error?.message?.includes('revert') && count < 3

export function useOriginalRead(functionName, args, options = {}) {
  const { query, ...rest } = options
  return useReadContract({
    ...originalMarketplaceConfig,
    functionName,
    args,
    ...rest,
    query: { retry: smartRetry, ...query },
  })
}

export function useOriginalNftRead(functionName, args, options = {}) {
  const { query, ...rest } = options
  return useReadContract({
    ...originalNftConfig,
    functionName,
    args,
    ...rest,
    query: { retry: smartRetry, ...query },
  })
}

export function useOriginalWrite(functionName) {
  const queryClient = useQueryClient()
  const { data: hash, writeContract, isPending, error } = useWriteContract()

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  useEffect(() => {
    if (hash) {
      toast.loading('Transaction submitted...', { id: hash })
    }
  }, [hash])

  useEffect(() => {
    if (isSuccess && hash) {
      toast.success('Transaction confirmed!', { id: hash })
      queryClient.invalidateQueries()
      queryClient.refetchQueries()
    }
  }, [isSuccess, hash, queryClient])

  useEffect(() => {
    if (error) {
      const full = error.message || error.shortMessage || ''
      let msg = error.shortMessage || 'Transaction failed'
      if (full.includes("enough funds") || full.includes('insufficient funds') || full.includes('exceeds the balance')) {
        msg = 'Insufficient funds to complete this transaction'
      } else if (full.includes('User rejected') || full.includes('user rejected')) {
        msg = 'Transaction rejected'
      } else if (full.includes('OriginalNotSet')) {
        msg = 'Original NFT contract not configured'
      } else if (full.includes('OriginalAlreadySet')) {
        msg = 'Original NFT already configured'
      } else if (full.includes('OriginalNotApproved')) {
        msg = 'Marketplace not approved — please approve first'
      } else if (full.includes('InsufficientPayment')) {
        msg = 'Payment amount is less than the price'
      } else if (full.includes('TokenNotForSale')) {
        msg = 'The Original is not listed for sale'
      } else if (full.includes('TokenAlreadyForSale')) {
        msg = 'The Original is already listed for sale'
      } else if (full.includes('PriceBelowMinimum')) {
        msg = 'Price must be at least 25,000 XDC'
      } else if (full.includes('PriceChanged')) {
        msg = 'Price has changed, please refresh and try again'
      } else if (full.includes('PriceMustBeDifferent')) {
        msg = 'New price must be different from current price'
      } else if (full.includes('CallerIsOwner')) {
        msg = 'You cannot buy your own token'
      } else if (full.includes('CallerNotOwner')) {
        msg = 'You are not the owner of this token'
      } else if (full.includes('NoActiveOffer')) {
        msg = 'No active offer exists'
      } else if (full.includes('OfferMustBeGreater')) {
        msg = 'Offer must be greater than existing offer'
      } else if (full.includes('TransferFailed')) {
        msg = 'Transfer failed'
      }
      toast.error(msg)
    }
  }, [error])

  function write(args, value) {
    writeContract({
      ...originalMarketplaceConfig,
      functionName,
      args,
      value,
    }, {
      onError: (err) => {
        if (!err._toasted) {
          const msg = err.shortMessage || 'Transaction failed'
          toast.error(msg, { id: 'write-error' })
          err._toasted = true
        }
      },
    })
  }

  return { write, hash, isPending, isConfirming, isSuccess, error }
}

export function useOriginalNftWrite(functionName) {
  const queryClient = useQueryClient()
  const { data: hash, writeContract, isPending, error } = useWriteContract()

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  useEffect(() => {
    if (hash) {
      toast.loading('Approving...', { id: hash })
    }
  }, [hash])

  useEffect(() => {
    if (isSuccess && hash) {
      toast.success('Approved!', { id: hash })
      queryClient.invalidateQueries()
      queryClient.refetchQueries()
    }
  }, [isSuccess, hash, queryClient])

  useEffect(() => {
    if (error) {
      const full = error.message || error.shortMessage || ''
      let msg = error.shortMessage || 'Transaction failed'
      if (full.includes('User rejected') || full.includes('user rejected')) {
        msg = 'Transaction rejected'
      }
      toast.error(msg)
    }
  }, [error])

  function write(args) {
    writeContract({
      ...originalNftConfig,
      functionName,
      args,
    })
  }

  return { write, hash, isPending, isConfirming, isSuccess, error }
}
