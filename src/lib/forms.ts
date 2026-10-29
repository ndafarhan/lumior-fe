import type { z } from 'zod'

import { isApiError } from '@/lib/api/errors'
import { userMessageFor } from '@/lib/api/messages'

/** Error text per form field, plus `form` for errors that belong to no single field. */
export type FormErrors<Field extends string> = Partial<Record<Field | 'form', string>>

/** The first zod issue for each field. */
export function zodFieldErrors<Field extends string>(error: z.ZodError): FormErrors<Field> {
  const errors: FormErrors<Field> = {}
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? 'form') as Field | 'form'
    errors[field] ??= issue.message
  }
  return errors
}

/**
 * Maps a failed request onto a form: validation details for known fields go next to those
 * fields, and anything else becomes the form-level message.
 */
export function apiFormErrors<Field extends string>(
  error: unknown,
  fields: readonly Field[],
): FormErrors<Field> {
  const errors: FormErrors<Field> = {}
  if (isApiError(error)) {
    for (const { field, reason } of error.fieldErrors) {
      if ((fields as readonly string[]).includes(field)) errors[field as Field] ??= reason
      else errors.form ??= reason
    }
  }
  if (Object.keys(errors).length === 0) errors.form = userMessageFor(error)
  return errors
}
