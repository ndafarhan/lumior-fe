import { Link2 } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router'

import { CenteredCard } from '@/components/CenteredCard'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { safeReturnPath } from '@/features/auth/return-to'
import { useSignOut } from '@/features/auth/use-sign-out'
import { useHouseholds } from '@/features/households/context'
import { CreateHouseholdForm } from '@/features/households/CreateHouseholdForm'
import { HouseholdNotice } from '@/features/households/HouseholdNotice'

/** `/welcome`: onboarding for a user who belongs to no household yet. */
export function WelcomePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { active } = useHouseholds()
  const signOut = useSignOut()

  return (
    <CenteredCard
      title={active ? 'Create a household' : 'Create your household'}
      description={
        active
          ? 'You will become its owner and can invite others to join.'
          : 'Budgets, expenses, and shopping lists in Lumior belong to a household. Start by creating yours.'
      }
      footer={
        <>
          {active ? (
            <Link className="font-medium text-foreground underline" to="/">
              Back to {active.name}
            </Link>
          ) : (
            <Button variant="link" className="h-auto p-0" onClick={signOut}>
              Sign out
            </Button>
          )}
        </>
      }
    >
      <HouseholdNotice />
      <CreateHouseholdForm
        onCreated={() => void navigate(safeReturnPath(searchParams.get('next')), { replace: true })}
      />
      <Alert>
        <Link2 aria-hidden="true" />
        <AlertDescription>
          Joining someone else&apos;s household? Ask its owner for an invite link and open it while
          signed in.
        </AlertDescription>
      </Alert>
    </CenteredCard>
  )
}
