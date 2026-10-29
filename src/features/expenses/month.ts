/**
 * Months (`YYYY-MM`) and dates (`YYYY-MM-DD`) as plain strings. "Today" comes from the local
 * calendar, never from `toISOString()`, which would shift the date across UTC midnight. Labels
 * are formatted in UTC from the parts, so they never shift either.
 */

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/

const pad = (value: number) => String(value).padStart(2, '0')

/** The month if `text` is a valid `YYYY-MM`, else `null`. */
export function parseMonth(text: string | null | undefined): string | null {
  return text && MONTH.test(text) ? text : null
}

/** The month `delta` months after `month` (negative for earlier). */
export function addMonths(month: string, delta: number): string {
  const [year, monthNumber] = month.split('-').map(Number) as [number, number]
  const index = year * 12 + (monthNumber - 1) + delta
  return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`
}

/** Today's local calendar date as `YYYY-MM-DD`. */
export function today(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** The current local month as `YYYY-MM`. */
export function currentMonth(now = new Date()): string {
  return monthOf(today(now))
}

/** The month a `YYYY-MM-DD` date falls in. */
export function monthOf(date: string): string {
  return date.slice(0, 7)
}

const monthLabel = new Intl.DateTimeFormat('en', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})
const dateLabel = new Intl.DateTimeFormat('en', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

/** `"2026-10"` → `"October 2026"`. */
export function formatMonth(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number) as [number, number]
  return monthLabel.format(Date.UTC(year, monthNumber - 1, 1))
}

/** `"2026-10-03"` → `"Sat, Oct 3, 2026"`. */
export function formatDate(date: string): string {
  const [year, monthNumber, day] = date.split('-').map(Number) as [number, number, number]
  return dateLabel.format(Date.UTC(year, monthNumber - 1, day))
}
