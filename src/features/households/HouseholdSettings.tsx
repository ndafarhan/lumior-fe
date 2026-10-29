import { useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { z } from 'zod'

import { ConfirmButton } from '@/components/ConfirmButton'
import { FormError } from '@/components/FormError'
import { FormField } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { isApiError } from '@/lib/api/errors'
import { userMessageFor } from '@/lib/api/messages'
import { nameSchema } from '@/lib/auth/account-rules'
import { useCurrentUser } from '@/lib/auth/use-session'
import { apiFormErrors, zodFieldErrors, type FormErrors } from '@/lib/forms'

import { HOUSEHOLDS_KEY, householdKey, useMembersQuery, type Household } from './api'
import { useActiveHousehold } from './context'
import { InviteMember } from './InviteMember'
import { useLeaveHousehold, useRemoveMember, useRenameHousehold } from './mutations'

export const PERMISSION_MESSAGE = "You don't have permission to do this"

/**
 * Owner actions can be refused if the user's role changed elsewhere. Show the permission
 * message and reload who is who; any other failure gets its usual message.
 */
function useOwnerActionErrors(householdId: string) {
  const queryClient = useQueryClient()
  return (error: unknown): string => {
    if (isApiError(error) && error.code === 'owner_required') {
      void queryClient.invalidateQueries({ queryKey: [...householdKey(householdId), 'members'] })
      void queryClient.invalidateQueries({ queryKey: HOUSEHOLDS_KEY })
      return PERMISSION_MESSAGE
    }
    return userMessageFor(error)
  }
}

/** `/household`: the active household's name, members, invites, and leaving. */
export function HouseholdSettings() {
  const household = useActiveHousehold()
  const isOwner = household.role === 'owner'

  return (
    <div className="grid max-w-2xl gap-6">
      <NameCard household={household} isOwner={isOwner} />
      <CurrencyCard household={household} />
      <MembersCard household={household} isOwner={isOwner} />
      {isOwner && <InviteMember householdId={household.id} />}
      {!isOwner && <LeaveCard household={household} />}
    </div>
  )
}

const renameSchema = z.object({ name: nameSchema })

function NameCard({ household, isOwner }: { household: Household; isOwner: boolean }) {
  const [name, setName] = useState(household.name)
  const [errors, setErrors] = useState<FormErrors<'name'>>({})
  const [saved, setSaved] = useState(false)
  const rename = useRenameHousehold(household.id)
  const ownerError = useOwnerActionErrors(household.id)

  function submit(event: FormEvent) {
    event.preventDefault()
    setSaved(false)
    const parsed = renameSchema.safeParse({ name })
    if (!parsed.success) {
      setErrors(zodFieldErrors(parsed.error))
      return
    }
    setErrors({})
    rename.mutate(parsed.data.name, {
      onSuccess: () => setSaved(true),
      onError: (error) =>
        setErrors(
          isApiError(error) && error.status === 422
            ? apiFormErrors(error, ['name'])
            : { form: ownerError(error) },
        ),
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Name</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isOwner ? (
          <form className="grid gap-4" onSubmit={submit} noValidate>
            <FormError message={errors.form} />
            <FormField
              label="Household name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              error={errors.name}
            />
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={rename.isPending}>
                Save name
              </Button>
              {saved && (
                <p role="status" className="text-sm text-muted-foreground">
                  Name saved.
                </p>
              )}
            </div>
          </form>
        ) : (
          <p>{household.name}</p>
        )}
      </CardContent>
    </Card>
  )
}

/** The currency is set when the household is created and cannot be changed. */
function CurrencyCard({ household }: { household: Household }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Currency</h2>
        </CardTitle>
        <CardDescription>
          Every expense of this household uses this currency. It cannot be changed.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p>{household.currency}</p>
      </CardContent>
    </Card>
  )
}

function MembersCard({ household, isOwner }: { household: Household; isOwner: boolean }) {
  const currentUser = useCurrentUser()
  const members = useMembersQuery(household.id)
  const remove = useRemoveMember(household.id)
  const ownerError = useOwnerActionErrors(household.id)
  const [error, setError] = useState<string>()

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Members</h2>
        </CardTitle>
        <CardDescription>
          Everyone who shares this household&apos;s budgets and lists.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <FormError message={error} />
        {members.isPending && <p className="text-sm text-muted-foreground">Loading members…</p>}
        {members.isError && <FormError message={userMessageFor(members.error)} />}
        {members.data && (
          <ul className="divide-y" aria-label="Members">
            {members.data.map((member) => {
              const isMe = member.user_id === currentUser.id
              return (
                <li key={member.user_id} className="flex items-center justify-between gap-3 py-3">
                  <div className="grid">
                    <span className="font-medium">
                      {member.name}
                      {isMe && <span className="ml-2 text-sm text-muted-foreground">(You)</span>}
                    </span>
                    <span className="text-sm text-muted-foreground">{member.email}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full border px-2 py-0.5 text-xs capitalize">
                      {member.role}
                    </span>
                    {isOwner && !isMe && (
                      <ConfirmButton
                        triggerLabel={`Remove ${member.name}`}
                        title={`Remove ${member.name}?`}
                        description={`${member.name} will lose access to ${household.name}.`}
                        confirmLabel="Remove"
                        disabled={remove.isPending}
                        onConfirm={() => {
                          setError(undefined)
                          remove.mutate(member.user_id, {
                            onError: (cause) => setError(ownerError(cause)),
                          })
                        }}
                      >
                        Remove
                      </ConfirmButton>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function LeaveCard({ household }: { household: Household }) {
  const leave = useLeaveHousehold(household.id)
  const navigate = useNavigate()
  const [error, setError] = useState<string>()

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Leave household</h2>
        </CardTitle>
        <CardDescription>
          You will lose access to {household.name} until someone invites you again.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <FormError message={error} />
        <div>
          <ConfirmButton
            title={`Leave ${household.name}?`}
            description="You will lose access to its budgets, expenses, and shopping lists."
            confirmLabel="Leave"
            disabled={leave.isPending}
            onConfirm={() => {
              setError(undefined)
              leave.mutate(undefined, {
                onSuccess: () => void navigate('/', { replace: true }),
                onError: (cause) => setError(userMessageFor(cause)),
              })
            }}
          >
            Leave household
          </ConfirmButton>
        </div>
      </CardContent>
    </Card>
  )
}
