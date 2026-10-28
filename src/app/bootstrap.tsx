import { StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { App } from '@/app/App'
import { ConfigErrorScreen } from '@/app/ConfigErrorScreen'
import { parseConfig } from '@/lib/config'

/** Validates configuration, then renders either the app or the configuration error screen. */
export function renderApp(container: HTMLElement, env: Record<string, unknown>): Root {
  const root = createRoot(container)
  const result = parseConfig(env)
  root.render(
    <StrictMode>
      {result.ok ? <App config={result.config} /> : <ConfigErrorScreen issues={result.issues} />}
    </StrictMode>,
  )
  return root
}
