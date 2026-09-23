import { useCallback, useEffect, useMemo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useProfileStore } from '../stores/profileStore'
import { useTrackerStore, type TrackerEvent, type TrackerStats } from '../stores/trackerStore'
import { useJobStore, type Job } from '../stores/jobStore'
import { useCoverLetterStore, type CoverLetter } from '../stores/coverLetterStore'
import { JOB_STATUSES, isAnalysed, jobTitle, relativeTime, shortDate, statusLabel } from '../lib/jobs'
import { useLiveRefresh } from '../lib/useLiveRefresh'
import { AgentHint } from '../components/ui/AgentHint'
import { EmptyState, PageHeader, SectionHeading } from '../components/ui/Layout'
import { PriorityTag, Score, Tag } from '../components/ui/Marks'

const OPEN_STATUSES = new Set(['discovered', 'interested'])
const TOP_PRIORITIES = new Set(['top', 'high'])

export default function Today() {
  const { profile, fetchProfile } = useProfileStore()
  const { stats, activity, fetchStats, fetchActivity } = useTrackerStore()
  const { jobs, nudges, fetchJobs, fetchNudges } = useJobStore()
  const { allLetters, fetchAllLetters } = useCoverLetterStore()

  const refresh = useCallback(() => {
    fetchProfile()
    fetchStats()
    fetchNudges()
    fetchJobs()
    fetchActivity(30)
    fetchAllLetters()
  }, [fetchProfile, fetchStats, fetchNudges, fetchJobs, fetchActivity, fetchAllLetters])

  useEffect(() => {
    refresh()
  }, [refresh])
  useLiveRefresh(refresh, 20000)

  const jobsById = useMemo(() => new Map(jobs.map((job) => [job.id, job])), [jobs])

  // The newest version per job is the one that matters; older drafts are history.
  const draftsAwaiting = useMemo(() => {
    const latest = new Map<number, CoverLetter>()
    for (const letter of allLetters) {
      const current = latest.get(letter.job_id)
      if (!current || letter.version > current.version) latest.set(letter.job_id, letter)
    }
    return [...latest.values()].filter((letter) => letter.status === 'draft' && jobsById.has(letter.job_id))
  }, [allLetters, jobsById])

  const unanalysed = jobs.filter((job) => OPEN_STATUSES.has(job.status) && !isAnalysed(job))
  const topMatches = jobs
    .filter((job) => job.status === 'discovered' && isAnalysed(job) && TOP_PRIORITIES.has(job.priority))
    .sort((a, b) => (b.fit_score ?? 0) - (a.fit_score ?? 0))
    .slice(0, 5)

  const noProfile = profile !== null && !profile.full_name && !profile.needs_parsing
  const reviewCount =
    (profile?.needs_parsing ? 1 : 0) +
    (noProfile ? 1 : 0) +
    nudges.length +
    draftsAwaiting.length +
    (unanalysed.length > 0 ? 1 : 0) +
    topMatches.length

  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="space-y-8">
      <PageHeader
        title="Today"
        description={
          <>
            {today}
            {profile?.full_name && <> · {profile.full_name}</>}
          </>
        }
      />

      <PipelineLine stats={stats} />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className="space-y-1">
          <SectionHeading aside={reviewCount > 0 ? `${reviewCount} open` : undefined}>Needs you</SectionHeading>

          {reviewCount === 0 && (
            <EmptyState title="Nothing needs you right now">
              New jobs, analyses and letters from your agent will show up here.
            </EmptyState>
          )}

          {profile?.needs_parsing && (
            <ReviewItem kind="Profile" title="Your resume is uploaded but not parsed" to="/profile" action="Open profile">
              Job analysis and letters need a structured profile.
              <AgentHint className="mt-2" prompt="Parse my uploaded resume text and save it as my structured profile." />
            </ReviewItem>
          )}

          {noProfile && (
            <ReviewItem kind="Profile" title="Add your resume" to="/profile" action="Set up profile">
              Upload a PDF or paste the text so jobs can be matched against it.
            </ReviewItem>
          )}

          {nudges.map((job) => (
            <ReviewItem
              key={`nudge-${job.id}`}
              kind="Follow up"
              tone="warn"
              title={`${jobTitle(job)} · ${job.company}`}
              to={`/jobs?id=${job.id}`}
              action="Open job"
            >
              Applied {shortDate(job.date_applied)}
              {job.next_follow_up && <>, follow-up was due {relativeTime(job.next_follow_up)}</>}.
            </ReviewItem>
          ))}

          {draftsAwaiting.map((letter) => {
            const job = jobsById.get(letter.job_id)!
            return (
              <ReviewItem
                key={`letter-${letter.id}`}
                kind="Letter"
                title={`${jobTitle(job)} · ${job.company}`}
                to={`/letters?job_id=${job.id}`}
                action="Review letter"
              >
                Version {letter.version} is a draft, saved {relativeTime(letter.created_at)}
                {letter.feedback && <> · “{letter.feedback}”</>}
              </ReviewItem>
            )
          })}

          {topMatches.map((job) => (
            <ReviewItem
              key={`match-${job.id}`}
              kind="Decide"
              title={`${jobTitle(job)} · ${job.company}`}
              to={`/jobs?id=${job.id}`}
              action="Review"
              lead={<Score value={job.fit_score} />}
            >
              <PriorityTag priority={job.priority} /> match, still Discovered. Move it to Interested or reject it.
            </ReviewItem>
          ))}

          {unanalysed.length > 0 && (
            <ReviewItem
              kind="Analyse"
              title={`${unanalysed.length} saved ${unanalysed.length === 1 ? 'job has' : 'jobs have'} no fit score`}
              to="/jobs?analysis=none"
              action="See jobs"
            >
              <AgentHint
                className="mt-2"
                prompt="Analyse my saved jobs that have no fit score yet, record each result, and tell me which ones to prioritise."
              />
            </ReviewItem>
          )}
        </section>

        <section className="space-y-1">
          <SectionHeading>Recent activity</SectionHeading>
          <ActivityFeed events={activity} letters={allLetters} jobsById={jobsById} />
        </section>
      </div>
    </div>
  )
}

