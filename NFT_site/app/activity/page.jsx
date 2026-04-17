'use client'

// import { useState } from 'react'
import { Suspense } from 'react'
import { useQueryState, parseAsString } from 'nuqs'
import SalesFeed from '@/components/activity/SalesFeed'
import OffersFeed from '@/components/activity/OffersFeed'

function ActivityPageInner() {
  // const [tab, setTab] = useState('sales')
  const [tab, setTab] = useQueryState('tab', parseAsString.withDefault('sales'))

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Activity</h1>

      <div className="flex gap-4 border-b border-xdc-border">
        {[
          { key: 'sales', label: 'Sales' },
          { key: 'offers', label: 'Offers' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`pb-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? 'border-xdc-accent text-white'
                : 'border-transparent text-xdc-muted hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'sales' ? <SalesFeed /> : <OffersFeed />}
    </div>
  )
}

// Wrapped in Suspense — required because nuqs uses useSearchParams internally.
// Without this wrapper, Next.js build fails with:
// "useSearchParams() should be wrapped in a suspense boundary"
export default function ActivityPage() {
  return (
    <Suspense>
      <ActivityPageInner />
    </Suspense>
  )
}
