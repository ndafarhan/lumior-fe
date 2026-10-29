import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'

import { fakeBackend } from '../../tests/msw/handlers'
import { renderApp } from '../../tests/render-app'

const onboardingHeading = () =>
  screen.findByRole('heading', { level: 1, name: 'Create your household' })

describe('household onboarding', () => {
  test('a user without households is onboarded instead of seeing an area', async () => {
    const { router } = renderApp('/budgets', { session: { households: [] } })

    expect(await onboardingHeading()).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/welcome')
    expect(screen.getByLabelText('Household name')).toBeInTheDocument()
    expect(screen.getByText(/ask its owner for an invite link/i)).toBeInTheDocument()
  })

  test('creating a household makes it active and opens the requested page', async () => {
    const user = userEvent.setup()
    const { router, seeded } = renderApp('/budgets', { session: { households: [] } })
    await onboardingHeading()

    await user.type(screen.getByLabelText('Household name'), 'Rumah Bandung')
    await user.click(screen.getByRole('button', { name: 'Create household' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Budgets' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/budgets')
    const created = fakeBackend.state.households.find((h) => h.name === 'Rumah Bandung')!
    expect(created.members).toEqual([
      expect.objectContaining({ userId: seeded!.user.id, role: 'owner' }),
    ])
    expect(localStorage.getItem(`lumior.activeHousehold.${seeded!.user.id}`)).toBe(created.id)
  })

  test('a blank name is reported without sending a request', async () => {
    const user = userEvent.setup()
    renderApp('/welcome', { session: { households: [] } })
    await onboardingHeading()

    await user.type(screen.getByLabelText('Household name'), '   ')
    await user.click(screen.getByRole('button', { name: 'Create household' }))

    expect(screen.getByLabelText('Household name')).toHaveAccessibleDescription('Enter a name.')
    expect(fakeBackend.calls).not.toContain('POST /api/v1/households')
  })

  test('a user without households can sign out from onboarding', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/welcome', { session: { households: [] } })
    await onboardingHeading()

    await user.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
  })
})
