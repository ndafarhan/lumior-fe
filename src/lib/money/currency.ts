/**
 * Decimal places per currency, mirroring `CURRENCY_PRECISION` in lumior-be
 * (`src/lumior/core/money.py`). The backend rounds amounts to these, so the frontend uses the
 * same table instead of the browser's CLDR data, which differs for some currencies (for example
 * IDR has 0 decimals in CLDR but 2 in Lumior). Keep the two tables in sync.
 */
export const CURRENCY_PRECISION: Readonly<Record<string, number>> = {
  AUD: 2,
  CNY: 2,
  EUR: 2,
  GBP: 2,
  IDR: 2,
  INR: 2,
  JPY: 0,
  KRW: 0,
  MYR: 2,
  PHP: 2,
  SGD: 2,
  THB: 2,
  USD: 2,
  VND: 0,
}

const CURRENCY_CODE = /^[A-Z]{3}$/

let supportedCurrencies: Set<string> | undefined

/** Whether `code` is an ISO 4217 currency code the browser can format. */
export function isSupportedCurrency(code: string): boolean {
  if (!CURRENCY_CODE.test(code)) return false
  supportedCurrencies ??= new Set(Intl.supportedValuesOf('currency'))
  return supportedCurrencies.has(code) || code in CURRENCY_PRECISION
}

/** Decimal places for a supported currency: the Lumior table, else the browser default. */
export function currencyPrecision(code: string): number {
  return (
    CURRENCY_PRECISION[code] ??
    new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).resolvedOptions()
      .maximumFractionDigits ??
    2
  )
}
