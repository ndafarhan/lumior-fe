import { describe, expect, test } from 'vitest'

import { parseAmountInput } from './parse'

const ok = (value: string) => ({ ok: true, value })
const error = (message: string) => ({ ok: false, error: message })

describe('parseAmountInput', () => {
  test.each([
    ['12,500', 'IDR', '12500'],
    ['12500', 'IDR', '12500'],
    ['1,234,567.89', 'IDR', '1234567.89'],
    ['  42.5 ', 'USD', '42.5'],
    ['0.99', 'USD', '0.99'],
    ['007', 'USD', '7'],
    ['1500', 'JPY', '1500'],
    ['123456789012345.67', 'IDR', '123456789012345.67'],
  ])('accepts %j in %s as %j', (text, currency, value) => {
    expect(parseAmountInput(text, currency)).toEqual(ok(value))
  })

  test('rejects too many decimal places', () => {
    expect(parseAmountInput('10.555', 'USD')).toEqual(
      error('At most 2 decimal places are allowed.'),
    )
  })

  test('rejects decimals for a zero-decimal currency', () => {
    expect(parseAmountInput('1500.5', 'JPY')).toEqual(error('Amount must be a whole number.'))
  })

  test.each(['12a', 'abc', '1.2.3', '12.', '.5', '1e3', '$12', '--1', '12 500'])(
    'rejects non-numeric input %j',
    (text) => {
      expect(parseAmountInput(text, 'USD')).toEqual(error('Amount must be a number.'))
    },
  )

  test.each(['1,2,3', '12,50', '1,0000'])('rejects misplaced separators in %j', (text) => {
    expect(parseAmountInput(text, 'USD')).toEqual(
      error('Use commas only between groups of three digits, for example 12,500.'),
    )
  })

  test('rejects empty input', () => {
    expect(parseAmountInput('   ', 'USD')).toEqual(error('Enter an amount.'))
  })

  test('rejects a negative amount by default', () => {
    expect(parseAmountInput('-100', 'IDR')).toEqual(error('Amount must not be negative.'))
  })

  test('accepts a negative amount when allowed', () => {
    expect(parseAmountInput('-1,250.50', 'USD', { allowNegative: true })).toEqual(ok('-1250.50'))
  })

  test('normalizes negative zero to zero', () => {
    expect(parseAmountInput('-0.00', 'USD', { allowNegative: true })).toEqual(ok('0.00'))
  })
})
