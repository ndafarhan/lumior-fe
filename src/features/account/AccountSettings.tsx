import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { z } from 'zod'

import { FormError } from '@/components/FormError'
import { FormField } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useApi } from '@/lib/api/context'
import { isApiError } from '@/lib/api/errors'
import { nameSchema, passwordSchema } from '@/lib/auth/account-rules'
import { useCurrentUser } from '@/lib/auth/use-session'
import { apiFormErrors, zodFieldErrors, type FormErrors } from '@/lib/forms'

/** `/account`: the signed-in user's email, display name, and password. */
export function AccountSettings() {
  return (
    <div className="grid max-w-2xl gap-6">
      <ProfileCard />
      <PasswordCard />
    </div>
  )
}

const profileSchema = z.object({ name: nameSchema })

function ProfileCard() {
  const { client, session } = useApi()
  const user = useCurrentUser()
  const [name, setName] = useState(user.name)
  const [errors, setErrors] = useState<FormErrors<'name'>>({})
  const [saved, setSaved] = useState(false)

  const update = useMutation({
    mutationFn: async (body: { name: string }) =>
      (await client.PATCH('/api/v1/me', { body })).data!,
    onSuccess: (updated) => {
      session.updateUser(updated)
      setName(updated.name)
      setSaved(true)
    },
    onError: (error) => setErrors(apiFormErrors(error, ['name'])),
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    setSaved(false)
    const parsed = profileSchema.safeParse({ name })
    if (!parsed.success) {
      setErrors(zodFieldErrors(parsed.error))
      return
    }
    setErrors({})
    update.mutate(parsed.data)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Profile</h2>
        </CardTitle>
        <CardDescription>
          Signed in as <span className="font-medium text-foreground">{user.email}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={submit} noValidate>
          <FormError message={errors.form} />
          <FormField
            label="Display name"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            error={errors.name}
          />
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={update.isPending}>
              Save name
            </Button>
            {saved && (
              <p role="status" className="text-sm text-muted-foreground">
                Name saved.
              </p>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

const passwordFormSchema = z.object({
  current_password: z.string().min(1, 'Enter your current password.'),
  new_password: passwordSchema,
})

type PasswordField = keyof z.infer<typeof passwordFormSchema>

function PasswordCard() {
  const { client } = useApi()
  const [values, setValues] = useState<Record<PasswordField, string>>({
    current_password: '',
    new_password: '',
  })
  const [errors, setErrors] = useState<FormErrors<PasswordField>>({})
  const [changed, setChanged] = useState(false)

  const change = useMutation({
    mutationFn: async (body: z.infer<typeof passwordFormSchema>) => {
      await client.POST('/api/v1/me/password', { body })
    },
    onSuccess: () => {
      setValues({ current_password: '', new_password: '' })
      setChanged(true)
    },
    onError: (error) => {
      if (isApiError(error) && error.code === 'invalid_current_password') {
        setErrors({ current_password: 'Current password is incorrect' })
      } else {
        setErrors(apiFormErrors(error, ['current_password', 'new_password']))
      }
    },
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    setChanged(false)
    const parsed = passwordFormSchema.safeParse(values)
    if (!parsed.success) {
      setErrors(zodFieldErrors(parsed.error))
      return
    }
    setErrors({})
    change.mutate(parsed.data)
  }

  const update = (field: PasswordField, value: string) =>
    setValues((current) => ({ ...current, [field]: value }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Password</h2>
        </CardTitle>
        <CardDescription>You stay signed in on this device after changing it.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={submit} noValidate>
          <FormError message={errors.form} />
          <FormField
            label="Current password"
            type="password"
            autoComplete="current-password"
            value={values.current_password}
            onChange={(event) => update('current_password', event.target.value)}
            error={errors.current_password}
          />
          <FormField
            label="New password"
            type="password"
            autoComplete="new-password"
            value={values.new_password}
            onChange={(event) => update('new_password', event.target.value)}
            error={errors.new_password}
            hint={<p className="text-sm text-muted-foreground">At least 8 characters.</p>}
          />
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={change.isPending}>
              Change password
            </Button>
            {changed && (
              <p role="status" className="text-sm text-muted-foreground">
                Password changed.
              </p>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
