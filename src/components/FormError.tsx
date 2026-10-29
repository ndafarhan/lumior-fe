import { AlertCircle } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'

/** A form-level error shown above the fields. Renders nothing without a message. */
export function FormError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <Alert variant="destructive">
      <AlertCircle aria-hidden="true" />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}
