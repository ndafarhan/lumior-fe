import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, test } from 'vitest'

import { TEST_API_BASE_URL } from '../../../tests/constants'
import { fakeBackend } from '../../../tests/msw/handlers'
import { server } from '../../../tests/msw/server'
import { TEST_USER, renderApp } from '../../../tests/render-app'

const switcher = (name: string) =>
  screen.findByRole('button', { name: `Household: ${name}. Switch household` })

describe('household switcher', () => {
  test('switching keeps the current page and shows the new household', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/expenses', {
      session: { households: ['Rumah Bandung', 'Kos Jakarta'] },
    })

    await user.click(await switcher('Rumah Bandung'))
    await user.click(await screen.findByRole('menuitemradio', { name: 'Kos Jakarta' }))

    expect(await switcher('Kos Jakarta')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/expenses')
  })

  test('creating a second household makes it active and lists both', async () => {
    const user = userEvent.setup()
    renderApp('/')

    await user.click(await switcher('Rumah Bandung'))
    await user.click(await screen.findByRole('menuitem', { name: 'Create household' }))
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Create a household' }),
    ).toBeInTheDocument()
    await user.type(screen.getByLabelText('Household name'), 'Kos Jakarta')
    await user.click(screen.getByRole('button', { name: 'Create household' }))

    await user.click(await switcher('Kos Jakarta'))
    const options = await screen.findAllByRole('menuitemradio')
    expect(options.map((option) => option.textContent)).toEqual(['Rumah Bandung', 'Kos Jakarta'])
  })

  test('links to household settings', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/')

    await user.click(await switcher('Rumah Bandung'))
    await user.click(await screen.findByRole('menuitem', { name: 'Household settings' }))

    expect(router.state.location.pathname).toBe('/household')
  })
})

describe('account menu', () => {
  test('shows the name, account settings, and sign out', async () => {
    const user = userEvent.setup()
    renderApp('/')

    await user.click(await screen.findByRole('button', { name: `Account: ${TEST_USER.name}` }))
    const menu = await screen.findByRole('menu')

    expect(within(menu).getByText(TEST_USER.name)).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: 'Account settings' })).toHaveAttribute(
      'href',
      '/account',
    )
    expect(within(menu).getByRole('menuitem', { name: 'Sign out' })).toBeInTheDocument()
  })

  test('signing out ends the session on the backend and shows the sign-in page', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/budgets')

    await user.click(await screen.findByRole('button', { name: `Account: ${TEST_USER.name}` }))
    await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument()
    // An explicit sign-out does not bring the user back to where they were.
    expect(router.state.location.search).toBe('')
    await expect.poll(() => fakeBackend.calls).toContain('POST /api/v1/auth/logout')
    expect(fakeBackend.state.cookieJar).toBeNull()
  })

  test('signing out works while the backend is unreachable', async () => {
    server.use(http.post(`${TEST_API_BASE_URL}/api/v1/auth/logout`, () => HttpResponse.error()))
    const user = userEvent.setup()
    renderApp('/')

    await user.click(await screen.findByRole('button', { name: `Account: ${TEST_USER.name}` }))
    await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument()
  })
})

// jsdom does not apply media queries; this checks what the narrow-width menu sheet contains.
describe('narrow window', () => {
  test('the menu shows the active household, the switcher, and the account menu', async () => {
    const user = userEvent.setup()
    renderApp('/', { session: { households: ['Rumah Bandung', 'Kos Jakarta'] } })

    await user.click(await screen.findByRole('button', { name: 'Open menu' }))
    const sheet = await screen.findByRole('dialog', { name: 'Menu' })

    await user.click(
      within(sheet).getByRole('button', { name: 'Household: Rumah Bandung. Switch household' }),
    )
    expect(await screen.findAllByRole('menuitemradio')).toHaveLength(2)
    await user.keyboard('{Escape}')
    expect(
      within(sheet).getByRole('button', { name: `Account: ${TEST_USER.name}` }),
    ).toBeInTheDocument()
  })
})
