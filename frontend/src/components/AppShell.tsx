'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { getToken } from '@/lib/auth'

/**
 * AppShell — envolve todas as páginas protegidas.
 * - Mostra a Sidebar
 * - Redireciona para /login se não houver token
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (pathname !== '/login' && !getToken()) {
      router.replace('/login')
    }
  }, [pathname, router])

  if (pathname === '/login') {
    return <>{children}</>
  }

  return (
    <>
      <Sidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </>
  )
}
