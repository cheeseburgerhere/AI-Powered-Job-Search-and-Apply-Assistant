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
