import { Loader2 } from 'lucide-react'

/** Shown while the app decides what to render, for example while restoring the session. */
export function FullPageLoader({ label = 'Loading Lumior…' }: { label?: string }) {
  return (
    <div className="grid min-h-svh place-items-center" role="status">
      <Loader2 className="size-8 animate-spin text-muted-foreground" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  )
}
