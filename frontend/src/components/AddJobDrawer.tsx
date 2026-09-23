import { useState } from 'react'
import { useJobStore, type Job } from '../stores/jobStore'
import { useServerAi } from '../stores/metaStore'
import { errorDetail } from '../api/client'
import { Button } from './ui/Button'
import { Field, Input, Select, Textarea } from './ui/Field'
import { Drawer, Notice } from './ui/Layout'

const EMPTY = { title: '', company: '', location: '', url: '', remote_type: '', description: '' }

interface AddJobDrawerProps {
  open: boolean
  onClose: () => void
  onCreated: (job: Job) => void
}

export function AddJobDrawer({ open, onClose, onCreated }: AddJobDrawerProps) {
  const { createJob, scoreJob } = useJobStore()
  const serverAi = useServerAi()
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const valid = form.title.trim() && form.company.trim() && form.description.trim()
  const set = (key: keyof typeof EMPTY) => (value: string) => setForm((f) => ({ ...f, [key]: value }))

  const save = async (score: boolean) => {
    if (!valid) return
    setSaving(true)
    setError(null)
    try {
      const job = await createJob({
        title: form.title.trim(),
        company: form.company.trim(),
        description: form.description,
        location: form.location.trim() || undefined,
        url: form.url.trim() || undefined,
        remote_type: form.remote_type || undefined,
      })
      if (score) {
        try {
          await scoreJob(job.id)
        } catch {
          // Scoring is optional; the job is saved either way.
        }
      }
      setForm(EMPTY)
      onCreated(job)
    } catch (err) {
      setError(errorDetail(err, 'Could not save the job'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer
      open={open}
      title="Add a job"
      onClose={onClose}
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={serverAi ? 'secondary' : 'primary'} disabled={!valid || saving} onClick={() => save(false)}>
            Save
          </Button>
          {serverAi && (
            <Button variant="primary" disabled={!valid || saving} onClick={() => save(true)}>
              {saving ? 'Saving…' : 'Save and score'}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-ink-muted">
          For a posting you found yourself. It's saved as Interested.
        </p>
        <Field label="Title">
          <Input value={form.title} onChange={(e) => set('title')(e.target.value)} placeholder="Senior Software Engineer" />
        </Field>
        <Field label="Company">
          <Input value={form.company} onChange={(e) => set('company')(e.target.value)} placeholder="Acme Inc" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Location">
            <Input value={form.location} onChange={(e) => set('location')(e.target.value)} placeholder="Berlin" />
          </Field>
          <Field label="Work mode">
            <Select value={form.remote_type} onChange={(e) => set('remote_type')(e.target.value)}>
              <option value="">Not stated</option>
              <option value="remote">Remote</option>
              <option value="hybrid">Hybrid</option>
              <option value="onsite">On-site</option>
            </Select>
          </Field>
        </div>
        <Field label="Posting URL">
          <Input value={form.url} onChange={(e) => set('url')(e.target.value)} placeholder="https://…" />
        </Field>
        <Field label="Description">
          <Textarea
            value={form.description}
            onChange={(e) => set('description')(e.target.value)}
            rows={10}
            placeholder="Paste the full job description"
          />
        </Field>
        {error && <Notice tone="danger">{error}</Notice>}
      </div>
    </Drawer>
  )
}
