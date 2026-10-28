import { useEffect } from 'react'
import { useMatches } from 'react-router'

export const APP_NAME = 'Lumior'

/** Route `handle` shape. Each page route sets the title shown in the browser tab. */
export type RouteHandle = { title?: string }

/** Sets `document.title` to "<deepest route title> · Lumior". */
export function useDocumentTitle() {
  const matches = useMatches()
  const title = matches
    .map((match) => (match.handle as RouteHandle | undefined)?.title)
    .filter(Boolean)
    .at(-1)

  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME
  }, [title])
}
