'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

// ── Country codes ─────────────────────────────────────────────────────────
// Previously duplicated in app/onboarding/page.tsx and app/dashboard/setup/page.tsx.
// Edit here only — both pages import from this file.

export const COUNTRY_CODES = [
  { code: '234', flag: '🇳🇬', name: 'Nigeria' },
  { code: '233', flag: '🇬🇭', name: 'Ghana' },
  { code: '254', flag: '🇰🇪', name: 'Kenya' },
  { code: '27',  flag: '🇿🇦', name: 'South Africa' },
  { code: '255', flag: '🇹🇿', name: 'Tanzania' },
  { code: '256', flag: '🇺🇬', name: 'Uganda' },
  { code: '251', flag: '🇪🇹', name: 'Ethiopia' },
  { code: '250', flag: '🇷🇼', name: 'Rwanda' },
  { code: '237', flag: '🇨🇲', name: 'Cameroon' },
  { code: '225', flag: '🇨🇮', name: "Cote d'Ivoire" },
  { code: '221', flag: '🇸🇳', name: 'Senegal' },
  { code: '212', flag: '🇲🇦', name: 'Morocco' },
  { code: '20',  flag: '🇪🇬', name: 'Egypt' },
  { code: '44',  flag: '🇬🇧', name: 'United Kingdom' },
  { code: '1',   flag: '🇺🇸', name: 'United States' },
]

// ── Number helpers ────────────────────────────────────────────────────────

export function normaliseLocal(raw: string, cc: string): string {
  let d = raw.replace(/\D/g, '')
  if (d.startsWith(cc)) d = d.slice(cc.length)
  if (d.startsWith('0')) d = d.slice(1)
  return d
}

export function buildFull(local: string, cc: string): string {
  return cc + local.replace(/\D/g, '').replace(/^0/, '')
}

export function formatPreview(local: string, cc: string): string {
  const full = buildFull(local, cc)
  return full.length >= 7 ? '+' + full : ''
}

export function validateLocal(local: string, cc: string): string | null {
  const full = buildFull(local, cc)
  if (!local.trim()) return 'Enter your phone number.'
  if (full.length < 7) return 'That number is too short.'
  if (full.length > 15) return 'That number is too long. Check for extra digits.'
  if (new Set(full).size === 1) return "That doesn't look like a real phone number."
  if (['123456789', '1234567890'].includes(full)) return "That doesn't look like a real phone number."
  return null
}

// ── Delete guide ──────────────────────────────────────────────────────────

export function DeleteGuide() {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-amber-200 rounded-2xl overflow-hidden">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-amber-50
          text-left text-xs font-semibold text-amber-800 hover:bg-amber-100 transition-colors">
        <span>How to properly delete WhatsApp from this number</span>
        <span className={cn('transition-transform text-amber-500 text-[10px]', open && 'rotate-180')}>▼</span>
      </button>
      {open && (
        <div className="px-4 py-4 bg-amber-50/50 space-y-4 text-xs text-amber-900 leading-relaxed border-t border-amber-200">
          <p className="font-semibold text-amber-800">
            Uninstalling the app is NOT the same as deleting your account. Delete the account first.
          </p>
          <div>
            <p className="font-bold mb-1.5">On iPhone</p>
            <ol className="list-decimal list-inside space-y-1 text-amber-800">
              <li>Open WhatsApp on that phone</li>
              <li>Tap Settings (bottom right)</li>
              <li>Tap Account</li>
              <li>Tap Delete My Account</li>
              <li>Enter the number and confirm</li>
              <li>Then uninstall the app</li>
            </ol>
          </div>
          <div>
            <p className="font-bold mb-1.5">On Android</p>
            <ol className="list-decimal list-inside space-y-1 text-amber-800">
              <li>Open WhatsApp</li>
              <li>Tap the three dots top right, then Settings</li>
              <li>Tap Account</li>
              <li>Tap Delete My Account</li>
              <li>Enter your number and confirm</li>
              <li>Then uninstall the app</li>
            </ol>
          </div>
          <div>
            <p className="font-bold mb-1.5">WhatsApp Business App</p>
            <ol className="list-decimal list-inside space-y-1 text-amber-800">
              <li>Open WhatsApp Business</li>
              <li>More options, then Settings</li>
              <li>Tap Account, then Delete My Account</li>
              <li>Enter your number and confirm</li>
              <li>Then uninstall the app</li>
            </ol>
          </div>
          <p className="text-amber-700 font-medium">
            Once deleted, come back and submit your number. It usually takes a few minutes to clear on Meta's side.
          </p>
        </div>
      )}
    </div>
  )
}
