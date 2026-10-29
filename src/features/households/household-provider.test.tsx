import { useQuery } from '@tanstack/react-query'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { RouteObject } from 'react-router'
import { describe, expect, test } from 'vitest'

import { fakeBackend } from '../../../tests/msw/handlers'
import { renderApp, seedSession } from '../../../tests/render-app'

import { RequireHousehold, RequireSession, RootRoute } from '@/app/guards'

import { householdKey } from './api'
import { useActiveHousehold, useHouseholds } from './context'

/** Shows the active household, offers to switch, and caches household-scoped data. */
function Probe() {
  const { households, setActive } = useHouseholds()
  const active = useActiveHousehold()
  useQuery({ queryKey: [...householdKey(active.id), 'probe'], queryFn: () => active.name })
  return (
    <>
      <h1>Active: {active.name}</h1>
      {households.map((household) => (
        <button key={household.id} type="button" onClick={() => setActive(household.id)}>
          Switch to {household.name}
        </button>
      ))}
    </>
  )
}

const routes: RouteObject[] = [
  {
    element: <RootRoute />,
    children: [
      {
        element: <RequireSession />,
        children: [
          { element: <RequireHousehold />, children: [{ index: true, element: <Probe /> }] },
        ],
      },
    ],
  },
]

const activeHeading = (name: string) => screen.findByRole('heading', { name: `Active: ${name}` })

describe('active household', () => {
  test('defaults to the first household', async () => {
    renderApp('/', { routes, session: { households: ['Rumah Bandung', 'Kos Jakarta'] } })

    expect(await activeHeading('Rumah Bandung')).toBeInTheDocument()
  })

  test('is remembered for the user across loads', async () => {
    const { user, households } = seedSession({ households: ['Rumah Bandung', 'Kos Jakarta'] })
    localStorage.setItem(`lumior.activeHousehold.${user.id}`, households[1]!.id)

    renderApp('/', { routes, session: null })

    expect(await activeHeading('Kos Jakarta')).toBeInTheDocument()
  })

  test('falls back to the first household when the remembered one is gone', async () => {
    const { user } = seedSession({ households: ['Rumah Bandung', 'Kos Jakarta'] })
    localStorage.setItem(`lumior.activeHousehold.${user.id}`, 'h-removed')

    renderApp('/', { routes, session: null })

    expect(await activeHeading('Rumah Bandung')).toBeInTheDocument()
  })

  test("ignores another user's remembered household on the same device", async () => {
    const other = fakeBackend.addUser({ name: 'Budi', email: 'budi@example.com' })
    const { households } = seedSession({ households: ['Rumah Bandung', 'Kos Jakarta'] })
    localStorage.setItem(`lumior.activeHousehold.${other.id}`, households[1]!.id)

    renderApp('/', { routes, session: null })

    expect(await activeHeading('Rumah Bandung')).toBeInTheDocument()
  })

  test("switching remembers the choice and drops the previous household's cached data", async () => {
    const user = userEvent.setup()
    const { queryClient, seeded } = renderApp('/', {
      routes,
      session: { households: ['Rumah Bandung', 'Kos Jakarta'] },
    })
    const [bandung, jakarta] = seeded!.households
    await activeHeading('Rumah Bandung')
    await expect
      .poll(() => queryClient.getQueryData([...householdKey(bandung!.id), 'probe']))
      .toBe('Rumah Bandung')

    await user.click(screen.getByRole('button', { name: 'Switch to Kos Jakarta' }))

    expect(await activeHeading('Kos Jakarta')).toBeInTheDocument()
    expect(queryClient.getQueryData([...householdKey(bandung!.id), 'probe'])).toBeUndefined()
    expect(localStorage.getItem(`lumior.activeHousehold.${seeded!.user.id}`)).toBe(jakarta!.id)
  })

  test('works when localStorage is unavailable', async () => {
    const { getItem, setItem } = Storage.prototype
    Storage.prototype.getItem = () => {
      throw new Error('blocked')
    }
    Storage.prototype.setItem = () => {
      throw new Error('blocked')
    }
    try {
      const user = userEvent.setup()
      renderApp('/', { routes, session: { households: ['Rumah Bandung', 'Kos Jakarta'] } })
      expect(await activeHeading('Rumah Bandung')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Switch to Kos Jakarta' }))
      expect(await activeHeading('Kos Jakarta')).toBeInTheDocument()
    } finally {
      Storage.prototype.getItem = getItem
      Storage.prototype.setItem = setItem
    }
  })
})
