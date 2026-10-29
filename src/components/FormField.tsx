import { useId, type ComponentProps } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type FormFieldProps = ComponentProps<typeof Input> & {
  label: string
  error?: string
  /** Extra content under the input, for example a link. */
  hint?: React.ReactNode
}

/** A labelled input with its error message wired up for assistive technology. */
export function FormField({ label, error, hint, id, ...inputProps }: FormFieldProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const errorId = `${inputId}-error`

  return (
    <div className="grid gap-2">
      <Label htmlFor={inputId}>{label}</Label>
      <Input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...inputProps}
      />
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
      {hint}
    </div>
  )
}
