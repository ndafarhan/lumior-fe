import { Link } from 'react-router'

import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Page not found">
        The page you are looking for does not exist or has moved.
      </PageHeader>
      <Button asChild>
        <Link to="/">Go to the dashboard</Link>
      </Button>
    </>
  )
}
