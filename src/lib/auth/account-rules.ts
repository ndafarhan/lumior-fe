import { z } from 'zod'

// Mirrors the backend's limits in contracts/auth-and-households.md §4.
export const NAME_MAX_LENGTH = 100
export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 128

/** A display or household name: 1 to 100 characters after trimming. */
export const nameSchema = z
  .string()
  .trim()
  .min(1, 'Enter a name.')
  .max(NAME_MAX_LENGTH, `Use at most ${NAME_MAX_LENGTH} characters.`)

export const emailSchema = z.string().trim().min(1, 'Enter your email.').includes('@', {
  message: 'Enter a valid email address.',
})

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters.`)
  .max(PASSWORD_MAX_LENGTH, `Use at most ${PASSWORD_MAX_LENGTH} characters.`)
