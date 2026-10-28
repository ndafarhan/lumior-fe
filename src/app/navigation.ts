import {
  LayoutDashboard,
  ListChecks,
  Receipt,
  ShoppingBasket,
  Sparkles,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

export type NavItem = { to: string; label: string; icon: LucideIcon }

/** The MVP areas, in sidebar order. Each has a route in `routes.tsx`. */
export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/budgets', label: 'Budgets', icon: Wallet },
  { to: '/expenses', label: 'Expenses', icon: Receipt },
  { to: '/catalog', label: 'Catalog', icon: ShoppingBasket },
  { to: '/shopping-lists', label: 'Shopping Lists', icon: ListChecks },
  { to: '/optimize', label: 'Optimize', icon: Sparkles },
]
