import { useQuery } from '@tanstack/react-query'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { RouteObject } from 'react-router'
import { describe, expect, test } from 'vitest'

import { fakeBackend } from '../../../tests/msw/handlers'
import { renderApp, seedSession } from '../../../tests/render-app'

import { RequireHousehold, RequireSession, RootRoute } from '@/app/guards'
import { WelcomePage } from '@/routes/welcome'
import { useApi } from '@/lib/api/context'

import { householdKey } from './api'
import { useActiveHousehold } from './context'
import { HouseholdNotice } from './HouseholdNotice'

/** Loads the active household's members on demand. */
function MembersProbe() {
  const { client } = useApi()
  const active = useActiveHousehold()
  const members = useQuery({
    queryKey: [...householdKey(active.id), 'members'],
    queryFn: async () =>
      (
        await client.GET('/api/v1/households/{household_id}/members', {
          params: { path: { household_id: active.id } },
        })
      ).data!,
    enabled: false,
  })
  return (
    <>
      <HouseholdNotice />
      <h1>Working in {active.name}</h1>
      <button type="button" onClick={() => void members.refetch()}>
        Load members
      </button>
    </>
  )
}

/** The real guards and onboarding page around the probe. */
function probeRoutes(): RouteObject[] {
  return [
    {
      element: <RootRoute />,
      children: [
        {
          element: <RequireSession />,
          children: [
            { path: 'welcome', element: <WelcomePage /> },
            {
              element: <RequireHousehold />,
              children: [{ path: 'probe', element: <MembersProbe /> }],
            },
          ],
        },
      ],
    },
  ]
}

/** Signs in a user who owns "Rumah Bandung" (optional) and is a member of "Kos Jakarta". */
function seedMember({ ownHousehold }: { ownHousehold: boolean }) {
  const owner = fakeBackend.addUser({ name: 'Budi', email: 'budi@example.com' })
  const { user, households } = seedSession({ households: ownHousehold ? ['Rumah Bandung'] : [] })
  const jakarta = fakeBackend.addHousehold('Kos Jakarta', owner.id, [user.id])
  localStorage.setItem(`lumior.activeHousehold.${user.id}`, jakarta.id)
  return { user, jakarta, own: households[0] }
}

describe('losing access to the active household', () => {
  test('switches to another household and tells the user', async () => {
    const { user, jakarta } = seedMember({ ownHousehold: true })
    const userEvents = userEvent.setup()
    renderApp('/probe', { session: null, routes: probeRoutes() })
    expect(
      await screen.findByRole('heading', { name: 'Working in Kos Jakarta' }),
    ).toBeInTheDocument()

    fakeBackend.removeMember(jakarta.id, user.id)
    await userEvents.click(screen.getByRole('button', { name: 'Load members' }))

    expect(await screen.findByText('You no longer have access to Kos Jakarta.')).toBeInTheDocument()
    expect(
      await screen.findByRole('heading', { name: 'Working in Rumah Bandung' }),
    ).toBeInTheDocument()
  })

  test('shows onboarding when no household is left', async () => {
    const { user, jakarta } = seedMember({ ownHousehold: false })
    const userEvents = userEvent.setup()
    const { router } = renderApp('/probe', { session: null, routes: probeRoutes() })
    await screen.findByRole('heading', { name: 'Working in Kos Jakarta' })

    fakeBackend.removeMember(jakarta.id, user.id)
    await userEvents.click(screen.getByRole('button', { name: 'Load members' }))

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Create your household' }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/welcome')
    expect(screen.getByText('You no longer have access to Kos Jakarta.')).toBeInTheDocument()
  })
})
