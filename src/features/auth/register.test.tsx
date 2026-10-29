import { screen } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, test } from 'vitest'

import { TEST_API_BASE_URL } from '../../../tests/constants'
import { fakeBackend } from '../../../tests/msw/handlers'
import { server } from '../../../tests/msw/server'
import { TEST_USER, renderApp } from '../../../tests/render-app'

async function fillIn(
  user: UserEvent,
  values: { name?: string; email?: string; password?: string },
) {
  if (values.name) await user.type(await screen.findByLabelText('Name'), values.name)
  if (values.email) await user.type(screen.getByLabelText('Email'), values.email)
  if (values.password) await user.type(screen.getByLabelText('Password'), values.password)
  await user.click(screen.getByRole('button', { name: 'Create account' }))
}

describe('registration', () => {
  test('creates the account, signs in, and shows household onboarding', async () => {
    const user = userEvent.setup()
    renderApp('/register', { session: null })

    await fillIn(user, { name: 'Rina', email: 'new@example.com', password: 'password123' })

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Create your household' }),
    ).toBeInTheDocument()
    expect(fakeBackend.state.users.map((u) => u.email)).toEqual(['new@example.com'])
  })

  test('an email that is already registered links to sign in', async () => {
    fakeBackend.addUser(TEST_USER)
    const user = userEvent.setup()
    renderApp('/register?next=%2Fbudgets', { session: null })

    await fillIn(user, { name: 'Rina', email: TEST_USER.email, password: 'password123' })

    expect(await screen.findByText('An account with this email already exists')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription(
      'An account with this email already exists',
    )
    expect(screen.getByRole('link', { name: 'Sign in instead' })).toHaveAttribute(
      'href',
      '/login?next=%2Fbudgets',
    )
  })

  test('a short password is reported without sending a request', async () => {
    const user = userEvent.setup()
    renderApp('/register', { session: null })

    await fillIn(user, { name: 'Rina', email: 'new@example.com', password: 'abc123' })

    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription(
      expect.stringContaining('Use at least 8 characters.'),
    )
    expect(fakeBackend.calls).not.toContain('POST /api/v1/auth/register')
  })

  test('a blank name is reported without sending a request', async () => {
    const user = userEvent.setup()
    renderApp('/register', { session: null })

    await fillIn(user, { name: '   ', email: 'new@example.com', password: 'password123' })

    expect(screen.getByLabelText('Name')).toHaveAccessibleDescription('Enter a name.')
    expect(fakeBackend.calls).not.toContain('POST /api/v1/auth/register')
  })

  test('backend validation errors appear next to their fields', async () => {
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/v1/auth/register`, () =>
        HttpResponse.json(
          {
            error: {
              code: 'validation_error',
              message: 'Invalid',
              details: [
                { location: ['body', 'email'], reason: 'Email domain is not allowed.', type: 'x' },
                { location: ['body', 'captcha'], reason: 'Please retry.', type: 'x' },
              ],
              request_id: 'r-1',
            },
          },
          { status: 422 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderApp('/register', { session: null })

    await fillIn(user, { name: 'Rina', email: 'new@blocked.example', password: 'password123' })

    expect(await screen.findByText('Email domain is not allowed.')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription(
      'Email domain is not allowed.',
    )
    expect(screen.getByText('Please retry.')).toBeInTheDocument()
  })
})
