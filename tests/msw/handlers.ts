import { HttpResponse, http } from 'msw'

import { TEST_API_BASE_URL } from '../constants'

import { FakeBackend } from './fake-backend'

/** The auth and households backend every test talks to. Reset after each test. */
export const fakeBackend = new FakeBackend()

/** Handlers every test gets: a healthy backend. Override with `server.use(...)`. */
export const defaultHandlers = [
  http.get(`${TEST_API_BASE_URL}/health/ready`, () =>
    HttpResponse.json({ status: 'ok', checks: { database: 'ok' } }),
  ),
  ...fakeBackend.handlers(TEST_API_BASE_URL),
]
