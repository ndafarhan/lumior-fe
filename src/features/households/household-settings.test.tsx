import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, test } from 'vitest'

import { TEST_API_BASE_URL } from '../../../tests/constants'
import { fakeBackend } from '../../../tests/msw/handlers'
import { server } from '../../../tests/msw/server'
import { TEST_USER, renderApp, seedSession } from '../../../tests/render-app'

const settingsHeading = () => screen.findByRole('heading', { level: 1, name: 'Household settings' })
const membersList = () => screen.findByRole('list', { name: 'Members' })

/** TEST_USER owns "Rumah Bandung"; Budi is a member. */
function seedOwner() {
  const budi = fakeBackend.addUser({ name: 'Budi', email: 'budi@example.com' })
  const { user, households } = seedSession({ households: [] })
  const household = fakeBackend.addHousehold('Rumah Bandung', user.id, [budi.id])
  return { user, budi, household, other: households }
}

/** Budi owns "Kos Jakarta"; TEST_USER is a member there, and optionally owns "Rumah Bandung". */
function seedMember({ ownHousehold = false } = {}) {
  const budi = fakeBackend.addUser({ name: 'Budi', email: 'budi@example.com' })
  const { user } = seedSession({ households: ownHousehold ? ['Rumah Bandung'] : [] })
  const jakarta = fakeBackend.addHousehold('Kos Jakarta', budi.id, [user.id])
  localStorage.setItem(`lumior.activeHousehold.${user.id}`, jakarta.id)
  return { user, budi, jakarta }
}

describe('household settings', () => {
  test('lists members with name, email, and role, and marks the user', async () => {
    seedMember()
    renderApp('/household', { session: null })
    await settingsHeading()

    const items = within(await membersList()).getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringMatching(/^Budi.*budi@example\.com.*owner/),
      expect.stringMatching(new RegExp(`^Rina\\(You\\).*${TEST_USER.email}.*member`)),
    ])
  })

  test('the owner renames the household', async () => {
    seedOwner()
    const user = userEvent.setup()
    renderApp('/household', { session: null })
    await settingsHeading()

    const field = screen.getByLabelText('Household name')
    await user.clear(field)
    await user.type(field, 'Rumah Kita')
    await user.click(screen.getByRole('button', { name: 'Save name' }))

    expect(await screen.findByText('Name saved.')).toBeInTheDocument()
    expect(fakeBackend.state.households[0]!.name).toBe('Rumah Kita')
  })

  test('the owner removes a member after confirming', async () => {
    seedOwner()
    const user = userEvent.setup()
    renderApp('/household', { session: null })
    await settingsHeading()
    await within(await membersList()).findByText('Budi')

    await user.click(screen.getByRole('button', { name: 'Remove Budi' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Remove Budi?' })
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }))

    await expect
      .poll(() => within(screen.getByRole('list', { name: 'Members' })).queryByText('Budi'))
      .toBeNull()
    expect(fakeBackend.state.households[0]!.members).toHaveLength(1)
  })

  test('cancelling the confirmation keeps the member', async () => {
    seedOwner()
    const user = userEvent.setup()
    renderApp('/household', { session: null })
    await within(await membersList()).findByText('Budi')

    await user.click(screen.getByRole('button', { name: 'Remove Budi' }))
    await user.click(await screen.findByRole('button', { name: 'Cancel' }))

    expect(fakeBackend.state.households[0]!.members).toHaveLength(2)
  })

  test('members see no rename, remove, or invite actions, and the owner sees no leave action', async () => {
    seedMember()
    renderApp('/household', { session: null })
    await within(await membersList()).findByText('Budi')

    expect(screen.queryByLabelText('Household name')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Remove/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Invite member' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Leave household' })).toBeInTheDocument()
  })

  test('the owner is not offered to leave', async () => {
    seedOwner()
    renderApp('/household', { session: null })
    await within(await membersList()).findByText('Budi')

    expect(screen.queryByRole('button', { name: 'Leave household' })).not.toBeInTheDocument()
  })

  test('a refused owner action shows the permission message and reloads members', async () => {
    const { household } = seedOwner()
    server.use(
      http.patch(`${TEST_API_BASE_URL}/api/v1/households/${household.id}`, () =>
        HttpResponse.json(
          { error: { code: 'owner_required', message: 'x', details: [], request_id: 'r' } },
          { status: 403 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderApp('/household', { session: null })
    await within(await membersList()).findByText('Budi')
    const membersCallsBefore = fakeBackend.calls.filter((call) => call.endsWith('/members')).length

    await user.click(screen.getByRole('button', { name: 'Save name' }))

    expect(await screen.findByText("You don't have permission to do this")).toBeInTheDocument()
    await expect
      .poll(() => fakeBackend.calls.filter((call) => call.endsWith('/members')).length)
      .toBeGreaterThan(membersCallsBefore)
  })
})

describe('leaving a household', () => {
  test('leaving one of two households switches to the other', async () => {
    seedMember({ ownHousehold: true })
    const user = userEvent.setup()
    const { router } = renderApp('/household', { session: null })
    await within(await membersList()).findByText('Budi')

    await user.click(screen.getByRole('button', { name: 'Leave household' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Leave Kos Jakarta?' })
    await user.click(within(dialog).getByRole('button', { name: 'Leave' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument()
    await act(() => router.navigate('/household'))
    expect(await screen.findByLabelText('Household name')).toHaveValue('Rumah Bandung')
    expect(screen.queryByText(/no longer have access/)).not.toBeInTheDocument()
  })

  test('leaving the only household shows onboarding', async () => {
    seedMember()
    const user = userEvent.setup()
    renderApp('/household', { session: null })
    await within(await membersList()).findByText('Budi')

    await user.click(screen.getByRole('button', { name: 'Leave household' }))
    await user.click(await screen.findByRole('button', { name: 'Leave' }))

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Create your household' }),
    ).toBeInTheDocument()
  })
})
