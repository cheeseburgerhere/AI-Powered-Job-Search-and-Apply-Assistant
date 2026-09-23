import { useState } from 'react'
import { cn } from '../../lib/utils'

interface AgentHintProps {
  /** What the agent can do here, in one short sentence. */
  label?: string
  /** Prompt the user can paste into Claude Code / Codex. */
  prompt: string
  className?: string
}

/** A copyable prompt for the MCP-connected agent, shown where the UI can't do the work itself. */
export function AgentHint({ label = 'Ask your agent', prompt, className }: AgentHintProps) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard can be blocked; the prompt is still selectable on screen.
    }
  }

  return (
    <div className={cn('border border-dashed border-rule-strong px-3 py-2.5', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-wider text-ink-muted">{label}</span>
        <button type="button" onClick={copy} className="text-xs text-accent hover:underline">
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className="mt-1 font-mono text-[13px] leading-relaxed text-ink select-all">{prompt}</p>
    </div>
  )
}
