'use client'

import { useState } from 'react'
import { TRAIT_TYPES } from '@/utils/metadata'
import NumberInput from '@/components/ui/NumberInput'

export default function TraitFilter({ traitOptions, selectedTraits, onTraitChange, priceRange, onPriceRangeChange }) {
  const [expandedTraits, setExpandedTraits] = useState({})

  function toggleExpand(traitType) {
    setExpandedTraits((prev) => ({ ...prev, [traitType]: !prev[traitType] }))
  }

  function handleCheck(traitType, value) {
    const current = selectedTraits[traitType] || []
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value]
    onTraitChange(traitType, updated)
  }

  const hasActiveFilters = Object.values(selectedTraits).some((v) => v.length > 0) ||
    priceRange.min !== '' || priceRange.max !== ''

  function clearAll() {
    TRAIT_TYPES.forEach((t) => onTraitChange(t, []))
    onPriceRangeChange({ min: '', max: '' })
  }

  return (
    <div className="w-full lg:w-64 shrink-0 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Filters</h3>
        {hasActiveFilters && (
          <button onClick={clearAll} className="text-xs text-xdc-accent hover:underline">
            Clear all
          </button>
        )}
      </div>

      {/* Price Range */}
      <div className="bg-xdc-card border border-xdc-border rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-xdc-text">Price Range (XDC)</p>
          {(priceRange.min !== '' || priceRange.max !== '') && (
            <button onClick={() => onPriceRangeChange({ min: '', max: '' })} className="text-xs text-xdc-accent hover:underline">
              Clear
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* <input type="number" ... /> x2 — replaced with NumberInput for comma formatting */}
          <NumberInput
            value={priceRange.min}
            onChange={(v) => onPriceRangeChange({ ...priceRange, min: v })}
            placeholder="Min"
            className="w-full bg-xdc-dark border border-xdc-border rounded px-2 py-1.5 text-sm text-xdc-text placeholder-xdc-muted focus:outline-none focus:border-xdc-accent"
          />
          <span className="text-xdc-muted">-</span>
          <NumberInput
            value={priceRange.max}
            onChange={(v) => onPriceRangeChange({ ...priceRange, max: v })}
            placeholder="Max"
            className="w-full bg-xdc-dark border border-xdc-border rounded px-2 py-1.5 text-sm text-xdc-text placeholder-xdc-muted focus:outline-none focus:border-xdc-accent"
          />
        </div>
      </div>

      {/* Trait Filters */}
      {TRAIT_TYPES.map((traitType) => {
        const values = traitOptions[traitType] || []
        const selected = selectedTraits[traitType] || []
        const isExpanded = expandedTraits[traitType]

        return (
          <div key={traitType} className="bg-xdc-card border border-xdc-border rounded-lg overflow-hidden">
            <button
              onClick={() => toggleExpand(traitType)}
              className="w-full flex items-center justify-between p-3 text-sm font-medium text-xdc-text hover:bg-xdc-dark/50 transition-colors"
            >
              <span>
                {traitType}
                {selected.length > 0 && (
                  <span className="ml-2 text-xs text-xdc-accent">({selected.length})</span>
                )}
              </span>
              <span className="flex items-center gap-2">
                {selected.length > 0 && (
                  <span
                    onClick={(e) => { e.stopPropagation(); onTraitChange(traitType, []) }}
                    className="text-xs text-xdc-accent hover:underline"
                  >
                    Clear
                  </span>
                )}
                <span className="text-xdc-muted">{isExpanded ? '−' : '+'}</span>
              </span>
            </button>
            {isExpanded && (
              <div className="px-3 pb-3 max-h-48 overflow-y-auto space-y-1">
                {values.map((val) => (
                  <label key={val} className="flex items-center gap-2 py-0.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={selected.includes(val)}
                      onChange={() => handleCheck(traitType, val)}
                      className="rounded border-xdc-border text-xdc-accent focus:ring-xdc-accent"
                    />
                    <span className="text-xs text-xdc-muted group-hover:text-xdc-text transition-colors">{val}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
