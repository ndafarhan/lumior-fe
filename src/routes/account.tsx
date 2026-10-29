import { PageHeader } from '@/components/PageHeader'
import { AccountSettings } from '@/features/account/AccountSettings'

export function AccountPage() {
  return (
    <>
      <PageHeader title="Account settings">Your profile and sign-in details.</PageHeader>
      <AccountSettings />
    </>
  )
}
