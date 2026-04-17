'use client'

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { contractConfig } from '@/lib/contract'
import { toast } from 'sonner'
import { useEffect } from 'react'

// Skip retries for contract reverts (will never succeed on retry),
// but allow retries for network errors (may self-heal)
const smartRetry = (count, error) => !error?.message?.includes('revert') && count < 3

export function useContractRead(functionName, args, options = {}) {
  const { query, ...rest } = options
  return useReadContract({
    ...contractConfig,
    functionName,
    args,
    ...rest,
    query: { retry: smartRetry, ...query },
  })
}

export function useContractWrite(functionName) {
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
      // Parse common errors into user-friendly messages
      // Wallet / RPC errors
      if (full.includes("enough funds") || full.includes('insufficient funds') || full.includes('exceeds the balance')) {
        msg = 'Insufficient funds to complete this transaction'
      } else if (full.includes('User rejected') || full.includes('user rejected')) {
        msg = 'Transaction rejected'
      }
      // Contract custom errors
      else if (full.includes('InsufficientPayment')) {
        msg = 'Payment amount is less than the token price'
      } else if (full.includes('TokenNotForSale')) {
        msg = 'This token is not listed for sale'
      } else if (full.includes('TokenAlreadyForSale')) {
        msg = 'This token is already listed for sale'
      } else if (full.includes('PriceBelowMinimum')) {
        msg = 'Price must be at least 25,000 XDC'
      } else if (full.includes('PriceChanged')) {
        msg = 'Price has changed, please refresh and try again'
      } else if (full.includes('PriceMismatch')) {
        msg = 'Price has changed, please refresh and try again'
      } else if (full.includes('PriceMustBeDifferent')) {
        msg = 'New price must be different from current price'
      } else if (full.includes('CallerIsOwner')) {
        msg = 'You cannot buy your own token'
      } else if (full.includes('CallerNotOwner')) {
        msg = 'You are not the owner of this token'
      } else if (full.includes('CallerNotBidder')) {
        msg = 'You are not the bidder on this offer'
      } else if (full.includes('CallerNotOwnerNorApproved')) {
        msg = 'You are not the owner or approved for this token'
      } else if (full.includes('NoActiveOffer')) {
        msg = 'No active offer exists for this token'
      } else if (full.includes('OfferMustBeGreater')) {
        msg = 'Offer must be greater than existing offer'
      } else if (full.includes('TokenNonexistent')) {
        msg = 'This token does not exist'
      } else if (full.includes('TransferToZeroAddress')) {
        msg = 'Cannot transfer to zero address'
      } else if (full.includes('TransferFailed')) {
        msg = 'Transfer failed'
      } else if (full.includes('ZeroAddress')) {
        msg = 'Invalid zero address'
      } else if (full.includes('ApprovalToCurrentOwner')) {
        msg = 'Cannot approve current owner'
      } else if (full.includes('ApproveToCaller')) {
        msg = 'Cannot approve yourself'
      } else if (full.includes('NoTokensListed')) {
        msg = 'No tokens are currently listed'
      }
      toast.error(msg)
    }
  }, [error])

  function write(args, value) {
    writeContract({
      ...contractConfig,
      functionName,
      args,
      value,
    }, {
      onError: (err) => {
        // Safety net: ensure simulation/connector errors always show feedback
        // The error useEffect handles most cases, but this catches edge cases
        // where the error state doesn't propagate (e.g. stale connector)
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
