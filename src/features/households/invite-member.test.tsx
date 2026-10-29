import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'

import { fakeBackend } from '../../../tests/msw/handlers'
import { renderApp } from '../../../tests/render-app'

describe('inviting a member', () => {
  test('creates a link with its expiry and copies it to the clipboard', async () => {
    const user = userEvent.setup()
    renderApp('/household')

    await user.click(await screen.findByRole('button', { name: 'Invite member' }))

    const field = await screen.findByLabelText('Invite link')
    const code = fakeBackend.state.invites[0]!.code
    const expected = `${window.location.origin}/invite/${code}`
    expect(field).toHaveValue(expected)
    expect(screen.getByText(/^Expires /)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Copy link' }))

    expect(await navigator.clipboard.readText()).toBe(expected)
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument()
  })
})
