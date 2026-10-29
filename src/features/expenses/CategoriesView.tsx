import { useState, type FormEvent } from 'react'
import { z } from 'zod'

import { FormError } from '@/components/FormError'
import { FormField } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { isApiError } from '@/lib/api/errors'
import { userMessageFor } from '@/lib/api/messages'
import { apiFormErrors, zodFieldErrors, type FormErrors } from '@/lib/forms'

import { useExpenseCategoriesQuery, type ExpenseCategory, type Household } from './api'
import { useCreateCategory, useUpdateCategory } from './mutations'

export const NAME_TAKEN_MESSAGE = 'A category with this name already exists'

const nameSchema = z
  .string()
  .trim()
  .min(1, 'Enter a name.')
  .max(50, 'The name can be at most 50 characters.')
const schema = z.object({ name: nameSchema })

/** Field errors for a failed create or rename; a taken name goes on the name field. */
function nameErrors(error: unknown): FormErrors<'name'> {
  if (isApiError(error) && error.code === 'category_name_taken') return { name: NAME_TAKEN_MESSAGE }
  return apiFormErrors(error, ['name'])
}

/** `/expenses/categories`: the household's categories, to add, rename, archive, and restore. */
export function CategoriesView({ household }: { household: Household }) {
  const categories = useExpenseCategoriesQuery(household.id)
  const update = useUpdateCategory(household.id)
  const [error, setError] = useState<string>()

  if (categories.isPending) return <p className="text-muted-foreground">Loading categories…</p>
  if (categories.isError) return <FormError message={userMessageFor(categories.error)} />

  const active = categories.data.filter((category) => !category.archived)
  const archived = categories.data.filter((category) => category.archived)

  function setArchived(category: ExpenseCategory, value: boolean) {
    setError(undefined)
    update.mutate(
      { categoryId: category.id, changes: { archived: value } },
      { onError: (failure) => setError(userMessageFor(failure)) },
    )
  }

  return (
    <div className="grid max-w-2xl gap-6">
      <AddCategoryCard householdId={household.id} />
      <FormError message={error} />

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Categories</h2>
          </CardTitle>
          <CardDescription>Shown when you add an expense.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul aria-label="Active categories" className="grid divide-y">
            {active.map((category) => (
              <CategoryRow key={category.id} householdId={household.id} category={category}>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={`Archive ${category.name}`}
                  disabled={update.isPending}
                  onClick={() => setArchived(category, true)}
                >
                  Archive
                </Button>
              </CategoryRow>
            ))}
          </ul>
        </CardContent>
      </Card>

      {archived.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Archived</h2>
            </CardTitle>
            <CardDescription>
              Not offered for new expenses. Their past expenses keep them.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul aria-label="Archived categories" className="grid divide-y">
              {archived.map((category) => (
                <CategoryRow key={category.id} householdId={household.id} category={category}>
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={`Restore ${category.name}`}
                    disabled={update.isPending}
                    onClick={() => setArchived(category, false)}
                  >
                    Restore
                  </Button>
                </CategoryRow>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function AddCategoryCard({ householdId }: { householdId: string }) {
  const [name, setName] = useState('')
  const [errors, setErrors] = useState<FormErrors<'name'>>({})
  const create = useCreateCategory(householdId)

  function submit(event: FormEvent) {
    event.preventDefault()
    const parsed = schema.safeParse({ name })
    if (!parsed.success) {
      setErrors(zodFieldErrors(parsed.error))
      return
    }
    setErrors({})
    create.mutate(parsed.data.name, {
      onSuccess: () => setName(''),
      onError: (error) => setErrors(nameErrors(error)),
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Add a category</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={submit} noValidate>
          <FormError message={errors.form} />
          <FormField
            label="Category name"
            placeholder="For example: Pets"
            value={name}
            onChange={(event) => setName(event.target.value)}
            error={errors.name}
          />
          <Button type="submit" className="justify-self-start" disabled={create.isPending}>
            Add category
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

/** One category with its name, a rename action, and the archive or restore action. */
function CategoryRow({
  householdId,
  category,
  children,
}: {
  householdId: string
  category: ExpenseCategory
  children: React.ReactNode
}) {
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(category.name)
  const [errors, setErrors] = useState<FormErrors<'name'>>({})
  const update = useUpdateCategory(householdId)

  function submit(event: FormEvent) {
    event.preventDefault()
    const parsed = schema.safeParse({ name })
    if (!parsed.success) {
      setErrors(zodFieldErrors(parsed.error))
      return
    }
    setErrors({})
    update.mutate(
      { categoryId: category.id, changes: { name: parsed.data.name } },
      {
        onSuccess: () => setRenaming(false),
        onError: (error) => setErrors(nameErrors(error)),
      },
    )
  }

  if (renaming) {
    return (
      <li className="py-3">
        <form className="grid gap-3" onSubmit={submit} noValidate>
          <FormError message={errors.form} />
          <FormField
            label={`New name for ${category.name}`}
            value={name}
            onChange={(event) => setName(event.target.value)}
            error={errors.name}
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={update.isPending}>
              Save name
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setRenaming(false)
                setName(category.name)
                setErrors({})
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      </li>
    )
  }

  return (
    <li className="flex items-center gap-2 py-2">
      <span className="flex-1">{category.name}</span>
      <Button
        variant="ghost"
        size="sm"
        aria-label={`Rename ${category.name}`}
        onClick={() => {
          setName(category.name)
          setRenaming(true)
        }}
      >
        Rename
      </Button>
      {children}
    </li>
  )
}
