import { describe, expect, test } from 'vitest'

import { parseConfig } from './config'

describe('parseConfig', () => {
  test('accepts an absolute http URL and removes the trailing slash', () => {
    expect(parseConfig({ VITE_API_BASE_URL: 'http://localhost:8000/' })).toEqual({
      ok: true,
      config: { apiBaseUrl: 'http://localhost:8000' },
    })
  })

  test('accepts an https URL with a path', () => {
    expect(parseConfig({ VITE_API_BASE_URL: 'https://api.example.com/lumior' })).toEqual({
      ok: true,
      config: { apiBaseUrl: 'https://api.example.com/lumior' },
    })
  })

  test('reports a missing value', () => {
    expect(parseConfig({})).toEqual({
      ok: false,
      issues: [{ setting: 'VITE_API_BASE_URL', message: 'is required' }],
    })
  })

  test('reports an empty value as missing', () => {
    expect(parseConfig({ VITE_API_BASE_URL: '' })).toMatchObject({
      ok: false,
      issues: [{ setting: 'VITE_API_BASE_URL', message: 'is required' }],
    })
  })

  test.each(['not-a-url', '/api', 'ftp://example.com', 'localhost:8000'])('rejects %s', (value) => {
    expect(parseConfig({ VITE_API_BASE_URL: value })).toEqual({
      ok: false,
      issues: [
        {
          setting: 'VITE_API_BASE_URL',
          message: 'must be an absolute http(s) URL, for example http://localhost:8000',
        },
      ],
    })
  })
})
