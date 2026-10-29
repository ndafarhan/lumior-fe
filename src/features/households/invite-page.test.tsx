import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'

import { fakeBackend } from '../../../tests/msw/handlers'
import { renderApp, seedSession } from '../../../tests/render-app'

/** Budi owns "Kos Jakarta" and created an invite to it. */
function seedInvite(expiresAt?: number) {
  const budi = fakeBackend.addUser({ name: 'Budi', email: 'budi@example.com' })
  const jakarta = fakeBackend.addHousehold('Kos Jakarta', budi.id)
  const invite = fakeBackend.addInvite(jakarta.id, budi.id, expiresAt)
  return { budi, jakarta, invite }
}

describe('invite page', () => {
  test('a signed-out visitor registers and comes back to the invite', async () => {
    const { invite } = seedInvite()
    const user = userEvent.setup()
    const { router } = renderApp(`/invite/${invite.code}`, { session: null })

    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Create an account' }))
    await user.type(await screen.findByLabelText('Name'), 'Sari')
    await user.type(screen.getByLabelText('Email'), 'sari@example.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Join Kos Jakarta' }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(`/invite/${invite.code}`)
    expect(screen.getByText(/Budi invited you/)).toBeInTheDocument()
  })

  test('joining makes the household active and shows the dashboard', async () => {
    const { invite, jakarta } = seedInvite()
    const user = userEvent.setup()
    const { seeded } = renderApp(`/invite/${invite.code}`)

    await user.click(await screen.findByRole('button', { name: 'Join' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument()
    expect(jakarta.members.map((m) => [m.userId, m.role])).toContainEqual([
      seeded!.user.id,
      'member',
    ])
    expect(localStorage.getItem(`lumior.activeHousehold.${seeded!.user.id}`)).toBe(jakarta.id)
  })

  test('a user without households can join from the invite', async () => {
    const { invite } = seedInvite()
    const user = userEvent.setup()
    renderApp(`/invite/${invite.code}`, { session: { households: [] } })

    await user.click(await screen.findByRole('button', { name: 'Join' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument()
  })

  test('cancel goes back without joining', async () => {
    const { invite, jakarta } = seedInvite()
    const user = userEvent.setup()
    renderApp(`/invite/${invite.code}`)

    await user.click(await screen.findByRole('button', { name: 'Cancel' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument()
    expect(jakarta.members).toHaveLength(1)
  })

  test('an existing member is offered to switch to the household', async () => {
    const { invite, jakarta } = seedInvite()
    const { user } = seedSession()
    jakarta.members.push({ userId: user.id, role: 'member', joinedAt: 999 })
    const events = userEvent.setup()
    renderApp(`/invite/${invite.code}`, { session: null })

    expect(
      await screen.findByRole('heading', { name: "You're already a member of Kos Jakarta" }),
    ).toBeInTheDocument()
    await events.click(screen.getByRole('button', { name: 'Switch to Kos Jakarta' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument()
    expect(localStorage.getItem(`lumior.activeHousehold.${user.id}`)).toBe(jakarta.id)
  })

  test('an expired invite asks for a new link', async () => {
    const { invite } = seedInvite(Date.now() - 1000)
    renderApp(`/invite/${invite.code}`)

    expect(
      await screen.findByRole('heading', { name: 'This invite has expired' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Ask the household owner to send you a new link.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Join' })).not.toBeInTheDocument()
  })

  test('a used invite explains that links work once', async () => {
    const { invite } = seedInvite()
    invite.usedBy = 'u-someone-else'
    renderApp(`/invite/${invite.code}`)

    expect(
      await screen.findByRole('heading', { name: 'This invite has already been used' }),
    ).toBeInTheDocument()
  })

  test('an unknown invite says the link is not valid', async () => {
    renderApp('/invite/nope')

    expect(
      await screen.findByRole('heading', { name: 'This invite link is not valid' }),
    ).toBeInTheDocument()
  })
})
