import { useId, type ComponentProps } from 'react'
import { cn } from 'cn'

import { Label } from '@/components/ui/label'

type SelectFieldProps = ComponentProps<'select'> & {
  label: string
  error?: string
  /** Visually hide the label (it is still announced), for example in a toolbar. */
  hideLabel?: boolean
}

/** A labelled native `<select>`, styled like `Input`, with its error wired up like `FormField`. */
export function SelectField({
  label,
  error,
  hideLabel = false,
  id,
  className,
  children,
  ...selectProps
}: SelectFieldProps) {
  const generatedId = useId()
  const selectId = id ?? generatedId
  const errorId = `${selectId}-error`

  return (
    <div className="grid gap-2">
      <Label htmlFor={selectId} className={hideLabel ? 'sr-only' : undefined}>
        {label}
      </Label>
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          'h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30',
          'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
          'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
          className,
        )}
        {...selectProps}
      >
        {children}
      </select>
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
