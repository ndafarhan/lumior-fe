import { Check, Copy, UserPlus } from 'lucide-react'
import { useState } from 'react'

import { FormError } from '@/components/FormError'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { userMessageFor } from '@/lib/api/messages'

import { inviteLink } from './invite-link'
import { useCreateInvite } from './mutations'

const expiryFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' })

/** Owner-only: creates a single-use invite link and copies it. */
export function InviteMember({ householdId }: { householdId: string }) {
  const create = useCreateInvite(householdId)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState<string>()
  const link = create.data ? inviteLink(create.data.code) : null

  async function copy() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setCopyError(undefined)
    } catch {
      setCopyError('Copying failed. Select the link and copy it yourself.')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Invite a member</h2>
        </CardTitle>
        <CardDescription>
          Each link can be used once. Send it to the person you want to add.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {create.isError && <FormError message={userMessageFor(create.error)} />}
        {link && create.data && (
          <div className="grid gap-2">
            <Label htmlFor="invite-link">Invite link</Label>
            <div className="flex gap-2">
              <Input id="invite-link" readOnly value={link} onFocus={(e) => e.target.select()} />
              <Button type="button" variant="outline" onClick={() => void copy()}>
                {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                {copied ? 'Copied' : 'Copy link'}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Expires {expiryFormat.format(new Date(create.data.expires_at))}.
            </p>
            {copyError && <p className="text-sm text-destructive">{copyError}</p>}
          </div>
        )}
        <div>
          <Button
            type="button"
            variant={link ? 'outline' : 'default'}
            disabled={create.isPending}
            onClick={() => {
              setCopied(false)
              create.mutate()
            }}
          >
            <UserPlus aria-hidden="true" />
            {link ? 'Create another link' : 'Invite member'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
