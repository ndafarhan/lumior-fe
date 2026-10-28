import { setupServer } from 'msw/node'

import { defaultHandlers } from './handlers'

// Tests add the handlers they need with `server.use(...)`; these defaults stay registered.
export const server = setupServer(...defaultHandlers)
