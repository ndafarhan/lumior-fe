/**
 * Prefix for data that belongs to one household. Every household-scoped query key starts with
 * it, so switching households can drop the previous household's data in one call.
 */
export const householdKey = (householdId: string) => ['household', householdId] as const
