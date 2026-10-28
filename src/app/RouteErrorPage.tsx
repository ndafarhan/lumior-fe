import { useQueryErrorResetBoundary } from '@tanstack/react-query'
import { useLocation, useNavigate, useRouteError } from 'react-router'

import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { isApiError } from '@/lib/api/errors'
import { userMessageFor } from '@/lib/api/messages'

/** Replaces the content area when a page throws. Shows the request ID for API errors. */
export function RouteErrorPage() {
  const error = useRouteError()
  const navigate = useNavigate()
  const location = useLocation()
  const { reset } = useQueryErrorResetBoundary()

  const requestId = isApiError(error) ? error.requestId : null

  function retry() {
    reset()
    // Navigating to the current location clears the route error and renders the page again.
    void navigate(location, { replace: true })
  }

  return (
    <div role="alert">
      <PageHeader title="Something went wrong">{userMessageFor(error)}</PageHeader>
      {requestId && (
        <p className="mb-6 text-sm text-muted-foreground">
          If this keeps happening, contact support and mention reference{' '}
          <code className="font-mono text-foreground">{requestId}</code>.
        </p>
      )}
      <Button onClick={retry}>Try again</Button>
    </div>
  )
}
