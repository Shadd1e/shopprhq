'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Logo from '@/components/Logo'

function PaymentContent() {
  const params   = useSearchParams()
  const status   = params?.get('status') ?? ''
  const isSuccess = !status || status === 'successful' || status === 'completed'

  return (
    <div className="min-h-screen flex items-center justify-center p-5">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Logo />
        </div>

        <div className="bg-white rounded-3xl border border-border shadow-lg p-10 text-center">
          {isSuccess ? (
            <>
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-100 to-green-200
                flex items-center justify-center mx-auto mb-6 text-4xl shadow-sm">
                ✅
              </div>
              <h1 className="font-display font-extrabold text-[1.6rem] tracking-tight text-ink mb-3">
                Payment Successful!
              </h1>
              <p className="text-sm text-ink-3 leading-relaxed mb-8 max-w-xs mx-auto">
                Your order has been confirmed. Head back to WhatsApp — we're
                sending your order details right now.
              </p>
              <a
                href="https://wa.me/"
                className="flex items-center justify-center gap-2 bg-wa text-white
                  font-semibold text-sm py-3.5 px-6 rounded-2xl shadow-wa
                  hover:bg-wa-dark transition-all hover:-translate-y-0.5"
              >
                ↩ Back to WhatsApp
              </a>
              <p className="mt-5 text-xs text-ink-4">
                You can close this page after returning to your chat.
              </p>
            </>
          ) : (
            <>
              <div className="w-20 h-20 rounded-full bg-red-50 flex items-center
                justify-center mx-auto mb-6 text-4xl">
                ❌
              </div>
              <h1 className="font-display font-extrabold text-[1.6rem] tracking-tight text-ink mb-3">
                Payment not completed
              </h1>
              <p className="text-sm text-ink-3 leading-relaxed mb-8 max-w-xs mx-auto">
                Something went wrong with your payment. Please go back to
                WhatsApp and try again.
              </p>
              <a
                href="https://wa.me/"
                className="flex items-center justify-center gap-2 bg-ink text-white
                  font-semibold text-sm py-3.5 px-6 rounded-2xl
                  hover:bg-ink-2 transition-all hover:-translate-y-0.5"
              >
                ↩ Back to WhatsApp
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="skeleton w-16 h-16 rounded-full" />
      </div>
    }>
      <PaymentContent />
    </Suspense>
  )
}
