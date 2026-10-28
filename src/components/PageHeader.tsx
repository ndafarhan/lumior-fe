import type { ReactNode } from 'react'

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-6 grid gap-1">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {children && <p className="text-muted-foreground">{children}</p>}
    </div>
  )
}
