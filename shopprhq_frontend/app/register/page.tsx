'use client'

/**
 * /register — public self-registration is no longer available.
 * Redirects to the landing page where the application form lives.
 */

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function RegisterClosed() {
  const router = useRouter()

  useEffect(() => {
    // Redirect immediately to the landing page which has the application form
    router.replace('/#apply')
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <p className="text-ink-3 text-sm">Redirecting…</p>
    </div>
  )
}
