import { describe, expect, test } from 'vitest'

import { ApiError, apiErrorFromResponse } from './errors'

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

describe('apiErrorFromResponse', () => {
  test('maps a 404 envelope', async () => {
    const error = await apiErrorFromResponse(
      jsonResponse(
        404,
        { error: { code: 'not_found', message: 'Not Found', details: [], request_id: 'r-1' } },
        { 'X-Request-ID': 'r-1' },
      ),
    )

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      kind: 'http',
      status: 404,
      code: 'not_found',
      message: 'Not Found',
      details: [],
      requestId: 'r-1',
    })
  })

  test('exposes validation details as field errors', async () => {
    const error = await apiErrorFromResponse(
      jsonResponse(422, {
        error: {
          code: 'validation_error',
          message: 'Request validation failed.',
          details: [
            { location: ['body', 'name'], reason: 'Field required', type: 'missing' },
            { location: ['body', 'items', 0, 'quantity'], reason: 'Too small', type: 'too_small' },
          ],
          request_id: 'r-2',
        },
      }),
    )

    expect(error.status).toBe(422)
    expect(error.code).toBe('validation_error')
    expect(error.fieldErrors).toEqual([
      { field: 'name', reason: 'Field required' },
      { field: 'items.0.quantity', reason: 'Too small' },
    ])
  })

  test('falls back to http_error and the header request ID for a non-envelope body', async () => {
    const error = await apiErrorFromResponse(
      new Response('<html>Bad Gateway</html>', {
        status: 502,
        headers: { 'Content-Type': 'text/html', 'X-Request-ID': 'r-3' },
      }),
    )

    expect(error).toMatchObject({
      kind: 'http',
      status: 502,
      code: 'http_error',
      message: 'Request failed with status 502.',
      details: [],
      requestId: 'r-3',
    })
  })

  test('has no request ID when neither body nor header carries one', async () => {
    const error = await apiErrorFromResponse(new Response('', { status: 500 }))

    expect(error.code).toBe('http_error')
    expect(error.requestId).toBeNull()
  })

  test('fills in missing envelope fields', async () => {
    const error = await apiErrorFromResponse(
      jsonResponse(
        409,
        { error: { code: 'conflict', details: 'oops' } },
        { 'X-Request-ID': 'r-4' },
      ),
    )

    expect(error).toMatchObject({
      status: 409,
      code: 'conflict',
      message: 'Request failed with status 409.',
      details: [],
      requestId: 'r-4',
    })
  })

  test('treats an envelope without a code as a non-envelope body', async () => {
    const error = await apiErrorFromResponse(jsonResponse(400, { error: { message: 'x' } }))

    expect(error.code).toBe('http_error')
  })
})

describe('ApiError', () => {
  test('network and timeout errors have no status', () => {
    expect(ApiError.network({ requestId: 'r-5', method: 'post' })).toMatchObject({
      kind: 'network',
      status: null,
      code: 'network_error',
      requestId: 'r-5',
      method: 'POST',
    })
    expect(ApiError.timeout({ requestId: 'r-6' })).toMatchObject({
      kind: 'timeout',
      status: null,
      code: 'timeout',
      requestId: 'r-6',
    })
  })

  test('ignores details that are not field errors', () => {
    const error = new ApiError({
      kind: 'http',
      status: 409,
      message: 'Conflict',
      details: [{ hint: 'already exists' }, { location: [], reason: 'x' }],
    })

    expect(error.fieldErrors).toEqual([])
  })
})
