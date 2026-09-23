import { cn } from '../../lib/utils'

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger'
export type ButtonSize = 'sm' | 'md'

const base =
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-sm font-medium transition-colors ' +
  'disabled:cursor-not-allowed disabled:opacity-50'

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-ink hover:opacity-90',
  secondary: 'border border-rule-strong bg-surface text-ink hover:bg-sunken',
  quiet: 'text-ink-muted hover:bg-sunken hover:text-ink',
  danger: 'text-danger hover:bg-danger-soft',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'h-7 px-2 text-[13px]',
  md: 'h-8 px-3 text-sm',
}

/** Button look for elements that aren't <button>, e.g. router links. */
export function buttonClass(variant: ButtonVariant = 'secondary', size: ButtonSize = 'md', className?: string) {
  return cn(base, variants[variant], sizes[size], className)
}

export const inputClass =
  'w-full rounded-sm border border-rule-strong bg-surface px-2.5 py-1.5 text-sm text-ink ' +
  'placeholder:text-ink-faint focus:border-accent focus:outline-none disabled:opacity-60'

export const labelClass = 'block text-xs font-medium uppercase tracking-wider text-ink-muted'
