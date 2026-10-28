import type { ConfigIssue } from '@/lib/config'

/** Shown instead of the app when build-time configuration is invalid. Makes no API calls. */
export function ConfigErrorScreen({ issues }: { issues: ConfigIssue[] }) {
  return (
    <main className="mx-auto max-w-xl p-10">
      <h1 className="text-xl font-semibold">Lumior is not configured correctly</h1>
      <p className="mt-2 text-muted-foreground">
        Fix the following settings in your environment (for example <code>.env.local</code>) and
        rebuild the app.
      </p>
      <ul className="mt-4 list-disc space-y-1 pl-6">
        {issues.map((issue) => (
          <li key={issue.setting}>
            <code className="font-semibold">{issue.setting}</code> {issue.message}
          </li>
        ))}
      </ul>
    </main>
  )
}
