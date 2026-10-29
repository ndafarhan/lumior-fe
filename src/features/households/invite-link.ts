/** The link a person opens to join; built here so the backend never needs the app's URL. */
export function inviteLink(code: string): string {
  return `${window.location.origin}/invite/${encodeURIComponent(code)}`
}
