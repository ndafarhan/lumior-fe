import { onTestFinished } from 'vitest'

import { server } from './server'

export type CapturedRequest = { url: URL; body: unknown }

/**
 * Records every request matching `method` and `path` (a regular expression on the URL path)
 * for the rest of the test. Call `bodies()` to wait for the JSON bodies read so far.
 */
export function captureRequests(method: string, path: RegExp) {
  const pending: Promise<CapturedRequest>[] = []
  const listener = ({ request }: { request: Request }) => {
    const url = new URL(request.url)
    if (request.method !== method || !path.test(url.pathname)) return
    pending.push(
      request
        .clone()
        .text()
        .then((text) => ({ url, body: text ? (JSON.parse(text) as unknown) : null })),
    )
  }
  server.events.on('request:start', listener)
  onTestFinished(() => server.events.removeListener('request:start', listener))
  return { all: () => Promise.all(pending) }
}
