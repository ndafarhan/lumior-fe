import { describe, expect, test } from 'vitest'

import { ApiError } from './errors'
import { userMessageFor } from './messages'

describe('userMessageFor', () => {
  test('network error', () => {
    expect(userMessageFor(ApiError.network({ requestId: null }))).toBe(
      'Cannot reach the server. Check your connection and try again.',
    )
  })

  test('timeout', () => {
    expect(userMessageFor(ApiError.timeout({ requestId: null }))).toBe(
      'The server is taking too long to respond. Please try again.',
    )
  })

  test('server error hides the backend message', () => {
    const error = new ApiError({ kind: 'http', status: 500, message: 'Internal Server Error' })
    expect(userMessageFor(error)).toBe('The server ran into a problem. Please try again later.')
  })

  test('client error shows the backend message', () => {
    const error = new ApiError({ kind: 'http', status: 404, message: 'Budget not found.' })
    expect(userMessageFor(error)).toBe('Budget not found.')
  })

  test('non-API error', () => {
    expect(userMessageFor(new TypeError('x is undefined'))).toBe(
      'Something went wrong. Please try again.',
    )
  })
})
