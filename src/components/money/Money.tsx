import { formatMoney, type MoneyValue } from '@/lib/money/format'

/** Displays an API money value, for example `IDR 12,500.00`. Never parses it into a float. */
export function Money({ value, className }: { value: MoneyValue; className?: string }) {
  return <span className={className}>{formatMoney(value)}</span>
}
