'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Logo from '@/components/Logo'

function SuccessIcon() {
  return (
    <div className="w-20 h-20 rounded-full bg-[#25D366]/10 flex items-center justify-center mx-auto mb-7">
      <svg className="w-9 h-9 text-[#25D366]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
      </svg>
    </div>
  )
}

function FailIcon() {
  return (
    <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-7">
      <svg className="w-9 h-9 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </div>
  )
}

function WhatsAppIcon() {
  return (
    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.956 9.956 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2Zm4.406 13.688c-.24-.12-1.43-.703-1.652-.782-.222-.078-.383-.117-.543.118-.16.234-.62.781-.762.94-.14.16-.28.18-.523.06-.24-.12-1.02-.374-1.94-1.195-.718-.638-1.203-1.426-1.344-1.668-.14-.242-.015-.373.106-.493.109-.109.242-.285.363-.426.12-.14.16-.242.242-.403.08-.16.04-.3-.02-.42-.06-.12-.543-1.31-.743-1.793-.196-.473-.396-.41-.543-.417-.14-.007-.3-.009-.46-.009-.16 0-.42.06-.64.3-.22.241-.842.824-.842 2.01 0 1.185.862 2.33.983 2.49.12.16 1.697 2.592 4.113 3.635.575.25 1.024.398 1.373.508.577.184 1.1.158 1.515.096.462-.069 1.43-.584 1.63-1.15.202-.563.202-1.047.141-1.147-.06-.1-.221-.16-.461-.28Z"/>
    </svg>
  )
}

function PaymentContent() {
  const params    = useSearchParams()
  const status    = params?.get('status') ?? ''
  const ref       = params?.get('ref') ?? ''
  const wa        = params?.get('wa') ?? ''
  const isSuccess = !status || status === 'successful' || status === 'completed'

  // Build the deep link back to the conversation.
  // If we have the store's WhatsApp number, link directly to the chat.
  // Fallback: open WhatsApp without a specific number (better than nothing).
  const waHref = wa ? `https://wa.me/${wa}` : 'https://wa.me'

  return (
    <div className="min-h-screen bg-[#F7F6F2] flex items-center justify-center p-5">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex justify-center mb-10">
          <Logo />
        </div>

        <div className="bg-white rounded-3xl border border-[#E8E7E2] shadow-md p-10">
          {isSuccess ? (
            <>
              <SuccessIcon />

              <h1 className="font-display font-extrabold text-2xl tracking-tight text-[#0D0D0C] mb-3 text-center">
                Payment confirmed
              </h1>
              <p className="text-sm text-[#6B6B66] leading-relaxed text-center mb-2">
                Your order has been placed. Head back to WhatsApp — we're sending your order confirmation right now.
              </p>
              {ref && (
                <p className="text-xs text-center font-mono text-[#9E9E99] mb-8">
                  Ref: {ref}
                </p>
              )}
              {!ref && <div className="mb-8" />}

              <a
                href={waHref}
                className="flex items-center justify-center gap-2.5 bg-[#25D366] text-white
                  font-semibold text-sm py-4 px-6 rounded-2xl w-full
                  hover:bg-[#128C7E] transition-all hover:-translate-y-0.5"
              >
                <WhatsAppIcon />
                Back to WhatsApp
              </a>

              <p className="mt-5 text-xs text-[#9E9E99] text-center leading-relaxed">
                You can close this page after returning to your chat.
              </p>
            </>
          ) : (
            <>
              <FailIcon />

              <h1 className="font-display font-extrabold text-2xl tracking-tight text-[#0D0D0C] mb-3 text-center">
                Payment not completed
              </h1>
              <p className="text-sm text-[#6B6B66] leading-relaxed text-center mb-8">
                Something went wrong with your payment. Go back to WhatsApp and try again — your cart is still there.
              </p>

              <a
                href={waHref}
                className="flex items-center justify-center gap-2.5 bg-[#0D0D0C] text-white
                  font-semibold text-sm py-4 px-6 rounded-2xl w-full
                  hover:bg-[#2C2C29] transition-all hover:-translate-y-0.5"
              >
                <WhatsAppIcon />
                Go back to WhatsApp
              </a>

              <p className="mt-5 text-xs text-[#9E9E99] text-center leading-relaxed">
                Your order has not been placed. No charge was made.
              </p>
            </>
          )}
        </div>

        <p className="text-center text-xs text-[#9E9E99] mt-6 font-mono">
          Powered by ShopprHQ
        </p>
      </div>
    </div>
  )
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F7F6F2] flex items-center justify-center">
        <div className="w-16 h-16 rounded-full border-2 border-[#E8E7E2] border-t-[#25D366] animate-spin" />
      </div>
    }>
      <PaymentContent />
    </Suspense>
  )
}
