import { useState } from 'react'
import { RouterProvider } from 'react-router'

import { AppProviders } from '@/app/providers'
import { createAppRouter } from '@/app/routes'
import type { AppConfig } from '@/lib/config'

export function App({ config }: { config: AppConfig }) {
  const [router] = useState(createAppRouter)

  return (
    <AppProviders config={config}>
      <RouterProvider router={router} />
    </AppProviders>
  )
}
