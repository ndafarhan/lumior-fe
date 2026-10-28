import { WifiOff } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useBackendHealth } from '@/lib/api/health'

export function BackendStatusBanner() {
  const { isUnavailable } = useBackendHealth()
  if (!isUnavailable) return null

  return (
    <Alert variant="destructive" className="mb-6">
      <WifiOff aria-hidden="true" />
      <AlertTitle>Server unavailable</AlertTitle>
      <AlertDescription>
        Lumior cannot reach its server right now, so data may be out of date and changes may not be
        saved. We will keep checking.
      </AlertDescription>
    </Alert>
  )
}
