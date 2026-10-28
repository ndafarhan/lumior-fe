import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, test, vi } from 'vitest'

import { toMoneyPayload, type MoneyValue } from '@/lib/money/format'
import type { ParseAmountResult } from '@/lib/money/parse'

import { Money } from './Money'
import { MoneyInput } from './MoneyInput'

describe('Money', () => {
  test('renders a formatted amount', () => {
    render(<Money value={{ amount: '12500.00', currency: 'IDR' }} />)
    expect(screen.getByText(/IDR\s12,500\.00/)).toBeInTheDocument()
  })

  test('renders a placeholder for a malformed amount without breaking the page', () => {
    render(
      <div>
        <Money value={{ amount: 'abc', currency: 'IDR' }} />
        <p>Rest of the page</p>
      </div>,
    )
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.getByText('Rest of the page')).toBeInTheDocument()
  })
})

function AmountForm({ onSubmit }: { onSubmit: (body: string) => void }) {
  const [text, setText] = useState('')
  const [result, setResult] = useState<ParseAmountResult>({ ok: false, error: 'Enter an amount.' })
  const [submitted, setSubmitted] = useState(false)

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        setSubmitted(true)
        if (!result.ok) return
        const payload: { price: MoneyValue } = { price: toMoneyPayload(result.value, 'IDR') }
        onSubmit(JSON.stringify(payload))
      }}
    >
      <MoneyInput
        label="Price"
        currency="IDR"
        value={text}
        showError={submitted}
        onChange={(nextText, nextResult) => {
          setText(nextText)
          setResult(nextResult)
        }}
      />
      <button type="submit">Save</button>
    </form>
  )
}

describe('MoneyInput', () => {
  test('shows the validation message after blur and marks the field invalid', async () => {
    const user = userEvent.setup()
    render(<AmountForm onSubmit={vi.fn()} />)
    const input = screen.getByLabelText(/Price/)

    await user.type(input, '12a')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await user.tab()

    expect(screen.getByRole('alert')).toHaveTextContent('Amount must be a number.')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Amount must be a number.')
  })

  test('does not submit invalid input and shows why', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<AmountForm onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText(/Price/), '10.555')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('At most 2 decimal places are allowed.')
  })

  test('submits the amount as a JSON string', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<AmountForm onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText(/Price/), '12,500')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSubmit).toHaveBeenCalledWith('{"price":{"amount":"12500","currency":"IDR"}}')
  })

  test('shows an error passed in from the backend', () => {
    render(
      <MoneyInput
        label="Price"
        currency="IDR"
        value="100"
        onChange={vi.fn()}
        error="Price must be positive."
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Price must be positive.')
  })
})
