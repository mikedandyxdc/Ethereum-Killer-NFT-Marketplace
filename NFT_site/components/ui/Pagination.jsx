'use client'

export default function Pagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null

  const pages = []
  const maxVisible = 5
  let start = Math.max(1, currentPage - Math.floor(maxVisible / 2))
  let end = Math.min(totalPages, start + maxVisible - 1)
  if (end - start + 1 < maxVisible) {
    start = Math.max(1, end - maxVisible + 1)
  }

  for (let i = start; i <= end; i++) {
    pages.push(i)
  }

  return (
    <div className="flex items-center gap-2 justify-center mt-6">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        className="px-3 py-1.5 rounded bg-xdc-card border border-xdc-border text-sm disabled:opacity-30 hover:border-xdc-accent transition-colors"
      >
        Prev
      </button>

      {start > 1 && (
        <>
          <button onClick={() => onPageChange(1)} className="px-3 py-1.5 rounded bg-xdc-card border border-xdc-border text-sm hover:border-xdc-accent">1</button>
          {start > 2 && <span className="text-xdc-muted">...</span>}
        </>
      )}

      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onPageChange(p)}
          className={`px-3 py-1.5 rounded text-sm border transition-colors ${
            p === currentPage
              ? 'bg-xdc-accent border-xdc-accent text-white'
              : 'bg-xdc-card border-xdc-border hover:border-xdc-accent'
          }`}
        >
          {p}
        </button>
      ))}

      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="text-xdc-muted">...</span>}
          <button onClick={() => onPageChange(totalPages)} className="px-3 py-1.5 rounded bg-xdc-card border border-xdc-border text-sm hover:border-xdc-accent">{totalPages}</button>
        </>
      )}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className="px-3 py-1.5 rounded bg-xdc-card border border-xdc-border text-sm disabled:opacity-30 hover:border-xdc-accent transition-colors"
      >
        Next
      </button>
    </div>
  )
}
