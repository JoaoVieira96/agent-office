import type { Metadata } from 'next'
import './globals.css'
import { AppShell } from '@/components/AppShell'

export const metadata: Metadata = {
  title: 'Agent Office',
  description: 'O teu escritório de agentes de IA',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt" suppressHydrationWarning>
      <body className="flex h-screen overflow-hidden bg-surface text-white">
        <AppShell>
          {children}
        </AppShell>
      </body>
    </html>
  )
}
