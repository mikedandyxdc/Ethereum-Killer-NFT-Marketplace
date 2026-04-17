import './globals.css'
import Providers from './providers'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { Toaster } from 'sonner'

export const metadata = {
  title: 'Ethereum Killer NFT Marketplace',
  description: '10,000 unique NFTs on XDC Network — the REAL Ethereum Killer',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex flex-col bg-xdc-dark">
        <Providers>
          <Navbar />
          <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
            {children}
          </main>
          <Footer />
          <Toaster theme="dark" position="bottom-right" richColors />
        </Providers>
      </body>
    </html>
  )
}
