import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import { FormError } from '@/components/FormError'
import { Money } from '@/components/money/Money'
import { SelectField } from '@/components/SelectField'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { userMessageFor } from '@/lib/api/messages'

import {
  useExpenseCategoriesQuery,
  useExpensesInfiniteQuery,
  useExpenseSummaryQuery,
  type Expense,
  type ExpenseCategory,
  type Household,
} from './api'
import { ExpenseForm } from './ExpenseForm'
import { addMonths, currentMonth, formatDate, formatMonth, monthOf, parseMonth } from './month'

type Editing = { mode: 'add' } | { mode: 'edit'; expense: Expense } | null

export const EXPENSE_GONE_MESSAGE = 'This expense no longer exists.'

/** `/expenses`: one month of the household's expenses with its totals and a category filter. */
export function ExpensesView({ household }: { household: Household }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const month = parseMonth(searchParams.get('month')) ?? currentMonth()
  const categoryId = searchParams.get('category') || null
  const [editing, setEditing] = useState<Editing>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const categories = useExpenseCategoriesQuery(household.id)
  const summary = useExpenseSummaryQuery(household.id, month)
  const expenses = useExpensesInfiniteQuery(household.id, month, categoryId)

  const categoryById = useMemo(
    () => new Map((categories.data ?? []).map((category) => [category.id, category])),
    [categories.data],
  )

  function updateParams(changes: { month?: string; category?: string | null }) {
    setSearchParams((params) => {
      const next = new URLSearchParams(params)
      if (changes.month !== undefined) next.set('month', changes.month)
      if (changes.category !== undefined) {
        if (changes.category) next.set('category', changes.category)
        else next.delete('category')
      }
      return next
    })
  }

  // Category ids belong to one household, so a household switch clears the filter.
  const shownHouseholdId = useRef(household.id)
  useEffect(() => {
    if (shownHouseholdId.current === household.id) return
    shownHouseholdId.current = household.id
    setEditing(null)
    setSearchParams(
      (params) => {
        const next = new URLSearchParams(params)
        next.delete('category')
        return next
      },
      { replace: true },
    )
  }, [household.id, setSearchParams])

  function saved(expense: Expense) {
    setEditing(null)
    setNotice(null)
    updateParams({ month: monthOf(expense.spent_on) })
  }

  function gone() {
    setEditing(null)
    setNotice(EXPENSE_GONE_MESSAGE)
  }

  const items = expenses.data?.pages.flatMap((page) => page.items) ?? []
  const monthLabel = formatMonth(month)

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Previous month"
            onClick={() => updateParams({ month: addMonths(month, -1) })}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <h2 className="min-w-40 text-center text-lg font-semibold">{monthLabel}</h2>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Next month"
            onClick={() => updateParams({ month: addMonths(month, 1) })}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <CategoryFilter
            categories={categories.data ?? []}
            value={categoryId}
            onChange={(category) => updateParams({ category })}
          />
          <Button variant="outline" asChild>
            <Link to="/expenses/categories">Manage categories</Link>
          </Button>
          <Button onClick={() => setEditing({ mode: 'add' })} disabled={!categories.data}>
            <Plus aria-hidden="true" />
            Add expense
          </Button>
        </div>
      </div>

      {notice && (
        <Alert role="status">
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[18rem_1fr]">
        <MonthSummary
          monthLabel={monthLabel}
          summary={summary}
          categoryName={(id) => categoryById.get(id)?.name ?? 'Unknown category'}
        />

        <section aria-label="Expenses" className="grid gap-3">
          {expenses.isPending ? (
            <p className="text-muted-foreground">Loading expenses…</p>
          ) : expenses.isError && items.length === 0 ? (
            <FormError message={userMessageFor(expenses.error)} />
          ) : items.length === 0 ? (
            <Card>
              <CardContent className="grid justify-items-start gap-3">
                <p>
                  {categoryId
                    ? `No expenses in this category in ${monthLabel}.`
                    : `No expenses in ${monthLabel}.`}
                </p>
                <Button
                  variant="outline"
                  onClick={() => setEditing({ mode: 'add' })}
                  disabled={!categories.data}
                >
                  Add an expense
                </Button>
              </CardContent>
            </Card>
          ) : (
            <ul
              aria-label={`Expenses in ${monthLabel}`}
              className="grid divide-y rounded-xl border"
            >
              {items.map((expense) => (
                <ExpenseRow
                  key={expense.id}
                  expense={expense}
                  category={categoryById.get(expense.category_id)}
                  onEdit={() => setEditing({ mode: 'edit', expense })}
                />
              ))}
            </ul>
          )}
          {expenses.hasNextPage && (
            <Button
              variant="outline"
              className="justify-self-center"
              onClick={() => void expenses.fetchNextPage()}
              disabled={expenses.isFetchingNextPage}
            >
              {expenses.isFetchingNextPage ? 'Loading…' : 'Load more'}
            </Button>
          )}
        </section>
      </div>

      <Sheet open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{editing?.mode === 'edit' ? 'Edit expense' : 'Add expense'}</SheetTitle>
            <SheetDescription>Amounts are in {household.currency}.</SheetDescription>
          </SheetHeader>
          {editing && categories.data && (
            <div className="px-4 pb-4">
              <ExpenseForm
                key={editing.mode === 'edit' ? editing.expense.id : 'new'}
                household={household}
                categories={categories.data}
                expense={editing.mode === 'edit' ? editing.expense : undefined}
                onSaved={saved}
                onDeleted={() => setEditing(null)}
                onGone={gone}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function CategoryFilter({
  categories,
  value,
  onChange,
}: {
  categories: ExpenseCategory[]
  value: string | null
  onChange: (categoryId: string | null) => void
}) {
  const active = categories.filter((category) => !category.archived)
  const archived = categories.filter((category) => category.archived)
  return (
    <div className="w-52">
      <SelectField
        label="Filter by category"
        hideLabel
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value || null)}
      >
        <option value="">All categories</option>
        {active.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
        {archived.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name} (archived)
          </option>
        ))}
      </SelectField>
    </div>
  )
}

function MonthSummary({
  monthLabel,
  summary,
  categoryName,
}: {
  monthLabel: string
  summary: ReturnType<typeof useExpenseSummaryQuery>
  categoryName: (categoryId: string) => string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h3>Spent in {monthLabel}</h3>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {summary.isPending ? (
          <p className="text-muted-foreground">Loading totals…</p>
        ) : summary.isError ? (
          <p className="text-sm text-destructive">{userMessageFor(summary.error)}</p>
        ) : (
          <>
            <p className="text-2xl font-semibold" aria-label="Month total">
              <Money value={summary.data.total} />
            </p>
            {summary.data.categories.length > 0 && (
              <ul aria-label="Totals by category" className="grid gap-2 text-sm">
                {summary.data.categories.map((entry) => (
                  <li key={entry.category_id} className="flex justify-between gap-3">
                    <span>{categoryName(entry.category_id)}</span>
                    <Money value={entry.total} className="tabular-nums" />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function ExpenseRow({
  expense,
  category,
  onEdit,
}: {
  expense: Expense
  category: ExpenseCategory | undefined
  onEdit: () => void
}) {
  const categoryLabel = category?.name ?? 'Unknown category'
  const date = formatDate(expense.spent_on)
  return (
    <li className="flex items-center gap-4 px-4 py-3">
      <div className="grid min-w-0 flex-1 gap-0.5">
        <span className="font-medium">{categoryLabel}</span>
        <span className="text-sm text-muted-foreground">
          {date}
          {expense.note && <> · {expense.note}</>}
        </span>
      </div>
      <Money value={expense.amount} className="font-medium tabular-nums" />
      <Button
        variant="ghost"
        size="sm"
        aria-label={`Edit ${categoryLabel} expense of ${date}`}
        onClick={onEdit}
      >
        Edit
      </Button>
    </li>
  )
}
