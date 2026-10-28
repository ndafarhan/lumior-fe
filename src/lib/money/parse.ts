import { currencyPrecision } from './currency'

export type ParseAmountResult = { ok: true; value: string } | { ok: false; error: string }

export type ParseAmountOptions = {
  /** Accept amounts below zero. Off by default. */
  allowNegative?: boolean
}

// Digits, optionally grouped in threes with commas, then an optional decimal part.
const AMOUNT_INPUT = /^(-?)(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?$/
const NUMBER_LIKE = /^-?[\d,]+(?:\.\d+)?$/

/**
 * Validates an amount typed by a user and normalizes it to a plain decimal string for the API,
 * for example `"12,500"` → `"12500"`. Never converts to a floating-point number.
 */
export function parseAmountInput(
  text: string,
  currency: string,
  { allowNegative = false }: ParseAmountOptions = {},
): ParseAmountResult {
  const input = text.trim()
  if (input === '') return { ok: false, error: 'Enter an amount.' }

  const match = AMOUNT_INPUT.exec(input)
  if (!match) {
    return NUMBER_LIKE.test(input)
      ? { ok: false, error: 'Use commas only between groups of three digits, for example 12,500.' }
      : { ok: false, error: 'Amount must be a number.' }
  }

  const [, sign = '', integerPart = '', fraction = ''] = match
  if (sign && !allowNegative) return { ok: false, error: 'Amount must not be negative.' }

  const precision = currencyPrecision(currency)
  if (fraction.length > precision) {
    return {
      ok: false,
      error:
        precision === 0
          ? 'Amount must be a whole number.'
          : `At most ${precision} decimal places are allowed.`,
    }
  }

  const integer = integerPart.replace(/,/g, '').replace(/^0+(?=\d)/, '')
  const isZero = /^0$/.test(integer) && /^0*$/.test(fraction)
  const value = `${sign && !isZero ? '-' : ''}${integer}${fraction ? `.${fraction}` : ''}`
  return { ok: true, value }
}
