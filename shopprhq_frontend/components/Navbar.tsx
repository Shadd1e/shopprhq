'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Logo from '@/components/Logo'

export default function Navbar() {
  const path = usePathname()

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-white/90 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between gap-4">
        <Logo />
        <div className="hidden sm:flex items-center gap-7 text-sm font-medium text-ink-3">
          <Link href="/how-it-works" className="hover:text-ink transition-colors">
            How it works
          </Link>
          <Link href="/#why" className="hover:text-ink transition-colors">
            Why ShopprHQ
          </Link>
        </div>
        <Link
          href="/book-demo"
          className="text-sm font-semibold px-5 py-2 rounded-full bg-ink text-white hover:bg-ink-2 transition-colors"
        >
          Book a demo
        </Link>
      </div>
    </nav>
  )
}
