import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { statusLabel } from '../../lib/jobs'

type TagTone = 'neutral' | 'accent' | 'warn' | 'danger'

const tagTones: Record<TagTone, string> = {
  neutral: 'text-ink-muted',
  accent: 'text-accent',
  warn: 'text-warn',
  danger: 'text-danger',
}

/** Small-caps text label. No fill, no pill: the ledger marks things in ink. */
export function Tag({ tone = 'neutral', className, children }: { tone?: TagTone; className?: string; children: ReactNode }) {
  return (
    <span className={cn('text-[11px] font-medium uppercase tracking-wider', tagTones[tone], className)}>
      {children}
    </span>
  )
}

const priorityTone: Record<string, TagTone> = { top: 'danger', high: 'warn', medium: 'neutral', low: 'neutral' }

export function PriorityTag({ priority }: { priority: string }) {
  if (!priority) return null
  return <Tag tone={priorityTone[priority] ?? 'neutral'}>{priority}</Tag>
}

export function StatusMark({ status, className }: { status: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[13px] text-ink-muted', className)}>
      <span
        aria-hidden
        className="size-1.5 rounded-full"
        style={{ backgroundColor: `var(--color-status-${status}, var(--color-ink-faint))` }}
      />
      {statusLabel(status)}
    </span>
  )
}

/** Fit score out of 10: mono figure with a hairline meter underneath. */
export function Score({ value, className }: { value: number | null; className?: string }) {
  if (value === null || value === undefined) {
    return <span className={cn('font-mono text-sm text-ink-faint', className)}>—</span>
  }
  const pct = Math.max(0, Math.min(100, value * 10))
  return (
    <span className={cn('inline-flex w-9 flex-col gap-1', className)} title={`Fit ${value.toFixed(1)} / 10`}>
      <span className="font-mono text-sm font-medium text-ink tabular">{value.toFixed(1)}</span>
      <span className="h-px w-full bg-rule-strong">
        <span className="block h-px bg-ink" style={{ width: `${pct}%` }} />
      </span>
    </span>
  )
}
