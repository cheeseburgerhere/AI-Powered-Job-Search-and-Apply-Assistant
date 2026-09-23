import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'
import { inputClass, labelClass } from './styles'

interface FieldProps {
  label: string
  hint?: ReactNode
  className?: string
  children: ReactNode
}

export function Field({ label, hint, className, children }: FieldProps) {
  return (
    <label className={cn('block space-y-1.5', className)}>
      <span className={labelClass}>{label}</span>
      {children}
      {hint && <span className="block text-xs text-ink-faint">{hint}</span>}
    </label>
  )
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputClass, className)} {...rest} />
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputClass, 'leading-relaxed', className)} {...rest} />
}

export function Select({ className, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(inputClass, 'pr-7', className)} {...rest} />
}
