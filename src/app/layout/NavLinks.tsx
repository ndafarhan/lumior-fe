import { cn } from 'cn'
import { NavLink } from 'react-router'

import { NAV_ITEMS } from '@/app/navigation'

type NavLinksProps = {
  label: string
  /** Called after a link is chosen, for example to close the mobile menu. */
  onNavigate?: () => void
}

export function NavLinks({ label, onNavigate }: NavLinksProps) {
  return (
    <nav aria-label={label} className="grid gap-1">
      {NAV_ITEMS.map(({ to, label: itemLabel, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
              isActive && 'bg-accent text-accent-foreground',
            )
          }
        >
          <Icon aria-hidden="true" />
          {itemLabel}
        </NavLink>
      ))}
    </nav>
  )
}
