import { currencyPrecision, isSupportedCurrency } from './currency'

/** A monetary value as the API sends it: `{"amount": "12500.00", "currency": "IDR"}`. */
export type MoneyValue = { amount: string; currency: string }

/** Shown instead of a malformed amount. */
export const UNAVAILABLE = '—'

/** Same pattern the backend accepts for amounts. */
export const DECIMAL_STRING = /^-?\d+(\.\d+)?$/

const formatters = new Map<string, Intl.NumberFormat>()

function formatterFor(currency: string, fractionDigits: number, maxFractionDigits: number) {
  const key = `${currency}:${fractionDigits}:${maxFractionDigits}`
  let formatter = formatters.get(key)
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: maxFractionDigits,
    })
    formatters.set(key, formatter)
  }
  return formatter
}

/**
 * Formats a money value for display, for example `IDR 12,500.00` or `-$250.50`.
 *
 * The amount stays a string: `Intl.NumberFormat` formats decimal strings exactly, so no digit is
 * lost to floating-point conversion. An amount with more decimals than the currency normally
 * uses is shown in full rather than rounded. Malformed input returns `—`.
 */
export function formatMoney(money: MoneyValue): string {
  const amount = typeof money.amount === 'string' ? money.amount.trim() : ''
  if (!DECIMAL_STRING.test(amount) || !isSupportedCurrency(money.currency)) return UNAVAILABLE

  const precision = currencyPrecision(money.currency)
  const decimals = amount.split('.')[1]?.length ?? 0
  // `format` accepts any decimal string; TypeScript types it as a numeric string literal.
  return formatterFor(money.currency, precision, Math.max(precision, decimals)).format(
    amount as `${number}`,
  )
}

/** Builds the request body shape for an amount produced by `parseAmountInput`. */
export function toMoneyPayload(amount: string, currency: string): MoneyValue {
  return { amount, currency }
}
