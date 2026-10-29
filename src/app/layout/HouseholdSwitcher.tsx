import { ChevronsUpDown, Home, Plus, Settings } from 'lucide-react'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useActiveHousehold, useHouseholds } from '@/features/households/context'

/** Shows the active household; switches, creates, or opens settings for households. */
export function HouseholdSwitcher({ onNavigate }: { onNavigate?: () => void }) {
  const { households, setActive } = useHouseholds()
  const active = useActiveHousehold()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between"
          aria-label={`Household: ${active.name}. Switch household`}
        >
          <span className="flex min-w-0 items-center gap-2">
            <Home aria-hidden="true" />
            <span className="truncate">{active.name}</span>
          </span>
          <ChevronsUpDown aria-hidden="true" className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Households</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={active.id} onValueChange={setActive}>
          {households.map((household) => (
            <DropdownMenuRadioItem key={household.id} value={household.id}>
              {household.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/welcome" onClick={onNavigate}>
            <Plus aria-hidden="true" />
            Create household
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/household" onClick={onNavigate}>
            <Settings aria-hidden="true" />
            Household settings
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
