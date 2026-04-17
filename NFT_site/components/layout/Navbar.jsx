'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { ConnectButton } from '@rainbow-me/rainbowkit'

export default function Navbar() {
  const [searchInput, setSearchInput] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  function handleSearch(e) {
    e.preventDefault()
    const val = searchInput.trim()
    if (!val) return

    // Wallet address
    if (val.startsWith('0x') && val.length === 42) {
      router.push(`/profile/${val}`)
      setSearchInput('')
      setMenuOpen(false)
      return
    }

    // Token ID
    const num = parseInt(val, 10)
    if (!isNaN(num) && num >= 0 && num <= 9999) {
      router.push(`/token/${num}`)
      setSearchInput('')
      setMenuOpen(false)
      return
    }
  }

  function navLink(href, label) {
    const active = pathname === href || pathname.startsWith(href + '/')
    return (
      <Link
        href={href}
        onClick={() => setMenuOpen(false)}
        className={`${active ? 'text-white' : 'text-xdc-muted'} hover:text-white transition-colors`}
      >
        {label}
      </Link>
    )
  }

  return (
    <nav className="border-b border-xdc-border bg-xdc-dark/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-4">
        <Link href="/" className="text-xl font-bold text-white whitespace-nowrap">
          Ethereum Killer
        </Link>

        <div className="hidden md:flex items-center gap-6 ml-4">
          {navLink('/browse', 'Browse')}
          {navLink('/activity', 'Activity')}
        </div>

        <form onSubmit={handleSearch} className="hidden md:block flex-1 max-w-md mx-4">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by Token ID or Wallet Address..."
            className="w-full bg-xdc-card border border-xdc-border rounded-lg px-4 py-2 text-sm text-xdc-text placeholder-xdc-muted focus:outline-none focus:border-xdc-accent transition-colors"
          />
        </form>

        <div className="flex-1 md:flex-none" />

        <div className="flex items-center gap-3">
          <div className="hidden md:block">{navLink('/profile', 'Profile')}</div>
          <ConnectButton showBalance={false} chainStatus="icon" accountStatus="avatar" />
          {/* Hamburger button — mobile only */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-2 text-xdc-muted hover:text-white transition-colors"
            aria-label="Toggle menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-xdc-border bg-xdc-dark/95 backdrop-blur-sm px-4 py-3 space-y-3">
          <form onSubmit={handleSearch}>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Token ID or Address..."
              className="w-full bg-xdc-card border border-xdc-border rounded-lg px-4 py-2 text-sm text-xdc-text placeholder-xdc-muted focus:outline-none focus:border-xdc-accent transition-colors"
            />
          </form>
          <div className="flex flex-col gap-2 text-sm">
            {navLink('/browse', 'Browse')}
            {navLink('/activity', 'Activity')}
            {navLink('/profile', 'Profile')}
          </div>
        </div>
      )}
    </nav>
  )
}
