import { z } from 'zod'

export type AppConfig = {
  /** Backend origin without a trailing slash, for example `http://localhost:8000`. */
  apiBaseUrl: string
}

export type ConfigIssue = { setting: string; message: string }

export type ConfigResult = { ok: true; config: AppConfig } | { ok: false; issues: ConfigIssue[] }

const envSchema = z.object({
  VITE_API_BASE_URL: z
    .url({
      protocol: /^https?$/,
      error: (issue) =>
        issue.input === undefined || issue.input === ''
          ? 'is required'
          : 'must be an absolute http(s) URL, for example http://localhost:8000',
    })
    .transform((url) => url.replace(/\/+$/, '')),
})

/** Validates build-time environment variables. Pass `import.meta.env` in the app. */
export function parseConfig(env: Record<string, unknown>): ConfigResult {
  const result = envSchema.safeParse(env)
  if (!result.success) {
    return {
      ok: false,
      issues: result.error.issues.map((issue) => ({
        setting: issue.path.join('.'),
        message: issue.message,
      })),
    }
  }
  return { ok: true, config: { apiBaseUrl: result.data.VITE_API_BASE_URL } }
}
