import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { z } from 'zod'

import { CenteredCard } from '@/components/CenteredCard'
import { FormError } from '@/components/FormError'
import { FormField } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { useApi } from '@/lib/api/context'
import { isApiError } from '@/lib/api/errors'
import { emailSchema, nameSchema, passwordSchema } from '@/lib/auth/account-rules'
import { apiFormErrors, zodFieldErrors, type FormErrors } from '@/lib/forms'

import { withNext } from './return-to'

const registerSchema = z.object({ name: nameSchema, email: emailSchema, password: passwordSchema })

type Field = keyof z.infer<typeof registerSchema>
const FIELDS: readonly Field[] = ['name', 'email', 'password']

/** `/register`. Registration signs the user in; the public-route guard then moves on. */
export function RegisterPage() {
  const { client, session } = useApi()
  const [searchParams] = useSearchParams()
  const [values, setValues] = useState<Record<Field, string>>({ name: '', email: '', password: '' })
  const [errors, setErrors] = useState<FormErrors<Field>>({})
  const [emailTaken, setEmailTaken] = useState(false)
  const next = searchParams.get('next')

  const register = useMutation({
    mutationFn: async (body: z.infer<typeof registerSchema>) =>
      (await client.POST('/api/v1/auth/register', { body })).data!,
    onSuccess: (data) => session.signIn(data),
    onError: (error) => {
      if (isApiError(error) && error.code === 'email_taken') {
        setErrors({ email: 'An account with this email already exists' })
        setEmailTaken(true)
      } else {
        setErrors(apiFormErrors(error, FIELDS))
      }
    },
  })

  function update(field: Field, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    if (field === 'email') setEmailTaken(false)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const parsed = registerSchema.safeParse(values)
    if (!parsed.success) {
      setErrors(zodFieldErrors(parsed.error))
      return
    }
    setErrors({})
    register.mutate(parsed.data)
  }

  return (
    <CenteredCard
      title="Create your account"
      description="Plan your household budget and shop smarter."
      footer={
        <>
          Already have an account?{' '}
          <Link className="font-medium text-foreground underline" to={withNext('/login', next)}>
            Sign in
          </Link>
        </>
      }
    >
      <form className="grid gap-4" onSubmit={submit} noValidate>
        <FormError message={errors.form} />
        <FormField
          label="Name"
          autoComplete="name"
          value={values.name}
          onChange={(event) => update('name', event.target.value)}
          error={errors.name}
        />
        <FormField
          label="Email"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={(event) => update('email', event.target.value)}
          error={errors.email}
          hint={
            emailTaken && (
              <Link className="text-sm underline" to={withNext('/login', next)}>
                Sign in instead
              </Link>
            )
          }
        />
        <FormField
          label="Password"
          type="password"
          autoComplete="new-password"
          value={values.password}
          onChange={(event) => update('password', event.target.value)}
          error={errors.password}
          hint={<p className="text-sm text-muted-foreground">At least 8 characters.</p>}
        />
        <Button type="submit" disabled={register.isPending}>
          {register.isPending ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </CenteredCard>
  )
}
