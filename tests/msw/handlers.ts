import { HttpResponse, http } from 'msw'

import { TEST_API_BASE_URL } from '../constants'

/** Handlers every test gets: a healthy backend. Override with `server.use(...)`. */
export const defaultHandlers = [
  http.get(`${TEST_API_BASE_URL}/health/ready`, () =>
    HttpResponse.json({ status: 'ok', checks: { database: 'ok' } }),
  ),
]
