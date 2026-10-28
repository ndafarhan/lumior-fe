import { describe, expect, test } from 'vitest'

import { formatMoney, toMoneyPayload } from './format'

// Intl puts a no-break space between a currency code and the number.
const display = (amount: string, currency: string) =>
  formatMoney({ amount, currency }).replace(/\u00a0/g, ' ')

describe('formatMoney', () => {
  test('rupiah with thousands separators and two decimals', () => {
    expect(display('12500.00', 'IDR')).toBe('IDR 12,500.00')
  })

  test('rupiah without decimals in the input still shows the currency precision', () => {
    expect(display('12500', 'IDR')).toBe('IDR 12,500.00')
  })

  test('zero-decimal currency', () => {
    expect(display('1500', 'JPY')).toBe('¥1,500')
  })

  test('negative amount', () => {
    expect(display('-250.50', 'USD')).toBe('-$250.50')
  })

  test('keeps every digit of an amount beyond floating-point precision', () => {
    expect(display('123456789012.35', 'IDR')).toBe('IDR 123,456,789,012.35')
    expect(display('9007199254740993.01', 'USD')).toBe('$9,007,199,254,740,993.01')
  })

  test('shows extra decimals instead of rounding them away', () => {
    expect(display('10.555', 'USD')).toBe('$10.555')
  })

  test('formats a currency outside the Lumior table with the browser default precision', () => {
    expect(display('1234.5', 'CHF')).toBe('CHF 1,234.50')
  })

  test.each([
    ['abc', 'IDR'],
    ['', 'IDR'],
    ['1e3', 'USD'],
    ['12,500', 'IDR'],
    ['NaN', 'USD'],
    ['100', 'usd'],
    ['100', 'ZZZ'],
    ['100', ''],
  ])('shows a placeholder for amount %j in currency %j', (amount, currency) => {
    expect(formatMoney({ amount, currency })).toBe('—')
  })

  test('shows a placeholder for an amount that is not a string', () => {
    expect(formatMoney({ amount: 12500 as unknown as string, currency: 'IDR' })).toBe('—')
  })
})

describe('toMoneyPayload', () => {
  test('keeps the amount as a string', () => {
    const payload = toMoneyPayload('12500', 'IDR')
    expect(payload).toEqual({ amount: '12500', currency: 'IDR' })
    expect(JSON.stringify(payload)).toBe('{"amount":"12500","currency":"IDR"}')
  })
})
