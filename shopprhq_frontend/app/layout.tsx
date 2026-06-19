import type { Metadata } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
})

export const metadata: Metadata = {
  icons: {
    icon:  '/logo.png',
    apple: '/logo.png',
  },
  title: 'ShopprHQ — The employee that pays you',
  description:
    'ShopprHQ turns your WhatsApp number into a fully automated storefront. From hello to completed sale — no staff, no missed orders, no chasing payments.',
  metadataBase: new URL('https://shopprhq.com'),
  openGraph: {
    title: 'ShopprHQ — The employee that pays you',
    description: 'From hello to completed sale. Handles every conversation, any hour, any volume.',
    url: 'https://shopprhq.com',
    siteName: 'ShopprHQ',
    locale: 'en_NG',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ShopprHQ — The employee that pays you',
    description: 'From hello to completed sale. Any hour. Any volume.',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="font-sans bg-white text-ink antialiased">
        <div className="relative z-[1]">{children}</div>
      </body>
    </html>
  )
}
