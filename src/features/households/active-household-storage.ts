// Remembers each user's active household on this device. Only an ID, never a credential.
const key = (userId: string) => `lumior.activeHousehold.${userId}`

export function readActiveHouseholdId(userId: string): string | null {
  try {
    return localStorage.getItem(key(userId))
  } catch {
    return null
  }
}

export function writeActiveHouseholdId(userId: string, householdId: string) {
  try {
    localStorage.setItem(key(userId), householdId)
  } catch {
    // Storage unavailable: the first household is selected after the next load.
  }
}
