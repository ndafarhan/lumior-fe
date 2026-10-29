import { renderApp } from '@/app/bootstrap'

import './index.css'

/** In development with `VITE_API_MOCKING=true`, serve the API from the in-browser fake backend. */
async function enableApiMocking() {
  if (!import.meta.env.DEV || import.meta.env.VITE_API_MOCKING !== 'true') return
  const { startMockWorker } = await import('../tests/msw/browser')
  await startMockWorker(String(import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, ''))
}

void enableApiMocking().then(() => renderApp(document.getElementById('root')!, import.meta.env))
