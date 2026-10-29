import { describe, expect, test, vi } from 'vitest'

import {
  addMonths,
  currentMonth,
  formatDate,
  formatMonth,
  monthOf,
  parseMonth,
  today,
} from './month'

describe('parseMonth', () => {
  test('accepts YYYY-MM', () => {
    expect(parseMonth('2026-10')).toBe('2026-10')
  })

  test.each(['2026-13', '2026-00', 'abc', '2026-1', '', null, undefined])('rejects %s', (text) => {
    expect(parseMonth(text)).toBeNull()
  })
})

describe('addMonths', () => {
  test('moves across year boundaries', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01')
    expect(addMonths('2026-01', -1)).toBe('2025-12')
    expect(addMonths('2026-10', -1)).toBe('2026-09')
    expect(addMonths('2026-10', 14)).toBe('2027-12')
  })
})

describe('today', () => {
  test('uses the local calendar date behind UTC', () => {
    vi.stubEnv('TZ', 'America/Los_Angeles')
    // 23:30 on 31 October in Los Angeles is already 1 November in UTC.
    const now = new Date('2026-11-01T06:30:00Z')
    expect(now.getDate()).toBe(31)
    expect(today(now)).toBe('2026-10-31')
    expect(currentMonth(now)).toBe('2026-10')
  })

  test('uses the local calendar date ahead of UTC', () => {
    vi.stubEnv('TZ', 'Asia/Jakarta')
    // 23:30 on 31 October in Jakarta is 16:30 UTC the same day...
    expect(today(new Date('2026-10-31T16:30:00Z'))).toBe('2026-10-31')
    // ...and 00:30 on 1 November in Jakarta is still 31 October in UTC.
    expect(today(new Date('2026-10-31T17:30:00Z'))).toBe('2026-11-01')
  })
})

describe('labels', () => {
  test('month and date labels', () => {
    vi.stubEnv('TZ', 'America/Los_Angeles')
    expect(formatMonth('2026-10')).toBe('October 2026')
    expect(formatDate('2026-10-03')).toBe('Sat, Oct 3, 2026')
    expect(monthOf('2026-10-03')).toBe('2026-10')
  })
})
