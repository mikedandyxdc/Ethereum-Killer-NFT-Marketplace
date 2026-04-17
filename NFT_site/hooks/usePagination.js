'use client'

import { useMemo } from 'react'

const DEFAULT_PAGE_SIZE = 24

export function usePagination(items, pageSize = DEFAULT_PAGE_SIZE, currentPage = 1) {
  const totalPages = Math.max(1, Math.ceil((items?.length || 0) / pageSize))

  const safePage = Math.max(1, Math.min(currentPage, totalPages))

  const paginatedItems = useMemo(() => {
    if (!items?.length) return []
    const start = (safePage - 1) * pageSize
    return items.slice(start, start + pageSize)
  }, [items, safePage, pageSize])

  return {
    currentPage: safePage,
    totalPages,
    paginatedItems,
    pageSize,
    totalItems: items?.length || 0,
  }
}
