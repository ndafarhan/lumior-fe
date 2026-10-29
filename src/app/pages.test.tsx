import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { RouteObject } from 'react-router'
import { describe, expect, test, vi } from 'vitest'

import { renderApp } from '../../tests/render-app'

import { RequireHousehold, RequireSession } from './guards'
import { AppLayout } from './layout/AppLayout'
import { RouteErrorPage } from './RouteErrorPage'
import { ApiError } from '@/lib/api/errors'
import { DashboardPage } from '@/routes/dashboard'

describe('placeholder pages', () => {
  test('an area that is not built yet shows its title and a coming-soon message', async () => {
    renderApp('/optimize')

    expect(await screen.findByRole('heading', { level: 1, name: 'Optimize' })).toBeInTheDocument()
    expect(screen.getByText('Coming soon')).toBeInTheDocument()
  })
})

describe('not found', () => {
  test('an unknown URL shows the not-found page inside the layout with a link home', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/does-not-exist')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Go to the dashboard' }))

    expect(router.state.location.pathname).toBe('/')
    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument()
  })
})

/** The real guards, layout, and error boundary around a page that throws. */
function routesWithPage(Page: () => React.ReactNode): RouteObject[] {
  return [
    {
      element: <RequireSession />,
      children: [
        {
          element: <RequireHousehold />,
          children: [
            {
              element: <AppLayout />,
              children: [
                {
                  errorElement: <RouteErrorPage />,
                  children: [
                    { index: true, element: <DashboardPage />, handle: { title: 'Dashboard' } },
                    { path: 'broken', element: <Page />, handle: { title: 'Broken' } },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ]
}

describe('error boundary', () => {
  test('a page that throws shows the error page while the sidebar keeps working', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const user = userEvent.setup()
    function Broken(): React.ReactNode {
      throw new TypeError('boom')
    }
    renderApp('/broken', { routes: routesWithPage(Broken) })

    const alert = await screen.findByRole('alert')
    expect(within(alert).getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument()
    expect(within(alert).getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(screen.queryByText(/boom/)).not.toBeInTheDocument()

    await user.click(
      within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', {
        name: 'Dashboard',
      }),
    )

    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument()
  })

  test('an API error shows its request ID as a reference', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    function Broken(): React.ReactNode {
      throw new ApiError({ kind: 'http', status: 500, message: 'x', requestId: 'r-42' })
    }
    renderApp('/broken', { routes: routesWithPage(Broken) })

    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText('r-42')).toBeInTheDocument()
    expect(alert).toHaveTextContent('The server ran into a problem. Please try again later.')
  })

  test('"Try again" renders the page again', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const user = userEvent.setup()
    let fail = true
    function Flaky() {
      if (fail) throw new TypeError('boom')
      return <h1>Recovered</h1>
    }
    renderApp('/broken', { routes: routesWithPage(Flaky) })
    await screen.findByRole('alert')

    fail = false
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('heading', { name: 'Recovered' })).toBeInTheDocument()
  })
})

describe('document title', () => {
  test('is "<area> · Lumior"', async () => {
    renderApp('/catalog')

    await waitFor(() => expect(document.title).toBe('Catalog · Lumior'))
  })

  test('follows navigation', async () => {
    const user = userEvent.setup()
    renderApp('/')
    await screen.findByRole('heading', { level: 1, name: 'Dashboard' })
    await waitFor(() => expect(document.title).toBe('Dashboard · Lumior'))

    await user.click(
      within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', {
        name: 'Expenses',
      }),
    )

    await waitFor(() => expect(document.title).toBe('Expenses · Lumior'))
  })

  test.each([
    ['/account', 'Account · Lumior'],
    ['/household', 'Household settings · Lumior'],
  ])('%s is titled "%s"', async (path, title) => {
    renderApp(path)

    await waitFor(() => expect(document.title).toBe(title))
  })

  test.each([
    ['/login', 'Sign in · Lumior'],
    ['/register', 'Create account · Lumior'],
  ])('%s is titled "%s" for a signed-out visitor', async (path, title) => {
    renderApp(path, { session: null })

    await waitFor(() => expect(document.title).toBe(title))
  })

  test('names the not-found page', async () => {
    renderApp('/nope')

    await waitFor(() => expect(document.title).toBe('Page not found · Lumior'))
  })
})
