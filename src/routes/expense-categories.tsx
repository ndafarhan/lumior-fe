import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router'

import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { CategoriesView } from '@/features/expenses/CategoriesView'
import { useActiveHousehold } from '@/features/households/context'

export function ExpenseCategoriesPage() {
  const household = useActiveHousehold()
  return (
    <>
      <Button variant="ghost" size="sm" className="mb-2 -ml-2" asChild>
        <Link to="/expenses">
          <ArrowLeft aria-hidden="true" />
          Back to expenses
        </Link>
      </Button>
      <PageHeader title="Expense categories">
        Group your household&apos;s expenses. Archive a category you no longer use.
      </PageHeader>
      <CategoriesView household={household} />
    </>
  )
}
