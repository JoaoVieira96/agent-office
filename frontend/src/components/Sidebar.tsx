'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { BotMessageSquare, Puzzle, Webhook, Settings, LogOut } from 'lucide-react'
import clsx from 'clsx'
import { clearToken } from '@/lib/auth'

const nav = [
  { href: '/',       icon: BotMessageSquare, label: 'Escritório' },
  { href: '/skills', icon: Puzzle,           label: 'Skills'     },
  { href: '/hooks',  icon: Webhook,          label: 'Hooks'      },
]

export function Sidebar() {
  const path   = usePathname()
  const router = useRouter()

  function logout() {
    clearToken()
    router.replace('/login')
  }

  return (
    <aside className="w-14 flex flex-col items-center py-4 gap-2 bg-panel border-r border-border shrink-0">
      {/* Logo */}
      <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center mb-4 shrink-0">
        <BotMessageSquare size={16} className="text-white" />
      </div>

      {nav.map(({ href, icon: Icon, label }) => {
        const active = href === '/' ? path === '/' : path.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            title={label}
            className={clsx(
              'w-9 h-9 rounded-lg flex items-center justify-center transition-colors',
              active
                ? 'bg-accent text-white'
                : 'text-muted hover:text-white hover:bg-border'
            )}
          >
            <Icon size={17} />
          </Link>
        )
      })}

      <div className="flex-1" />

      <Link
        href="/settings"
        title="Definições"
        className="w-9 h-9 rounded-lg flex items-center justify-center text-muted hover:text-white hover:bg-border transition-colors"
      >
        <Settings size={17} />
      </Link>

      <button
        onClick={logout}
        title="Terminar sessão"
        className="w-9 h-9 rounded-lg flex items-center justify-center text-muted hover:text-red-400 hover:bg-border transition-colors"
      >
        <LogOut size={17} />
      </button>
    </aside>
  )
}
