import type { ApplyFlow } from './useApplyFlow'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'

export function LinkStep({ flow }: { flow: ApplyFlow }) {
  return (
    <form
      className="max-w-xl space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        flow.extract()
      }}
    >
      <p className="text-sm text-ink-muted">
        Paste a posting link to read its details. To apply to a job you already saved, use Apply on the job in Jobs or
        Tracker.
      </p>
      <Field label="Job posting link" hint="Greenhouse, Lever, Ashby, LinkedIn, Indeed and most company career pages.">
        <Input
          type="url"
          value={flow.link}
          onChange={(e) => flow.setLink(e.target.value)}
          placeholder="https://jobs.lever.co/…"
          autoFocus
        />
      </Field>
      <Button type="submit" variant="primary" disabled={!flow.link.trim() || flow.busy === 'extract'}>
        {flow.busy === 'extract' ? 'Reading posting…' : 'Read posting'}
      </Button>
    </form>
  )
}
