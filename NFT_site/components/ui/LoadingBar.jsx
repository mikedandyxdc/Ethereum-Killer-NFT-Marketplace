'use client'

export default function LoadingBar({ percent = 0 }) {
  const width = Math.max(0, Math.min(1, percent)) * 100
  return (
    <div className="w-full h-1.5 bg-xdc-border rounded-full overflow-hidden">
      <div
        className="h-full bg-xdc-accent rounded-full transition-all duration-300 ease-out"
        style={{ width: `${width}%` }}
      />
    </div>
  )
}
