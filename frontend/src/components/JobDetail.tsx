import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { useJobStore, type Job } from '../stores/jobStore'
import { useServerAi } from '../stores/metaStore'
import { errorDetail } from '../api/client'
import {
  JOB_STATUSES,
  fitAnalysis,
  isAnalysed,
  jobTitle,
  readableText,
  remoteLabel,
  salaryLabel,
  shortDate,
} from '../lib/jobs'
import { Button } from './ui/Button'
import { Select, Textarea } from './ui/Field'
import { AgentHint } from './ui/AgentHint'
import { Notice, SectionHeading } from './ui/Layout'
import { PriorityTag, Tag } from './ui/Marks'
import { buttonClass } from './ui/styles'

interface JobDetailProps {
  job: Job
  onDeleted: () => void
}

export function JobDetail({ job, onDeleted }: JobDetailProps) {
  const { updateJob, deleteJob, scoreJob } = useJobStore()
  const serverAi = useServerAi()
  const [notes, setNotes] = useState(job.notes || '')
  const [busy, setBusy] = useState<'status' | 'notes' | 'score' | 'delete' | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  const run = async (kind: NonNullable<typeof busy>, action: () => Promise<void>) => {
    setBusy(kind)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(errorDetail(err, 'Something went wrong'))
    } finally {
      setBusy(null)
    }
  }

  const analysis = fitAnalysis(job)
  const description = readableText(job.description)
  const longDescription = description.length > 1400
  const place = [job.company, job.location, remoteLabel(job.remote_type), salaryLabel(job)].filter(Boolean)
  const dates = [
    job.date_saved && `Saved ${shortDate(job.date_saved)}`,
    job.date_applied && `Applied ${shortDate(job.date_applied)}`,
    job.next_follow_up && `Follow up ${shortDate(job.next_follow_up)}`,
  ].filter(Boolean)

  return (
    <article className="space-y-6">
      <header className="space-y-3">
        <div className="flex items-center justify-between gap-3 text-xs text-ink-faint">
          <span className="font-mono">
            #{job.id} · {job.source}
          </span>
          <span>{dates.join(' · ')}</span>
        </div>
        <h2 className="font-serif text-[26px] leading-tight text-ink">{jobTitle(job)}</h2>
        <p className="text-sm text-ink-muted">{place.join(' · ')}</p>
        {job.link_type === 'expired' && <Notice tone="danger">This posting looks expired.</Notice>}
        {job.link_type === 'board' && (
          <Notice tone="warn">This link points to a job board page, not a single posting.</Notice>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Select
            aria-label="Status"
            value={job.status}
            disabled={busy === 'status'}
            onChange={(e) => run('status', () => updateJob(job.id, { status: e.target.value }))}
            className="w-auto py-1"
          >
            {JOB_STATUSES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </Select>
          <Link to={`/apply?jobId=${job.id}`} className={buttonClass('primary')}>
            Apply
          </Link>
          <Link to={`/letters?job_id=${job.id}`} className={buttonClass('secondary')}>
            Letters
          </Link>
          {job.url && (
            <a href={job.url} target="_blank" rel="noopener noreferrer" className={buttonClass('quiet')}>
              Posting <ArrowUpRight size={14} />
            </a>
          )}
          <span className="flex-1" />
          {confirmDelete ? (
            <>
              <Button variant="quiet" size="sm" onClick={() => setConfirmDelete(false)}>
                Keep
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={busy === 'delete'}
                onClick={() =>
                  run('delete', async () => {
                    await deleteJob(job.id)
                    onDeleted()
                  })
                }
              >
                Delete job and its letters
              </Button>
            </>
          ) : (
            <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          )}
        </div>
        {error && <Notice tone="danger">{error}</Notice>}
      </header>

      <section className="space-y-3">
        <SectionHeading
          aside={
            serverAi && (
              <Button
                variant="quiet"
                size="sm"
                disabled={busy === 'score'}
                onClick={() => run('score', () => scoreJob(job.id))}
              >
                {busy === 'score' ? 'Scoring…' : isAnalysed(job) ? 'Re-score with server AI' : 'Score with server AI'}
              </Button>
            )
          }
        >
          Analysis
        </SectionHeading>

        {isAnalysed(job) ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
              <span className="font-mono text-3xl text-ink tabular">
                {job.fit_score!.toFixed(1)}
                <span className="text-base text-ink-faint">/10</span>
              </span>
              {job.category && <Tag>{job.category}</Tag>}
              <PriorityTag priority={job.priority} />
            </div>
            {analysis?.summary && <p className="text-sm leading-relaxed text-ink">{analysis.summary}</p>}
            {analysis && (analysis.reasons.length > 0 || analysis.gaps.length > 0) && (
              <div className="grid gap-5 sm:grid-cols-2">
                <EvidenceList title="Matches" marker="+" items={analysis.reasons} />
                <EvidenceList title="Gaps" marker="–" items={analysis.gaps} />
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-ink-muted">Not analysed yet.</p>
            <AgentHint prompt={`Analyse job #${job.id} against my profile and record the fit score, category and priority.`} />
          </div>
        )}
      </section>

      <section className="space-y-2">
        <SectionHeading
          aside={
            notes !== (job.notes || '') && (
              <Button
                variant="quiet"
                size="sm"
                disabled={busy === 'notes'}
                onClick={() => run('notes', () => updateJob(job.id, { notes }))}
              >
                {busy === 'notes' ? 'Saving…' : 'Save notes'}
              </Button>
            )
          }
        >
          Notes
        </SectionHeading>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Contacts, referral, anything to remember…"
          className="border-rule bg-transparent"
        />
      </section>

      <section className="space-y-2">
        <SectionHeading>Description</SectionHeading>
        {description ? (
          <>
            <div
              className={
                'text-sm leading-relaxed whitespace-pre-line text-ink ' +
                (longDescription && !expanded ? 'max-h-80 overflow-hidden [mask-image:linear-gradient(to_bottom,black_75%,transparent)]' : '')
              }
            >
              {description}
            </div>
            {longDescription && (
              <Button variant="quiet" size="sm" onClick={() => setExpanded((v) => !v)}>
                {expanded ? 'Show less' : 'Show full description'}
              </Button>
            )}
          </>
        ) : (
          <p className="text-sm text-ink-faint">No description saved.</p>
        )}
      </section>
    </article>
  )
}

function EvidenceList({ title, marker, items }: { title: string; marker: string; items: string[] }) {
  return (
    <div>
      <div className="mb-1.5 text-xs text-ink-faint">{title}</div>
      {items.length === 0 ? (
        <p className="text-sm text-ink-faint">None noted.</p>
      ) : (
        <ul className="space-y-1">
          {items.map((item, index) => (
            <li key={index} className="grid grid-cols-[1rem_1fr] text-sm text-ink">
              <span className="font-mono text-ink-faint">{marker}</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
