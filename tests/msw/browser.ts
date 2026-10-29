import { HttpResponse, http } from 'msw'
import { setupWorker } from 'msw/browser'

import { FakeBackend, type FakeState } from './fake-backend'

// Development mock mode only: the fake backend's data (including the simulated refresh
// cookie) is kept in localStorage so a reload keeps the session. Never used in production.
const STORAGE_KEY = 'lumior.mock.state'

export const DEMO_USER = { name: 'Demo User', email: 'demo@lumior.test', password: 'password123' }

function loadState(backend: FakeBackend): boolean {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return false
    backend.load(JSON.parse(saved) as FakeState)
    return true
  } catch {
    return false
  }
}

function saveState(state: FakeState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage unavailable: the mock state lasts until the page is reloaded.
  }
}

/** Starts the MSW worker that answers requests to `apiBaseUrl` from the fake backend. */
export async function startMockWorker(apiBaseUrl: string) {
  const backend = new FakeBackend()
  if (!loadState(backend)) {
    const demo = backend.addUser(DEMO_USER)
    backend.addHousehold('Demo Household', demo.id)
  }
  backend.onChange = saveState
  saveState(backend.state)

  const worker = setupWorker(
    http.get(`${apiBaseUrl}/health/ready`, () =>
      HttpResponse.json({ status: 'ok', checks: { database: 'ok' } }),
    ),
    ...backend.handlers(apiBaseUrl),
  )
  await worker.start({ onUnhandledFrame: 'bypass' })
  console.info(
    `[mock] API mocking is on. Sign in as ${DEMO_USER.email} / ${DEMO_USER.password}. ` +
      `Reset with localStorage.removeItem('${STORAGE_KEY}').`,
  )
}
