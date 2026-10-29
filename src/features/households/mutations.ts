import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useApi } from '@/lib/api/context'
import { useCurrentUser } from '@/lib/auth/use-session'

import { HOUSEHOLDS_KEY, householdKey, type Household } from './api'
import { useHouseholds } from './context'

/** Creates a household owned by the user and makes it active. */
export function useCreateHousehold() {
  const { client } = useApi()
  const queryClient = useQueryClient()
  const { setActive } = useHouseholds()
  return useMutation({
    mutationFn: async (body: { name: string; currency: string }) =>
      (await client.POST('/api/v1/households', { body })).data!,
    onSuccess: (created) => {
      // Add it right away so the app never sees the user without their new household.
      queryClient.setQueryData<Household[]>(HOUSEHOLDS_KEY, (list = []) => [...list, created])
      setActive(created.id)
      void queryClient.invalidateQueries({ queryKey: HOUSEHOLDS_KEY })
    },
  })
}

/** Renames a household (owner only) and updates it in the list. */
export function useRenameHousehold(householdId: string) {
  const { client } = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) =>
      (
        await client.PATCH('/api/v1/households/{household_id}', {
          params: { path: { household_id: householdId } },
          body: { name },
        })
      ).data!,
    onSuccess: (updated) => {
      queryClient.setQueryData<Household[]>(HOUSEHOLDS_KEY, (list = []) =>
        list.map((household) => (household.id === updated.id ? updated : household)),
      )
    },
  })
}

/** Removes a member (owner), or the user themselves (leaving). */
export function useRemoveMember(householdId: string) {
  const { client } = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (userId: string) => {
      await client.DELETE('/api/v1/households/{household_id}/members/{user_id}', {
        params: { path: { household_id: householdId, user_id: userId } },
      })
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [...householdKey(householdId), 'members'] }),
        queryClient.invalidateQueries({ queryKey: HOUSEHOLDS_KEY }),
      ]),
  })
}

/** Creates a single-use invite for a household (owner only). */
export function useCreateInvite(householdId: string) {
  const { client } = useApi()
  return useMutation({
    mutationFn: async () =>
      (
        await client.POST('/api/v1/households/{household_id}/invites', {
          params: { path: { household_id: householdId } },
        })
      ).data!,
  })
}

/**
 * Leaves a household. Its cached data is dropped first, so nothing refetches it and reports a
 * lost access the user chose.
 */
export function useLeaveHousehold(householdId: string) {
  const { client } = useApi()
  const queryClient = useQueryClient()
  const user = useCurrentUser()
  return useMutation({
    mutationFn: async () => {
      await client.DELETE('/api/v1/households/{household_id}/members/{user_id}', {
        params: { path: { household_id: householdId, user_id: user.id } },
      })
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: householdKey(householdId) })
      queryClient.setQueryData<Household[]>(HOUSEHOLDS_KEY, (list = []) =>
        list.filter((household) => household.id !== householdId),
      )
      void queryClient.invalidateQueries({ queryKey: HOUSEHOLDS_KEY })
    },
  })
}

/** Joins the household of an invite and makes it active. */
export function useAcceptInvite(code: string) {
  const { client } = useApi()
  const queryClient = useQueryClient()
  const { setActive } = useHouseholds()
  return useMutation({
    mutationFn: async () =>
      (await client.POST('/api/v1/invites/{code}/accept', { params: { path: { code } } })).data!,
    onSuccess: (joined) => {
      queryClient.setQueryData<Household[]>(HOUSEHOLDS_KEY, (list = []) => [
        ...list.filter((household) => household.id !== joined.id),
        joined,
      ])
      setActive(joined.id)
      void queryClient.invalidateQueries({ queryKey: HOUSEHOLDS_KEY })
    },
  })
}
