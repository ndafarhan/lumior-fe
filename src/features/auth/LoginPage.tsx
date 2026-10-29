import { useMutation } from '@tanstack/react-query'
import { Clock } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { z } from 'zod'

import { CenteredCard } from '@/components/CenteredCard'
import { FormError } from '@/components/FormError'
import { FormField } from '@/components/FormField'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useApi } from '@/lib/api/context'
import { isApiError } from '@/lib/api/errors'
import { apiFormErrors, zodFieldErrors, type FormErrors } from '@/lib/forms'

import { withNext } from './return-to'

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email.'),
  password: z.string().min(1, 'Enter your password.'),
})

type Field = keyof z.infer<typeof loginSchema>

/** `/login`. After signing in, the public-route guard sends the user to `next`. */
export function LoginPage() {
  const { client, session } = useApi()
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FormErrors<Field>>({})

  const login = useMutation({
    mutationFn: async (body: z.infer<typeof loginSchema>) =>
      (await client.POST('/api/v1/auth/login', { body })).data!,
    onSuccess: (data) => session.signIn(data),
    onError: (error) => {
      if (isApiError(error) && error.code === 'invalid_credentials') {
        setErrors({ form: 'Incorrect email or password' })
        setPassword('')
      } else {
        setErrors(apiFormErrors(error, ['email', 'password']))
      }
    },
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    const parsed = loginSchema.safeParse({ email, password })
    if (!parsed.success) {
      setErrors(zodFieldErrors(parsed.error))
      return
    }
    setErrors({})
    login.mutate(parsed.data)
  }

  const next = searchParams.get('next')
  const expired = searchParams.get('reason') === 'expired'

  return (
    <CenteredCard
      title="Sign in"
      description="Welcome back to Lumior."
      footer={
        <>
          New to Lumior?{' '}
          <Link className="font-medium text-foreground underline" to={withNext('/register', next)}>
            Create an account
          </Link>
        </>
      }
    >
      {expired && (
        <Alert>
          <Clock aria-hidden="true" />
          <AlertDescription>Your session has expired. Please sign in again.</AlertDescription>
        </Alert>
      )}
      <form className="grid gap-4" onSubmit={submit} noValidate>
        <FormError message={errors.form} />
        <FormField
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={errors.email}
        />
        <FormField
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
        />
        <Button type="submit" disabled={login.isPending}>
          {login.isPending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </CenteredCard>
  )
}
