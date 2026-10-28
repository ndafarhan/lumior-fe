import { Menu } from 'lucide-react'
import { useState } from 'react'
import { Outlet } from 'react-router'

import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

import { useDocumentTitle } from '../useDocumentTitle'

import { BackendStatusBanner } from './BackendStatusBanner'
import { Brand } from './Brand'
import { NavLinks } from './NavLinks'

/** Sidebar at 1024 px and wider; a top bar with a menu sheet below that. */
export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  useDocumentTitle()

  return (
    <div className="min-h-svh bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col gap-6 border-r bg-sidebar py-5 px-3 lg:flex">
        <Brand />
        <NavLinks label="Main" />
      </aside>

      <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background px-4 lg:hidden">
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open menu">
              <Menu aria-hidden="true" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 gap-6 px-3 py-5">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <Brand />
            <NavLinks label="Menu" onNavigate={() => setMenuOpen(false)} />
          </SheetContent>
        </Sheet>
        <Brand />
      </header>

      <div className="lg:pl-60">
        <main className="mx-auto max-w-6xl p-6 lg:p-8">
          <BackendStatusBanner />
          <Outlet />
        </main>
      </div>
    </div>
  )
}
