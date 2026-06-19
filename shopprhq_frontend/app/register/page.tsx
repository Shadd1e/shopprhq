'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function RegisterClosed() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/book-demo')
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A1F10]">
      <p className="text-white/20 text-sm font-mono">Redirecting…</p>
    </div>
  )
}
