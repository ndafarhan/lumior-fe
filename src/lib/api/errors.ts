import { z } from 'zod'

export const REQUEST_ID_HEADER = 'X-Request-ID'

export type ApiErrorKind = 'http' | 'network' | 'timeout'

/** One entry of `error.details`. Validation errors use `{location, reason, type}`. */
export type ApiErrorDetail = Record<string, unknown>

export type FieldError = {
  /** Field path without the input source, for example `name` or `items.0.quantity`. */
  field: string
  reason: string
}

/** What is known about the request that failed. */
type RequestInfo = { requestId: string | null; method?: string | null }

type ApiErrorInit = {
  kind: ApiErrorKind
  message: string
  status?: number | null
  code?: string
  details?: ApiErrorDetail[]
  requestId?: string | null
  method?: string | null
  cause?: unknown
}

// Input sources FastAPI puts first in a validation error location.
const INPUT_SOURCES = new Set(['body', 'query', 'path', 'header', 'cookie'])

/** The single error type every API call fails with. */
export class ApiError extends Error {
  readonly kind: ApiErrorKind
  /** HTTP status, or `null` when no response was received. */
  readonly status: number | null
  /** Backend `error.code`, `http_error` without an envelope, or `network_error`/`timeout`. */
  readonly code: string
  readonly details: ApiErrorDetail[]
  readonly requestId: string | null
  /** HTTP method of the failed request, when known. Used to decide whether to retry. */
  readonly method: string | null

  constructor(init: ApiErrorInit) {
    super(init.message, { cause: init.cause })
    this.name = 'ApiError'
    this.kind = init.kind
    this.status = init.status ?? null
    this.code = init.code ?? (init.kind === 'http' ? 'http_error' : `${init.kind}_error`)
    this.details = init.details ?? []
    this.requestId = init.requestId ?? null
    this.method = init.method?.toUpperCase() ?? null
  }

  static network(request: RequestInfo, cause?: unknown): ApiError {
    return new ApiError({
      kind: 'network',
      code: 'network_error',
      message: 'The server could not be reached.',
      ...request,
      cause,
    })
  }

  static timeout(request: RequestInfo, cause?: unknown): ApiError {
    return new ApiError({
      kind: 'timeout',
      code: 'timeout',
      message: 'The server took too long to respond.',
      ...request,
      cause,
    })
  }

  /** Validation details that point at a field, ready to show next to form inputs. */
  get fieldErrors(): FieldError[] {
    return this.details.flatMap((detail) => {
      const parsed = fieldDetailSchema.safeParse(detail)
      if (!parsed.success) return []
      const path = parsed.data.location.map(String)
      if (path.length > 1 && INPUT_SOURCES.has(path[0]!)) path.shift()
      return [{ field: path.join('.'), reason: parsed.data.reason }]
    })
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

const fieldDetailSchema = z.object({
  location: z.array(z.union([z.string(), z.number()])).min(1),
  reason: z.string(),
})

const envelopeSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().optional(),
    details: z.array(z.record(z.string(), z.unknown())).optional().catch(undefined),
    request_id: z.string().optional(),
  }),
})

/** Builds an `ApiError` from a non-2xx response, using the error envelope when present. */
export async function apiErrorFromResponse(
  response: Response,
  method: string | null = null,
): Promise<ApiError> {
  const headerRequestId = response.headers.get(REQUEST_ID_HEADER)
  const fallbackMessage = `Request failed with status ${response.status}.`

  let body: unknown
  try {
    body = JSON.parse(await response.text())
  } catch {
    body = undefined
  }

  const envelope = envelopeSchema.safeParse(body)
  if (!envelope.success) {
    return new ApiError({
      kind: 'http',
      status: response.status,
      message: fallbackMessage,
      requestId: headerRequestId,
      method,
    })
  }

  const { code, message, details, request_id } = envelope.data.error
  return new ApiError({
    kind: 'http',
    status: response.status,
    code,
    message: message || fallbackMessage,
    details: details ?? [],
    requestId: request_id ?? headerRequestId,
    method,
  })
}
