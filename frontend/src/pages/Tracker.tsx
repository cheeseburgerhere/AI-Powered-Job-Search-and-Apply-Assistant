import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { useTrackerStore } from '../stores/trackerStore'
import { useJobStore, type Job } from '../stores/jobStore'
import { errorDetail } from '../api/client'
import { jobTitle, shortDate, statusLabel } from '../lib/jobs'
import { useLiveRefresh } from '../lib/useLiveRefresh'
import { cn } from '../lib/utils'
import { Notice, PageHeader, SectionHeading } from '../components/ui/Layout'

const COLUMNS = ['interested', 'applied', 'follow_up', 'interview', 'offer', 'rejected'] as const
type Column = (typeof COLUMNS)[number]

const FLOW: Column[] = ['interested', 'applied', 'follow_up', 'interview', 'offer']

const BIN_LABELS: Record<string, string> = {
  interested: 'Before applying',
  applied: 'After applying',
  follow_up: 'After following up',
  interview: 'After an interview',
  offer: 'At the offer stage',
  unknown: 'Stage not recorded',
}

export default function Tracker() {
  const { board, rejectedBins, fetchBoard, fetchRejectedBins } = useTrackerStore()
  const { updateJob } = useJobStore()
  const [dragged, setDragged] = useState<{ id: number; from: Column } | null>(null)
  const [dropTarget, setDropTarget] = useState<Column | null>(null)
  const [moving, setMoving] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    fetchBoard()
    fetchRejectedBins()
  }, [fetchBoard, fetchRejectedBins])
  useEffect(() => {
    refresh()
  }, [refresh])
  useLiveRefresh(refresh)

  const move = async (jobId: number, to: Column) => {
    setMoving(jobId)
    setError(null)
    try {
      await updateJob(jobId, { status: to })
      refresh()
    } catch (err) {
      setError(errorDetail(err, 'Could not move the job'))
    } finally {
      setMoving(null)
    }
  }

  const active = COLUMNS.filter((c) => c !== 'rejected').reduce((sum, c) => sum + (board[c]?.length ?? 0), 0)

  return (
    <div className="space-y-8">
      <PageHeader
        title="Tracker"
        description={`${active} active ${active === 1 ? 'application' : 'applications'}. Drag a job between columns, or use its links.`}
      />
      {error && <Notice tone="danger">{error}</Notice>}

      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <div className="grid min-w-[84rem] grid-cols-6 border-y border-rule xl:min-w-0">
          {COLUMNS.map((column) => {
            const jobs = (board[column] || []) as Job[]
            return (
              <section
                key={column}
                aria-label={statusLabel(column)}
                className={cn(
                  'min-h-64 border-rule not-first:border-l transition-colors',
                  dropTarget === column && dragged?.from !== column && 'bg-sunken',
                )}
                onDragOver={(e) => {
                  if (!dragged) return
                  e.preventDefault()
                  setDropTarget(column)
                }}
                onDragLeave={() => setDropTarget((t) => (t === column ? null : t))}
                onDrop={(e) => {
                  e.preventDefault()
                  if (dragged && dragged.from !== column) void move(dragged.id, column)
                  setDragged(null)
                  setDropTarget(null)
                }}
              >
                <header className="flex items-center justify-between border-b border-rule px-3 py-2">
                  <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-ink-muted">
                    <span
                      aria-hidden
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: `var(--color-status-${column})` }}
                    />
                    {statusLabel(column)}
                  </span>
                  <span className="font-mono text-xs text-ink-faint">{jobs.length}</span>
                </header>
                <ul>
                  {jobs.map((job) => (
                    <TrackerItem
                      key={job.id}
                      job={job}
                      column={column}
                      busy={moving === job.id}
                      onMove={move}
                      onDragStart={() => setDragged({ id: job.id, from: column })}
                      onDragEnd={() => {
                        setDragged(null)
                        setDropTarget(null)
                      }}
                    />
                  ))}
                </ul>
                {jobs.length === 0 && <p className="px-3 py-6 text-xs text-ink-faint">Empty</p>}
              </section>
            )
          })}
        </div>
      </div>

      <section className="space-y-2">
        <SectionHeading>Where rejections happened</SectionHeading>
        <table className="w-full text-sm">
          <tbody>
            {rejectedBins.map((bin) => (
              <tr key={bin.key} className="border-b border-rule align-top">
                <td className="w-56 py-2 pr-4 text-ink-muted">{BIN_LABELS[bin.key] ?? bin.label}</td>
                <td className="w-12 py-2 pr-4 font-mono text-ink tabular">{bin.count}</td>
                <td className="py-2 text-ink-muted">
                  {bin.jobs.length === 0
                    ? '—'
                    : bin.jobs.map((job, i) => (
                        <span key={job.id}>
                          {i > 0 && ', '}
                          <Link to={`/jobs?id=${job.id}`} className="text-ink hover:underline">
                            {jobTitle(job)}
                          </Link>{' '}
                          <span className="text-ink-faint">({job.company})</span>
                        </span>
                      ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

interface TrackerItemProps {
  job: Job
  column: Column
  busy: boolean
  onMove: (jobId: number, to: Column) => void
  onDragStart: () => void
  onDragEnd: () => void
}

function TrackerItem({ job, column, busy, onMove, onDragStart, onDragEnd }: TrackerItemProps) {
  const index = FLOW.indexOf(column)
  const next = index >= 0 && index < FLOW.length - 1 ? FLOW[index + 1] : null
  const dates = [
    job.date_applied && `Applied ${shortDate(job.date_applied)}`,
    (column === 'applied' || column === 'follow_up') && job.next_follow_up && `follow up ${shortDate(job.next_follow_up)}`,
  ].filter(Boolean)

  return (
    <li
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', String(job.id))
        e.dataTransfer.effectAllowed = 'move'
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      className={cn('cursor-grab border-b border-rule px-3 py-2.5 active:cursor-grabbing', busy && 'opacity-50')}
    >
      <div className="flex items-start justify-between gap-2">
        <Link to={`/jobs?id=${job.id}`} className="min-w-0 font-serif text-[15px] leading-snug text-ink hover:underline">
          {jobTitle(job)}
        </Link>
        {job.fit_score !== null && (
          <span className="shrink-0 font-mono text-xs text-ink-muted tabular">{job.fit_score.toFixed(1)}</span>
        )}
      </div>
      <div className="truncate text-xs text-ink-muted">{job.company}</div>
      {dates.length > 0 && <div className="mt-0.5 text-xs text-ink-faint">{dates.join(', ')}</div>}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {column === 'interested' && (
          <Link to={`/apply?jobId=${job.id}`} className="text-accent hover:underline">
            Apply
          </Link>
        )}
        {next && (
          <button type="button" disabled={busy} onClick={() => onMove(job.id, next)} className="text-ink hover:underline">
            → {statusLabel(next)}
          </button>
        )}
        {column !== 'rejected' && (
          <button type="button" disabled={busy} onClick={() => onMove(job.id, 'rejected')} className="text-danger hover:underline">
            Reject
          </button>
        )}
        {job.url && (
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open posting"
            className="ml-auto text-ink-faint hover:text-ink"
          >
            <ArrowUpRight size={13} />
          </a>
        )}
      </div>
    </li>
  )
}
