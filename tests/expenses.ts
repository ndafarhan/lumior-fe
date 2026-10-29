import { screen, within } from '@testing-library/react'
import { vi } from 'vitest'

import { fakeBackend } from './msw/handlers'
import { seedSession, type SeedSession } from './render-app'

/** Fixes "now" at 15 October 2026, noon local time. Only `Date` is faked, so timers still run. */
export function freezeToday(date = new Date(2026, 9, 15, 12)) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(date)
}

/** Seeds the signed-in user with households and returns the first one. */
export function seedHousehold(session: SeedSession = {}) {
  const seeded = seedSession(session)
  return { ...seeded, household: seeded.households[0]! }
}

/** Adds an expense to the household; `amount` is a plain decimal string. */
export function addExpense(
  householdId: string,
  spentOn: string,
  amount: string,
  category: string,
  note?: string,
) {
  return fakeBackend.addExpense(householdId, { spentOn, amount, category, note })
}

/** Text with the no-break spaces Intl puts in money replaced by plain spaces. */
export const plain = (text: string | null | undefined) => (text ?? '').replace(/\u00a0/g, ' ')

/** The month heading, for example "October 2026". */
export const monthHeading = (label: string) =>
  screen.findByRole('heading', { level: 2, name: label })

/** The listed expenses of the shown month, as their text. */
export async function listedExpenses(monthLabel: string) {
  const list = await screen.findByRole('list', { name: `Expenses in ${monthLabel}` })
  return within(list)
    .getAllByRole('listitem')
    .map((item) => plain(item.textContent))
}

/** The month total as shown. */
export async function monthTotal() {
  return plain((await screen.findByLabelText('Month total')).textContent)
}
