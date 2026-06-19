'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Logo from '@/components/Logo'

export default function Navbar() {
  const path = usePathname()
  const isHome = path === '/'

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/8 bg-[#0A1F10]/80 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between gap-4">
        <Logo dark />
        <div className="hidden sm:flex items-center gap-7 text-sm font-medium text-white/50">
          <Link href="/how-it-works" className="hover:text-white transition-colors">
            How it works
          </Link>
          <Link href="/#why" className="hover:text-white transition-colors">
            Why ShopprHQ
          </Link>
        </div>
        <Link
          href="/book-demo"
          className="text-sm font-semibold px-5 py-2 rounded-full bg-[#25D366] text-[#0A1F10] hover:bg-[#1fba57] transition-colors"
        >
          Book a demo
        </Link>
      </div>
    </nav>
  )
}
