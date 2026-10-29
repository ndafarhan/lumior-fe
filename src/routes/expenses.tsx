import { PageHeader } from '@/components/PageHeader'
import { ExpensesView } from '@/features/expenses/ExpensesView'
import { useActiveHousehold } from '@/features/households/context'

export function ExpensesPage() {
  const household = useActiveHousehold()
  return (
    <>
      <PageHeader title="Expenses">Record and review what your household spends.</PageHeader>
      <ExpensesView household={household} />
    </>
  )
}