function PipelineLine({ stats }: { stats: TrackerStats }) {
  return (
    <div className="grid grid-cols-4 border-y border-rule sm:grid-cols-8">
      <PipelineCell label="All" value={stats.total} to="/jobs" />
      {JOB_STATUSES.map((s) => (
        <PipelineCell key={s.key} label={s.label} value={stats[s.key]} to={`/jobs?status=${s.key}`} status={s.key} />
      ))}
    </div>
  )
}

function PipelineCell({ label, value, to, status }: { label: string; value: number; to: string; status?: string }) {
  return (
    <Link to={to} className="group border-rule px-3 py-3 not-first:border-l hover:bg-surface max-sm:[&:nth-child(5)]:border-l-0 max-sm:[&:nth-child(n+5)]:border-t">
      <div className="flex items-center gap-1.5 text-xs text-ink-muted group-hover:text-ink">
        {status && (
          <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: `var(--color-status-${status})` }} />
        )}
        {label}
      </div>
      <div className={'mt-1 font-mono text-2xl tabular ' + (value === 0 ? 'text-ink-faint' : 'text-ink')}>{value}</div>
    </Link>
  )
}

interface ReviewItemProps {
  kind: string
  title: string
  to: string
  action: string
  tone?: 'neutral' | 'warn'
  lead?: ReactNode
  children?: ReactNode
}

function ReviewItem({ kind, title, to, action, tone = 'neutral', lead, children }: ReviewItemProps) {
  return (
    <article className="grid grid-cols-[1fr_auto] gap-x-4 border-b border-rule py-3 sm:grid-cols-[5.5rem_1fr_auto]">
      <div className="col-span-2 mb-1 sm:col-span-1 sm:mb-0 sm:pt-0.5">
        {lead ?? (
          <Tag tone={tone === 'warn' ? 'warn' : 'neutral'} className="block">
            {kind}
          </Tag>
        )}
      </div>
      <div className="min-w-0">
        <h3 className="font-serif text-[17px] leading-snug text-ink sm:truncate">{title}</h3>
        {children && <div className="mt-0.5 text-sm text-ink-muted">{children}</div>}
      </div>
      <Link to={to} className="pt-0.5 text-sm whitespace-nowrap text-accent hover:underline">
        {action}
      </Link>
    </article>
  )
}

type FeedEntry = { key: string; at: string; jobId: number; title: string; text: ReactNode }

function ActivityFeed({
  events,
  letters,
  jobsById,
}: {
  events: TrackerEvent[]
  letters: CoverLetter[]
  jobsById: Map<number, Job>
}) {
  const entries: FeedEntry[] = []

  for (const event of events) {
    if (!event.created_at) continue
    entries.push({
      key: `event-${event.id}`,
      at: event.created_at,
      jobId: event.job_id,
      title: event.job_title ? `${jobTitle({ title: event.job_title, url: null })} · ${event.job_company}` : `Job #${event.job_id}`,
      text: event.from_status
        ? `${statusLabel(event.from_status)} → ${statusLabel(event.to_status)}`
        : `Saved as ${statusLabel(event.to_status)}`,
    })
  }

  for (const letter of letters) {
    const job = jobsById.get(letter.job_id)
    if (!letter.created_at || !job) continue
    entries.push({
      key: `letter-${letter.id}`,
      at: letter.created_at,
      jobId: letter.job_id,
      title: `${jobTitle(job)} · ${job.company}`,
      text: `Letter v${letter.version} saved${letter.feedback ? ` · ${letter.feedback}` : ''}`,
    })
  }

  entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  const shown = entries.slice(0, 14)

  if (shown.length === 0) {
    return <p className="py-6 text-sm text-ink-faint">No activity yet.</p>
  }

  return (
    <ol>
      {shown.map((entry) => (
        <li key={entry.key} className="grid grid-cols-[4.5rem_1fr] gap-x-3 border-b border-rule py-2.5">
          <time dateTime={entry.at} className="pt-0.5 font-mono text-xs text-ink-faint" title={new Date(entry.at).toLocaleString()}>
            {relativeTime(entry.at)}
          </time>
          <div className="min-w-0">
            <Link to={`/jobs?id=${entry.jobId}`} className="block truncate text-sm text-ink hover:underline">
              {entry.title}
            </Link>
            <div className="truncate text-xs text-ink-muted">{entry.text}</div>
          </div>
        </li>
      ))}
    </ol>
  )
}
