import { useState, type FormEvent } from 'react'

import { ConfirmButton } from '@/components/ConfirmButton'
import { FormError } from '@/components/FormError'
import { FormField } from '@/components/FormField'
import { MoneyInput } from '@/components/money/MoneyInput'
import { SelectField } from '@/components/SelectField'
import { Button } from '@/components/ui/button'
import { isApiError } from '@/lib/api/errors'
import { userMessageFor } from '@/lib/api/messages'
import type { FormErrors } from '@/lib/forms'
import { toMoneyPayload } from '@/lib/money/format'
import { parseAmountInput, type ParseAmountResult } from '@/lib/money/parse'

import type { Expense, ExpenseCategory, Household } from './api'
import { today } from './month'
import { useCreateExpense, useDeleteExpense, useUpdateExpense } from './mutations'

const FIELDS = ['amount', 'spent_on', 'category_id', 'note'] as const
type Field = (typeof FIELDS)[number]

export const NOTE_MAX_LENGTH = 500

/** A parsed amount such as `"0"` or `"0.00"`. */
const ZERO = /^0+(\.0+)?$/

/** The amount field starts with the stored decimal string, which the money input accepts. */
const amountText = (expense?: Expense) => expense?.amount.amount ?? ''

type ExpenseFormProps = {
  household: Household
  categories: ExpenseCategory[]
  /** The expense to edit; omitted to add a new one. */
  expense?: Expense
  onSaved: (expense: Expense) => void
  onDeleted: () => void
  /** The expense was deleted by someone else. */
  onGone: () => void
}

/** Adds or edits an expense, and deletes it when editing. */
export function ExpenseForm({
  household,
  categories,
  expense,
  onSaved,
  onDeleted,
  onGone,
}: ExpenseFormProps) {
  const currency = household.currency
  const [amount, setAmount] = useState(amountText(expense))
  const [parsed, setParsed] = useState<ParseAmountResult>(() =>
    parseAmountInput(amountText(expense), currency),
  )
  const [spentOn, setSpentOn] = useState(expense?.spent_on ?? today())
  const [categoryId, setCategoryId] = useState(expense?.category_id ?? '')
  const [note, setNote] = useState(expense?.note ?? '')
  const [submitted, setSubmitted] = useState(false)
  const [errors, setErrors] = useState<FormErrors<Field>>({})

  const create = useCreateExpense(household.id)
  const update = useUpdateExpense(household.id)
  const remove = useDeleteExpense(household.id)
  const pending = create.isPending || update.isPending || remove.isPending

  // Archived categories cannot be chosen, except the one the expense already has.
  const choices = categories.filter(
    (category) => !category.archived || category.id === expense?.category_id,
  )

  function validate(): FormErrors<Field> {
    const found: FormErrors<Field> = {}
    if (parsed.ok && ZERO.test(parsed.value)) found.amount = 'Amount must be greater than zero.'
    if (!spentOn) found.spent_on = 'Enter a date.'
    else if (spentOn > today()) found.spent_on = 'The date cannot be in the future.'
    if (!categoryId) found.category_id = 'Choose a category.'
    if (note.trim().length > NOTE_MAX_LENGTH) {
      found.note = `The note can be at most ${NOTE_MAX_LENGTH} characters.`
    }
    return found
  }

  function handleError(error: unknown) {
    if (isApiError(error) && error.code === 'expense_not_found') {
      onGone()
      return
    }
    setErrors(expenseFormErrors(error))
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    const found = validate()
    setErrors(found)
    if (!parsed.ok || Object.keys(found).length > 0) return

    const body = {
      amount: toMoneyPayload(parsed.value, currency),
      spent_on: spentOn,
      category_id: categoryId,
      note: note.trim() || null,
    }
    if (expense) {
      update.mutate({ expenseId: expense.id, body }, { onSuccess: onSaved, onError: handleError })
    } else {
      create.mutate(body, { onSuccess: onSaved, onError: handleError })
    }
  }

  return (
    <form className="grid gap-4" onSubmit={submit} noValidate>
      <FormError message={errors.form} />
      <MoneyInput
        label="Amount"
        currency={currency}
        value={amount}
        onChange={(text, result) => {
          setAmount(text)
          setParsed(result)
          setErrors(({ amount: _, ...rest }) => rest)
        }}
        showError={submitted}
        error={errors.amount}
      />
      <FormField
        label="Date"
        type="date"
        max={today()}
        value={spentOn}
        onChange={(event) => setSpentOn(event.target.value)}
        error={errors.spent_on}
      />
      <SelectField
        label="Category"
        value={categoryId}
        onChange={(event) => setCategoryId(event.target.value)}
        error={errors.category_id}
      >
        <option value="" disabled>
          Choose a category
        </option>
        {choices.map((category) => (
          <option key={category.id} value={category.id}>
            {category.archived ? `${category.name} (archived)` : category.name}
          </option>
        ))}
      </SelectField>
      <FormField
        label="Note (optional)"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        error={errors.note}
      />
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {create.isPending || update.isPending ? 'Saving…' : 'Save expense'}
        </Button>
        {expense && (
          <div className="ml-auto">
            <ConfirmButton
              title="Delete this expense?"
              description="It is removed from the list and from the month's totals."
              confirmLabel="Delete"
              disabled={pending}
              onConfirm={() =>
                remove.mutate(expense.id, { onSuccess: onDeleted, onError: handleError })
              }
            >
              Delete
            </ConfirmButton>
          </div>
        )}
      </div>
    </form>
  )
}

/**
 * Maps a failed save onto the form. Validation details name nested fields such as
 * `amount.amount`, so they are matched by their first segment.
 */
function expenseFormErrors(error: unknown): FormErrors<Field> {
  const found: FormErrors<Field> = {}
  if (isApiError(error)) {
    for (const { field, reason } of error.fieldErrors) {
      const name = field.split('.')[0] as Field
      if ((FIELDS as readonly string[]).includes(name)) found[name] ??= reason
      else found.form ??= reason
    }
  }
  if (Object.keys(found).length === 0) found.form = userMessageFor(error)
  return found
}
