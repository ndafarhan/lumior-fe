import { useState, type FormEvent } from 'react'
import { z } from 'zod'

import { FormError } from '@/components/FormError'
import { FormField } from '@/components/FormField'
import { SelectField } from '@/components/SelectField'
import { Button } from '@/components/ui/button'
import { nameSchema } from '@/lib/auth/account-rules'
import { CURRENCY_PRECISION } from '@/lib/money/currency'
import { apiFormErrors, zodFieldErrors, type FormErrors } from '@/lib/forms'

import type { Household } from './api'
import { useCreateHousehold } from './mutations'

const schema = z.object({ name: nameSchema, currency: z.string() })

/** The currencies a household can use: the ones the backend knows the precision of. */
const CURRENCIES = Object.keys(CURRENCY_PRECISION).sort()
export const DEFAULT_CURRENCY = 'IDR'

/** Creates a household and makes it active, then calls `onCreated`. */
export function CreateHouseholdForm({ onCreated }: { onCreated?: (household: Household) => void }) {
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY)
  const [errors, setErrors] = useState<FormErrors<'name' | 'currency'>>({})
  const create = useCreateHousehold()

  function submit(event: FormEvent) {
    event.preventDefault()
    const parsed = schema.safeParse({ name, currency })
    if (!parsed.success) {
      setErrors(zodFieldErrors(parsed.error))
      return
    }
    setErrors({})
    create.mutate(parsed.data, {
      onSuccess: (household) => onCreated?.(household),
      onError: (error) => setErrors(apiFormErrors(error, ['name', 'currency'])),
    })
  }

  return (
    <form className="grid gap-4" onSubmit={submit} noValidate>
      <FormError message={errors.form} />
      <FormField
        label="Household name"
        placeholder="For example: Rumah Bandung"
        value={name}
        onChange={(event) => setName(event.target.value)}
        error={errors.name}
      />
      <SelectField
        label="Currency"
        value={currency}
        onChange={(event) => setCurrency(event.target.value)}
        error={errors.currency}
      >
        {CURRENCIES.map((code) => (
          <option key={code} value={code}>
            {code}
          </option>
        ))}
      </SelectField>
      <p className="-mt-2 text-sm text-muted-foreground">
        Every expense of this household uses this currency. It cannot be changed later.
      </p>
      <Button type="submit" disabled={create.isPending}>
        {create.isPending ? 'Creating…' : 'Create household'}
      </Button>
    </form>
  )
}
