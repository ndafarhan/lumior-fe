import { useId, useState, type ComponentProps } from 'react'

import { Input } from '@/components/ui/input'
import { parseAmountInput, type ParseAmountResult } from '@/lib/money/parse'

type MoneyInputProps = Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'type' | 'id'> & {
  label: string
  currency: string
  /** The text as typed. Keep it in form state and read the parsed value from `onChange`. */
  value: string
  onChange: (text: string, result: ParseAmountResult) => void
  allowNegative?: boolean
  /** Show the validation message before the field is blurred, for example after a submit. */
  showError?: boolean
  /** An error from elsewhere, such as a backend validation detail for this field. */
  error?: string
}

/** Amount field that validates with `parseAmountInput` and reports the normalized string. */
export function MoneyInput({
  label,
  currency,
  value,
  onChange,
  allowNegative = false,
  showError = false,
  error,
  onBlur,
  ...inputProps
}: MoneyInputProps) {
  const id = useId()
  const errorId = `${id}-error`
  const [touched, setTouched] = useState(false)

  const result = parseAmountInput(value, currency, { allowNegative })
  const message = error ?? (!result.ok && (touched || showError) ? result.error : undefined)

  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label} <span className="text-muted-foreground">({currency})</span>
      </label>
      <Input
        {...inputProps}
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        aria-invalid={message ? true : undefined}
        aria-describedby={message ? errorId : undefined}
        onChange={(event) =>
          onChange(
            event.target.value,
            parseAmountInput(event.target.value, currency, { allowNegative }),
          )
        }
        onBlur={(event) => {
          setTouched(true)
          onBlur?.(event)
        }}
      />
      {message && (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {message}
        </p>
      )}
    </div>
  )
}
