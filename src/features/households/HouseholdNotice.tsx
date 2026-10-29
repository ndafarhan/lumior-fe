import { Info, X } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

import { useHouseholds } from './context'

/** Shows the household notice, for example "You no longer have access to Kos Jakarta." */
export function HouseholdNotice() {
  const { notice, dismissNotice } = useHouseholds()
  if (!notice) return null
  return (
    <Alert className="mb-6" role="status">
      <Info aria-hidden="true" />
      <AlertDescription className="flex items-center justify-between gap-2">
        {notice}
        <Button variant="ghost" size="icon" aria-label="Dismiss" onClick={dismissNotice}>
          <X aria-hidden="true" />
        </Button>
      </AlertDescription>
    </Alert>
  )
}
