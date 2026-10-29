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

/** The local calendar date `daysAgo` days before today, as `YYYY-MM-DD`. */
function localDate(daysAgo: number) {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** A few recent expenses, so the Expenses page has something to show. */
function seedDemoExpenses(backend: FakeBackend, householdId: string) {
  const expenses = [
    { daysAgo: 12, amount: '350000', category: 'Utilities', note: 'Electricity' },
    { daysAgo: 6, amount: '185000', category: 'Groceries', note: 'Weekly market' },
    { daysAgo: 3, amount: '42500', category: 'Dining out', note: null },
    { daysAgo: 1, amount: '25000', category: 'Transport', note: 'Ride to the office' },
    { daysAgo: 0, amount: '96750', category: 'Groceries', note: null },
  ]
  for (const { daysAgo, ...expense } of expenses) {
    backend.addExpense(householdId, { ...expense, spentOn: localDate(daysAgo) })
  }
}

/** Starts the MSW worker that answers requests to `apiBaseUrl` from the fake backend. */
export async function startMockWorker(apiBaseUrl: string) {
  const backend = new FakeBackend()
  if (!loadState(backend)) {
    const demo = backend.addUser(DEMO_USER)
    const household = backend.addHousehold('Demo Household', demo.id)
    seedDemoExpenses(backend, household.id)
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
