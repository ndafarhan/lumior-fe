import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'

import { fakeBackend } from './msw/handlers'
import { server } from './msw/server'

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => {
  server.resetHandlers()
  fakeBackend.reset()
  localStorage.clear()
  cleanup()
})
afterAll(() => server.close())
