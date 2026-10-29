import { useQuery } from '@tanstack/react-query'

import { useApi } from '@/lib/api/context'
import type { components } from '@/lib/api/schema'

export type Household = components['schemas']['Household']
export type Member = components['schemas']['Member']
export type Invite = components['schemas']['Invite']
export type InvitePreview = components['schemas']['InvitePreview']

/** The user's households, not tied to any one household. */
export const HOUSEHOLDS_KEY = ['households'] as const

/**
 * Prefix for data that belongs to one household. Every household-scoped query key starts with
 * it, so switching households can drop the previous household's data in one call.
 */
export const householdKey = (householdId: string) => ['household', householdId] as const

export function useHouseholdsQuery() {
  const { client } = useApi()
  return useQuery({
    queryKey: HOUSEHOLDS_KEY,
    queryFn: async ({ signal }) => (await client.GET('/api/v1/households', { signal })).data!,
  })
}

export function useMembersQuery(householdId: string) {
  const { client } = useApi()
  return useQuery({
    queryKey: [...householdKey(householdId), 'members'],
    queryFn: async ({ signal }) =>
      (
        await client.GET('/api/v1/households/{household_id}/members', {
          params: { path: { household_id: householdId } },
          signal,
        })
      ).data!,
  })
}

export function useInvitePreviewQuery(code: string) {
  const { client } = useApi()
  return useQuery({
    queryKey: ['invite', code],
    queryFn: async ({ signal }) =>
      (await client.GET('/api/v1/invites/{code}', { params: { path: { code } }, signal })).data!,
    retry: false,
  })
}
