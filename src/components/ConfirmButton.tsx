import type { ReactNode } from 'react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

type ConfirmButtonProps = {
  /** The button that opens the confirmation. */
  children: ReactNode
  /** Accessible name of the trigger when its text alone is ambiguous, e.g. "Remove Budi". */
  triggerLabel?: string
  title: string
  description: ReactNode
  confirmLabel: string
  onConfirm: () => void
  disabled?: boolean
}

/** A destructive action that asks for confirmation first. */
export function ConfirmButton({
  children,
  triggerLabel,
  title,
  description,
  confirmLabel,
  onConfirm,
  disabled,
}: ConfirmButtonProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" aria-label={triggerLabel} disabled={disabled}>
          {children}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
