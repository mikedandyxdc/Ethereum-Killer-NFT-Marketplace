'use client'

export default function TraitsDisplay({ attributes }) {
  if (!attributes?.length) return null

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {attributes.map((attr, i) => (
        <div key={i} className="bg-xdc-dark border border-xdc-accent/30 rounded-lg p-2.5 text-center">
          <p className="text-xs text-xdc-accent uppercase">{attr.trait_type}</p>
          <p className="text-sm text-white font-medium mt-0.5">{attr.value}</p>
        </div>
      ))}
    </div>
  )
}
