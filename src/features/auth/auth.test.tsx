import { useMutation } from '@tanstack/react-query'
import { screen, waitFor } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import type { RouteObject } from 'react-router'
import { describe, expect, test } from 'vitest'

import { TEST_API_BASE_URL } from '../../../tests/constants'
import { fakeBackend } from '../../../tests/msw/handlers'
import { server } from '../../../tests/msw/server'
import { TEST_USER, renderApp, seedSession } from '../../../tests/render-app'

import { PublicOnlyRoute, RequireSession, RootRoute } from '@/app/guards'
import { useApi } from '@/lib/api/context'

import { LoginPage } from './LoginPage'

const REFRESH_URL = `${TEST_API_BASE_URL}/api/v1/auth/refresh`

async function signIn(user: UserEvent, email = TEST_USER.email, password = TEST_USER.password) {
  await user.type(await screen.findByLabelText('Email'), email)
  await user.type(screen.getByLabelText('Password'), password)
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
}

const signInHeading = () => screen.findByRole('heading', { level: 1, name: 'Sign in' })

describe('session restore on load', () => {
  test('a valid refresh cookie restores the session without the sign-in page', async () => {
    renderApp('/expenses')

    expect(await screen.findByRole('heading', { level: 1, name: 'Expenses' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Sign in' })).not.toBeInTheDocument()
  })

  test('shows a loading state until the session is known', () => {
    renderApp('/expenses')

    expect(screen.getByRole('status')).toHaveTextContent('Loading Lumior')
  })

  test('a rejected refresh means signed out', async () => {
    const { router } = renderApp('/expenses', { session: null })

    expect(await signInHeading()).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
  })

  test('an unreachable backend shows a retry screen instead of the sign-in page', async () => {
    let down = true
    server.use(http.post(REFRESH_URL, () => (down ? HttpResponse.error() : undefined)))
    const user = userEvent.setup()
    renderApp('/expenses')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Cannot reach the server' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Sign in' })).not.toBeInTheDocument()

    down = false
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Expenses' })).toBeInTheDocument()
  })
})

describe('route protection', () => {
  test('a signed-out visitor is returned to the requested page after signing in', async () => {
    seedSession({ signedIn: false })
    const user = userEvent.setup()
    const { router } = renderApp('/budgets?month=2026-10', { session: null })

    await signInHeading()
    await signIn(user)

    expect(await screen.findByRole('heading', { level: 1, name: 'Budgets' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/budgets')
    expect(router.state.location.search).toBe('?month=2026-10')
  })

  test('an unknown URL also requires signing in', async () => {
    renderApp('/does-not-exist', { session: null })

    expect(await signInHeading()).toBeInTheDocument()
  })

  test.each(['https://evil.example', '//evil.example', '/\\evil.example'])(
    'a return target of %s falls back to the dashboard',
    async (next) => {
      seedSession({ signedIn: false })
      const user = userEvent.setup()
      const { router } = renderApp(`/login?next=${encodeURIComponent(next)}`, { session: null })

      await signIn(user)

      expect(
        await screen.findByRole('heading', { level: 1, name: 'Dashboard' }),
      ).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/')
    },
  )

  test.each(['/login', '/register'])(
    'a signed-in user opening %s goes to the dashboard',
    async (path) => {
      const { router } = renderApp(path)

      expect(
        await screen.findByRole('heading', { level: 1, name: 'Dashboard' }),
      ).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/')
    },
  )
})

describe('sign-in page', () => {
  test('signs in and shows the dashboard', async () => {
    seedSession({ signedIn: false })
    const user = userEvent.setup()
    renderApp('/login', { session: null })

    await signIn(user)

    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument()
  })

  test('wrong credentials show a message, keep the email, and clear the password', async () => {
    seedSession({ signedIn: false })
    const user = userEvent.setup()
    renderApp('/login', { session: null })

    await signIn(user, TEST_USER.email, 'wrong-password')

    expect(await screen.findByText('Incorrect email or password')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveValue(TEST_USER.email)
    expect(screen.getByLabelText('Password')).toHaveValue('')
  })

  test('empty fields are reported without sending a request', async () => {
    const user = userEvent.setup()
    renderApp('/login', { session: null })

    await user.click(await screen.findByRole('button', { name: 'Sign in' }))

    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Enter your email.')
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('Enter your password.')
    expect(fakeBackend.calls).not.toContain('POST /api/v1/auth/login')
  })

  test('links to registration, keeping the return target', async () => {
    renderApp('/login?next=%2Fbudgets', { session: null })

    expect(await screen.findByRole('link', { name: 'Create an account' })).toHaveAttribute(
      'href',
      '/register?next=%2Fbudgets',
    )
  })
})

/** Signed-in page that calls an authenticated endpoint on demand. */
function Probe() {
  const { client } = useApi()
  const load = useMutation({ mutationFn: () => client.GET('/api/v1/me') })
  return (
    <>
      <h1>Probe</h1>
      <button type="button" onClick={() => load.mutate()}>
        Load
      </button>
    </>
  )
}

const probeRoutes: RouteObject[] = [
  {
    element: <RootRoute />,
    children: [
      { element: <PublicOnlyRoute />, children: [{ path: 'login', element: <LoginPage /> }] },
      {
        element: <RequireSession />,
        children: [
          { index: true, element: <h1>Home</h1> },
          { path: 'probe', element: <Probe /> },
        ],
      },
    ],
  },
]

describe('expired session', () => {
  test('shows the session-expired message and returns to the page after signing in', async () => {
    seedSession()
    const user = userEvent.setup()
    const { router } = renderApp('/probe', { routes: probeRoutes, session: null })
    await screen.findByRole('heading', { name: 'Probe' })

    fakeBackend.expireAccessTokens()
    fakeBackend.revokeRefreshTokens()
    await user.click(screen.getByRole('button', { name: 'Load' }))

    expect(
      await screen.findByText('Your session has expired. Please sign in again.'),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')

    await signIn(user)

    expect(await screen.findByRole('heading', { name: 'Probe' })).toBeInTheDocument()
    await waitFor(() => expect(router.state.location.pathname).toBe('/probe'))
  })
})
