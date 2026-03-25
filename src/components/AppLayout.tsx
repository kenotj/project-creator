// src/components/AppLayout.tsx
import type { ReactNode } from 'react'

interface AppLayoutProps {
  sidebar: ReactNode
  editor: ReactNode
}

export function AppLayout({ sidebar, editor }: AppLayoutProps) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <aside className="w-52 flex-shrink-0 flex flex-col border-r border-border bg-muted/30">
        {sidebar}
      </aside>
      <main className="flex-1 flex flex-col min-w-0">
        {editor}
      </main>
    </div>
  )
}
