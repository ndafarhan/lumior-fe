import { useQuery } from '@tanstack/react-query'

import { useApi } from '@/lib/api/context'
import { householdKey } from '@/lib/api/query-keys'
import type { components } from '@/lib/api/schema'

export type Household = components['schemas']['Household']
export type Member = components['schemas']['Member']
export type Invite = components['schemas']['Invite']
export type InvitePreview = components['schemas']['InvitePreview']

/** The user's households, not tied to any one household. */
export const HOUSEHOLDS_KEY = ['households'] as const

export { householdKey }

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
