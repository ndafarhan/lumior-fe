import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'

import { fakeBackend } from '../../../tests/msw/handlers'
import { TEST_USER, renderApp } from '../../../tests/render-app'

const accountHeading = () => screen.findByRole('heading', { level: 1, name: 'Account settings' })

describe('account settings', () => {
  test('shows the email and the current display name', async () => {
    renderApp('/account')
    await accountHeading()

    expect(screen.getByText(TEST_USER.email)).toBeInTheDocument()
    expect(screen.getByLabelText('Display name')).toHaveValue(TEST_USER.name)
  })

  test('renaming updates the account menu without a reload', async () => {
    const user = userEvent.setup()
    renderApp('/account')
    await accountHeading()

    const field = screen.getByLabelText('Display name')
    await user.clear(field)
    await user.type(field, 'Rina S.')
    await user.click(screen.getByRole('button', { name: 'Save name' }))

    expect(await screen.findByText('Name saved.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Account: Rina S.' })).toBeInTheDocument()
    expect(fakeBackend.state.users[0]!.name).toBe('Rina S.')
  })

  test('a blank display name is reported without sending a request', async () => {
    const user = userEvent.setup()
    renderApp('/account')
    await accountHeading()

    await user.clear(screen.getByLabelText('Display name'))
    await user.click(screen.getByRole('button', { name: 'Save name' }))

    expect(screen.getByLabelText('Display name')).toHaveAccessibleDescription('Enter a name.')
    expect(fakeBackend.calls).not.toContain('PATCH /api/v1/me')
  })

  test('changing the password clears both fields and keeps the user signed in', async () => {
    const user = userEvent.setup()
    renderApp('/account')
    await accountHeading()

    await user.type(screen.getByLabelText('Current password'), TEST_USER.password)
    await user.type(screen.getByLabelText('New password'), 'a-new-password')
    await user.click(screen.getByRole('button', { name: 'Change password' }))

    expect(await screen.findByText('Password changed.')).toBeInTheDocument()
    expect(screen.getByLabelText('Current password')).toHaveValue('')
    expect(screen.getByLabelText('New password')).toHaveValue('')
    expect(fakeBackend.state.users[0]!.password).toBe('a-new-password')
    expect(screen.getByRole('heading', { level: 1, name: 'Account settings' })).toBeInTheDocument()
  })

  test('a wrong current password is shown on its field and the new password is kept', async () => {
    const user = userEvent.setup()
    renderApp('/account')
    await accountHeading()

    await user.type(screen.getByLabelText('Current password'), 'not-my-password')
    await user.type(screen.getByLabelText('New password'), 'a-new-password')
    await user.click(screen.getByRole('button', { name: 'Change password' }))

    expect(await screen.findByText('Current password is incorrect')).toBeInTheDocument()
    expect(screen.getByLabelText('Current password')).toHaveAccessibleDescription(
      'Current password is incorrect',
    )
    expect(screen.getByLabelText('New password')).toHaveValue('a-new-password')
  })

  test('a short new password is reported without sending a request', async () => {
    const user = userEvent.setup()
    renderApp('/account')
    await accountHeading()

    await user.type(screen.getByLabelText('Current password'), TEST_USER.password)
    await user.type(screen.getByLabelText('New password'), 'short')
    await user.click(screen.getByRole('button', { name: 'Change password' }))

    expect(screen.getByLabelText('New password')).toHaveAccessibleDescription(
      expect.stringContaining('Use at least 8 characters.'),
    )
    expect(fakeBackend.calls).not.toContain('POST /api/v1/me/password')
  })
})
