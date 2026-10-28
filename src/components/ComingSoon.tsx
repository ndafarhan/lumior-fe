import { Card, CardContent } from '@/components/ui/card'

import { PageHeader } from './PageHeader'

/** Placeholder for an MVP area whose feature has not been delivered yet. */
export function ComingSoon({ area, description }: { area: string; description?: string }) {
  return (
    <>
      <PageHeader title={area}>{description}</PageHeader>
      <Card>
        <CardContent>
          <p className="font-medium">Coming soon</p>
          <p className="text-sm text-muted-foreground">
            {area} is not available yet. It will appear here in an upcoming release.
          </p>
        </CardContent>
      </Card>
    </>
  )
}
