import { useState, type FormEvent } from 'react'
import { z } from 'zod'

import { FormError } from '@/components/FormError'
import { FormField } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { nameSchema } from '@/lib/auth/account-rules'
import { apiFormErrors, zodFieldErrors, type FormErrors } from '@/lib/forms'

import type { Household } from './api'
import { useCreateHousehold } from './mutations'

const schema = z.object({ name: nameSchema })

/** Creates a household and makes it active, then calls `onCreated`. */
export function CreateHouseholdForm({ onCreated }: { onCreated?: (household: Household) => void }) {
  const [name, setName] = useState('')
  const [errors, setErrors] = useState<FormErrors<'name'>>({})
  const create = useCreateHousehold()

  function submit(event: FormEvent) {
    event.preventDefault()
    const parsed = schema.safeParse({ name })
    if (!parsed.success) {
      setErrors(zodFieldErrors(parsed.error))
      return
    }
    setErrors({})
    create.mutate(parsed.data.name, {
      onSuccess: (household) => onCreated?.(household),
      onError: (error) => setErrors(apiFormErrors(error, ['name'])),
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
      <Button type="submit" disabled={create.isPending}>
        {create.isPending ? 'Creating…' : 'Create household'}
      </Button>
    </form>
  )
}
