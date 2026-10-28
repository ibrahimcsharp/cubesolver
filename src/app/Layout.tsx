import { Box } from 'lucide-react'
import { Link, NavLink, Outlet, ScrollRestoration } from 'react-router'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/scan', label: 'Scan' },
  { to: '/upload', label: 'Upload' },
  { to: '/manual', label: 'Enter by hand' },
  { to: '/notation', label: 'Learn notation' },
]

export function Layout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-card border-b">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 text-lg font-semibold">
            <Box className="text-primary size-6" aria-hidden />
            CubeSolver
          </Link>
          <nav aria-label="Main" className="flex flex-wrap gap-1 text-sm">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn('hover:bg-muted rounded-md px-3 py-1.5', isActive && 'bg-muted font-medium')
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Outlet />
        <ScrollRestoration />
      </main>
      <footer className="text-muted-foreground border-t py-4 text-center text-xs">
        Your camera feed stays on your computer. Nothing is uploaded.
      </footer>
    </div>
  )
}
