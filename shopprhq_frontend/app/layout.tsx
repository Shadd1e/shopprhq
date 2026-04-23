import type { Metadata } from 'next'
import { DM_Sans, Bricolage_Grotesque } from 'next/font/google'
import './globals.css'
import dynamic from 'next/dynamic'

const DoodleBackground = dynamic(() => import('@/components/DoodleBackground'), { ssr: false })

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
  weight: ['300', '400', '500', '600'],
})

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
  display: 'swap',
  weight: ['600', '700', '800'],
})

export const metadata: Metadata = {
  icons: {
    icon:  '/logo.png',
    apple: '/logo.png',
  },
  title: 'ShopprHQ — WhatsApp Commerce',
  description:
    'Turn your WhatsApp number into a full storefront. Customers browse, add to cart, and pay — all in the chat. Set up in 60 seconds.',
  metadataBase: new URL('https://shopprhq.com'),
  openGraph: {
    title: 'ShopprHQ — WhatsApp Commerce',
    description: 'Turn your WhatsApp into a storefront. Live in under 24 hours.',
    url: 'https://shopprhq.com',
    siteName: 'ShopprHQ',
    locale: 'en_NG',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ShopprHQ — WhatsApp Commerce',
    description: 'Turn your WhatsApp into a storefront. Live in under 24 hours.',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${bricolage.variable}`}>
      <body className="font-sans bg-bg text-ink antialiased">
        <DoodleBackground />
        <div className="relative z-[1]">{children}</div>
      </body>
    </html>
  )
}
