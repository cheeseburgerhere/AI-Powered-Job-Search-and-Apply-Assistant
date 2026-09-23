import type { Job } from '../stores/jobStore'
import { jobTitle, relativeTime, remoteLabel, salaryLabel } from '../lib/jobs'
import { cn } from '../lib/utils'
import { PriorityTag, Score, StatusMark, Tag } from './ui/Marks'

interface JobRowProps {
  job: Job
  selected?: boolean
  onSelect?: (job: Job) => void
  showStatus?: boolean
}

/** One ledger line: score, role, company line, and a quiet meta line. */
export function JobRow({ job, selected, onSelect, showStatus = true }: JobRowProps) {
  const place = [job.company, job.location, remoteLabel(job.remote_type), salaryLabel(job)].filter(Boolean)
  const meta = [job.category, job.source, relativeTime(job.updated_at || job.date_saved)].filter(Boolean)

  return (
    <button
      type="button"
      onClick={() => onSelect?.(job)}
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'grid w-full grid-cols-[2.75rem_1fr_auto] gap-x-3 border-b border-rule px-2 py-3 text-left transition-colors',
        selected ? 'bg-sunken' : 'hover:bg-surface',
      )}
    >
      <Score value={job.fit_score} className="pt-0.5" />
      <div className="min-w-0">
        <div className="truncate font-serif text-[17px] leading-snug text-ink">{jobTitle(job)}</div>
        <div className="truncate text-[13px] text-ink-muted">{place.join(' · ')}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-faint">
          <span>{meta.join(' · ')}</span>
          {job.link_type === 'expired' && <Tag tone="danger">Expired</Tag>}
          {job.link_type === 'board' && <Tag tone="warn">Board page</Tag>}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 pt-0.5">
        <PriorityTag priority={job.priority} />
        {showStatus && <StatusMark status={job.status} />}
      </div>
    </button>
  )
}
