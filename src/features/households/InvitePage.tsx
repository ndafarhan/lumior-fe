import { useNavigate, useParams } from 'react-router'

import { CenteredCard } from '@/components/CenteredCard'
import { FormError } from '@/components/FormError'
import { Button } from '@/components/ui/button'
import { isApiError } from '@/lib/api/errors'
import { userMessageFor } from '@/lib/api/messages'

import { useInvitePreviewQuery } from './api'
import { useHouseholds } from './context'
import { useAcceptInvite } from './mutations'

/** Why an invite cannot be used, in words for the person who opened it. */
function inviteProblem(error: unknown): { title: string; message: string } {
  const code = isApiError(error) ? error.code : null
  switch (code) {
    case 'invite_expired':
      return {
        title: 'This invite has expired',
        message: 'Ask the household owner to send you a new link.',
      }
    case 'invite_used':
      return {
        title: 'This invite has already been used',
        message: 'Each link works once. Ask the household owner to send you a new one.',
      }
    case 'invite_not_found':
      return {
        title: 'This invite link is not valid',
        message: 'Check that you copied the whole link, or ask the household owner for a new one.',
      }
    default:
      return { title: 'This invite could not be opened', message: userMessageFor(error) }
  }
}

/** `/invite/:code`: shows which household an invite is for and lets the user join it. */
export function InvitePage() {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const { setActive } = useHouseholds()
  const preview = useInvitePreviewQuery(code)
  const accept = useAcceptInvite(code)

  const goHome = () => void navigate('/', { replace: true })

  if (preview.isPending) {
    return (
      <CenteredCard title="Invitation">
        <p className="text-muted-foreground" role="status">
          Loading invite…
        </p>
      </CenteredCard>
    )
  }

  if (preview.isError) {
    const problem = inviteProblem(preview.error)
    return (
      <CenteredCard title={problem.title} description={problem.message}>
        <Button onClick={goHome}>Go to Lumior</Button>
      </CenteredCard>
    )
  }

  const invite = preview.data
  const switchToHousehold = () => {
    setActive(invite.household_id)
    goHome()
  }

  if (invite.already_member) {
    return (
      <CenteredCard
        title={`You're already a member of ${invite.household_name}`}
        description="There is nothing to join. You can switch to this household instead."
      >
        <Button onClick={switchToHousehold}>Switch to {invite.household_name}</Button>
      </CenteredCard>
    )
  }

  const acceptCode = isApiError(accept.error) ? accept.error.code : null
  if (acceptCode === 'already_member') {
    return (
      <CenteredCard title={`You're already a member of ${invite.household_name}`}>
        <Button onClick={switchToHousehold}>Switch to {invite.household_name}</Button>
      </CenteredCard>
    )
  }
  if (
    acceptCode === 'invite_expired' ||
    acceptCode === 'invite_used' ||
    acceptCode === 'invite_not_found'
  ) {
    const problem = inviteProblem(accept.error)
    return (
      <CenteredCard title={problem.title} description={problem.message}>
        <Button onClick={goHome}>Go to Lumior</Button>
      </CenteredCard>
    )
  }

  return (
    <CenteredCard
      title={`Join ${invite.household_name}`}
      description={`${invite.invited_by} invited you to share budgets and shopping lists in ${invite.household_name}.`}
    >
      {accept.isError && <FormError message={userMessageFor(accept.error)} />}
      <div className="flex gap-3">
        <Button
          className="flex-1"
          disabled={accept.isPending}
          onClick={() => accept.mutate(undefined, { onSuccess: goHome })}
        >
          {accept.isPending ? 'Joining…' : 'Join'}
        </Button>
        <Button className="flex-1" variant="outline" onClick={goHome}>
          Cancel
        </Button>
      </div>
    </CenteredCard>
  )
}
