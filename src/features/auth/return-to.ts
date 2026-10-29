/** The dashboard, used when there is no safe place to return to. */
export const DEFAULT_RETURN_PATH = '/'

/**
 * Accepts only paths inside the app (`/budgets?month=1`), never another origin
 * (`https://evil.example`, `//evil.example`, `/\evil.example`).
 */
export function safeReturnPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) {
    return DEFAULT_RETURN_PATH
  }
  return raw
}

/** `/login`, carrying where to go afterwards and why the user has to sign in. */
export function loginPath(next?: string, reason?: 'expired'): string {
  const params = new URLSearchParams()
  if (next && next !== DEFAULT_RETURN_PATH) params.set('next', next)
  if (reason) params.set('reason', reason)
  const query = params.toString()
  return query ? `/login?${query}` : '/login'
}

/** A public auth page path that keeps the `next` parameter, for links between them. */
export function withNext(path: '/login' | '/register', next: string | null): string {
  const target = safeReturnPath(next)
  return target === DEFAULT_RETURN_PATH ? path : `${path}?next=${encodeURIComponent(target)}`
}
