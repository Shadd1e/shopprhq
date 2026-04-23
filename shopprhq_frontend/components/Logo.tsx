import Link from 'next/link'
import Image from 'next/image'
import { cn } from '@/lib/utils'

interface LogoProps {
  href?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
  dark?: boolean
}

export default function Logo({ href = '/', size = 'md', className, dark }: LogoProps) {
  const s = {
    sm: { px: 28, text: 'text-lg'  },
    md: { px: 34, text: 'text-xl'  },
    lg: { px: 42, text: 'text-2xl' },
  }[size]

  return (
    <Link
      href={href}
      className={cn('flex items-center gap-2 no-underline shrink-0', className)}
    >
      <Image
        src="/logo.png"
        alt="ShopprHQ"
        width={s.px}
        height={s.px}
        className="shrink-0"
        priority
      />
      <span
        className={cn(
          s.text,
          'font-display font-extrabold tracking-tight leading-none',
          dark ? 'text-white' : 'text-ink',
        )}
      >
        Shoppr<span className={dark ? 'text-wa' : 'text-wa-dark'}>HQ</span>
      </span>
    </Link>
  )
}
