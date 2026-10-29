import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import { TEST_USER, renderApp } from '../../tests/render-app'

test('signing out in one tab shows the sign-in page in the other', async () => {
  const user = userEvent.setup()
  // Two app instances share the browser's cookie and the session channel, like two tabs.
  const first = renderApp('/')
  const second = renderApp('/budgets', { session: null })
  const firstTab = within(first.container)
  const secondTab = within(second.container)
  await firstTab.findByRole('heading', { level: 1, name: 'Dashboard' })
  await secondTab.findByRole('heading', { level: 1, name: 'Budgets' })

  await user.click(firstTab.getByRole('button', { name: `Account: ${TEST_USER.name}` }))
  await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }))

  expect(await firstTab.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument()
  expect(await secondTab.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument()
})
