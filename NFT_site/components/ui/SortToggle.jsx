'use client'

export default function SortToggle({ label, ascending, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center justify-center gap-1.5 p-2 rounded bg-xdc-card border border-xdc-border hover:border-xdc-accent transition-colors"
    >
      {label && <span className="text-sm text-xdc-muted">{label}</span>}
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-xdc-accent">
        {ascending ? (
          <path fillRule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.57a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-3.958V16.25A.75.75 0 0110 17z" clipRule="evenodd" />
        ) : (
          <path fillRule="evenodd" d="M10 3a.75.75 0 01.75.75v10.638l3.96-3.958a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 3.958V3.75A.75.75 0 0110 3z" clipRule="evenodd" />
        )}
      </svg>
    </button>
  )
}
