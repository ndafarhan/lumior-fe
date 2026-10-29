import { ChevronsUpDown, LogOut, UserRound } from 'lucide-react'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useSignOut } from '@/features/auth/use-sign-out'
import { useCurrentUser } from '@/lib/auth/use-session'

/** The signed-in user's name, with account settings and sign out. */
export function AccountMenu({ onNavigate }: { onNavigate?: () => void }) {
  const user = useCurrentUser()
  const signOut = useSignOut()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-between"
          aria-label={`Account: ${user.name}`}
        >
          <span className="flex min-w-0 items-center gap-2">
            <UserRound aria-hidden="true" />
            <span className="truncate">{user.name}</span>
          </span>
          <ChevronsUpDown aria-hidden="true" className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="grid">
          <span>{user.name}</span>
          <span className="text-xs font-normal text-muted-foreground">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/account" onClick={onNavigate}>
            <UserRound aria-hidden="true" />
            Account settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={signOut}>
          <LogOut aria-hidden="true" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
