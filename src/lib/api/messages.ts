import { isApiError } from './errors'

const GENERIC_MESSAGE = 'Something went wrong. Please try again.'

/** Text to show a user for a failed request (or any other error). */
export function userMessageFor(error: unknown): string {
  if (!isApiError(error)) return GENERIC_MESSAGE

  switch (error.kind) {
    case 'network':
      return 'Cannot reach the server. Check your connection and try again.'
    case 'timeout':
      return 'The server is taking too long to respond. Please try again.'
    case 'http':
      if (error.status === null || error.status >= 500) {
        return 'The server ran into a problem. Please try again later.'
      }
      // The backend writes 4xx messages for people, for example "Budget not found."
      return error.message
  }
}
