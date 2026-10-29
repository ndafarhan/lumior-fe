import type { ReactNode } from 'react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

/** A page with one centered card and no app sidebar: sign-in, registration, onboarding, invites. */
export function CenteredCard({
  title,
  description,
  children,
  footer,
}: {
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <main className="grid min-h-svh place-items-center bg-muted/40 p-4">
      <div className="grid w-full max-w-sm gap-6">
        <div className="flex items-center justify-center gap-2 text-lg font-semibold">
          <img src="/favicon.svg" alt="" className="size-7" />
          Lumior
        </div>
        <Card>
          <CardHeader>
            <CardTitle>
              <h1 className="text-xl">{title}</h1>
            </CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </CardHeader>
          <CardContent className="grid gap-4">{children}</CardContent>
        </Card>
        {footer && <p className="text-center text-sm text-muted-foreground">{footer}</p>}
      </div>
    </main>
  )
}
