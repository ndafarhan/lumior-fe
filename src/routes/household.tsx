import { PageHeader } from '@/components/PageHeader'
import { HouseholdSettings } from '@/features/households/HouseholdSettings'

export function HouseholdPage() {
  return (
    <>
      <PageHeader title="Household settings">
        Manage the household you are working in and who belongs to it.
      </PageHeader>
      <HouseholdSettings />
    </>
  )
}
