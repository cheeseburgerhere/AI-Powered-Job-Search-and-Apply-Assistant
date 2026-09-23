import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'

interface PageHeaderProps {
  title: string
  description?: ReactNode
  actions?: ReactNode
  className?: string
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <header className={cn('flex flex-wrap items-end justify-between gap-4 border-b border-rule pb-4', className)}>
      <div className="min-w-0">
        <h1 className="font-serif text-[28px] leading-tight font-medium tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  )
}

export function SectionHeading({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between border-b border-rule pb-1.5">
      <h2 className="text-xs font-medium uppercase tracking-wider text-ink-muted">{children}</h2>
      {aside && <div className="text-xs text-ink-faint">{aside}</div>}
    </div>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="py-12 text-center">
      <p className="font-serif text-lg text-ink">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-md text-sm text-ink-muted">{children}</div>}
    </div>
  )
}

type NoticeTone = 'info' | 'warn' | 'danger'

const noticeTones: Record<NoticeTone, string> = {
  info: 'border-accent bg-accent-soft',
  warn: 'border-warn bg-warn-soft',
  danger: 'border-danger bg-danger-soft',
}

/** Inline message with a left rule. Used for errors, agent hints and reminders. */
export function Notice({ tone = 'info', className, children }: { tone?: NoticeTone; className?: string; children: ReactNode }) {
  return (
    <div role={tone === 'danger' ? 'alert' : undefined} className={cn('border-l-2 px-3 py-2 text-sm text-ink', noticeTones[tone], className)}>
      {children}
    </div>
  )
}

interface DrawerProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}

/** Right-hand panel for secondary tasks (adding a job, editing details). */
export function Drawer({ open, title, onClose, children, footer }: DrawerProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-ink/20" onClick={onClose} aria-hidden />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex h-full w-full max-w-lg flex-col border-l border-rule-strong bg-paper"
      >
        <div className="flex items-center justify-between border-b border-rule px-5 py-3">
          <h2 className="font-serif text-xl text-ink">{title}</h2>
          <button type="button" onClick={onClose} className="text-ink-muted hover:text-ink" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-rule px-5 py-3">{footer}</div>}
      </aside>
    </div>
  )
}
