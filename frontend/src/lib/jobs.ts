import type { FitAnalysis, Job } from '../stores/jobStore'

/** Workflow statuses in pipeline order; mirrors ALLOWED_JOB_STATUSES in the backend. */
export const JOB_STATUSES = [
  { key: 'discovered', label: 'Discovered' },
  { key: 'interested', label: 'Interested' },
  { key: 'applied', label: 'Applied' },
  { key: 'follow_up', label: 'Follow up' },
  { key: 'interview', label: 'Interview' },
  { key: 'offer', label: 'Offer' },
  { key: 'rejected', label: 'Rejected' },
] as const

export type JobStatus = (typeof JOB_STATUSES)[number]['key']

export const PRIORITIES = ['top', 'high', 'medium', 'low'] as const

export function statusLabel(status: string): string {
  return JOB_STATUSES.find((s) => s.key === status)?.label ?? status
}

const RELATIVE = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto', style: 'short' })

/** "2h ago", "yesterday", "3 wk. ago" — compact enough for list rows. */
export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ]
  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size) return RELATIVE.format(Math.round(seconds / size), unit)
  }
  return 'just now'
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

/** Strip HTML tags and entities that scraped descriptions carry, collapsing whitespace. */
export function plainText(value: string | null | undefined): string {
  return (value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Like plainText but keeps paragraph breaks, for reading a full description. */
export function readableText(value: string | null | undefined): string {
  return (value || '')
    .replace(/<\s*(br|\/p|\/li|\/h\d)\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*(\n\s*)+/g, '\n\n')
    .trim()
}

/** Scraped titles are sometimes "embed" or empty; fall back to the URL slug. */
export function jobTitle(job: Pick<Job, 'title' | 'url'>): string {
  const raw = plainText(job.title)
  if (raw && raw.toLowerCase() !== 'embed') return raw
  if (job.url) {
    try {
      const parts = new URL(job.url).pathname.split('/').filter(Boolean)
      const slug = parts.at(-1) || parts.at(-2)
      if (slug && slug.length > 2) {
        return slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
      }
    } catch {
      // Invalid URL: use the generic title below.
    }
  }
  return 'Untitled position'
}

export function remoteLabel(remoteType: string): string {
  if (!remoteType) return ''
  if (remoteType === 'onsite') return 'On-site'
  return remoteType.charAt(0).toUpperCase() + remoteType.slice(1)
}

const compactMoney = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 0 })

export function salaryLabel(job: Pick<Job, 'salary_min' | 'salary_max'>): string {
  const { salary_min: min, salary_max: max } = job
  if (min == null && max == null) return ''
  if (min != null && max != null) return `$${compactMoney.format(min)}–${compactMoney.format(max)}`
  if (min != null) return `from $${compactMoney.format(min)}`
  return `up to $${compactMoney.format(max!)}`
}

/**
 * Structured analysis for a job. Newer rows carry `fit_analysis`; older ones only have the
 * "Match reasons: …\nGaps: …\nsummary" text, which is parsed as a best effort.
 */
export function fitAnalysis(job: Pick<Job, 'fit_analysis' | 'fit_reasoning'>): FitAnalysis | null {
  if (job.fit_analysis) return job.fit_analysis
  const text = (job.fit_reasoning || '').trim()
  if (!text) return null
  // Items were joined with ", ", but items also contain commas. Only split where the next
  // item starts like a new sentence, so "a, b, or c" inside one item stays whole.
  const split = (line: string | undefined) =>
    (line || '')
      .split(/,\s+(?=[A-Z0-9"“(])/)
      .map((part) => part.trim())
      .filter(Boolean)
  const lines = text.split('\n')
  const reasonsLine = lines.find((line) => line.startsWith('Match reasons:'))
  const gapsLine = lines.find((line) => line.startsWith('Gaps:'))
  const summary = lines
    .filter((line) => line !== reasonsLine && line !== gapsLine)
    .join('\n')
    .trim()
  return {
    reasons: split(reasonsLine?.slice('Match reasons:'.length)),
    gaps: split(gapsLine?.slice('Gaps:'.length)),
    summary,
  }
}

export function isAnalysed(job: Pick<Job, 'fit_score'>): boolean {
  return job.fit_score !== null && job.fit_score !== undefined
}
