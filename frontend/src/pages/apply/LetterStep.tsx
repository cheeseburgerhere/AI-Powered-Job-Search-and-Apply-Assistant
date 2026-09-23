import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { ApplyFlow } from './useApplyFlow'
import { useServerAi } from '../../stores/metaStore'
import { useProfileStore } from '../../stores/profileStore'
import { useLiveRefresh } from '../../lib/useLiveRefresh'
import { cn } from '../../lib/utils'
import { AgentHint } from '../../components/ui/AgentHint'
import { Button } from '../../components/ui/Button'
import { Textarea } from '../../components/ui/Field'
import { Notice, SectionHeading } from '../../components/ui/Layout'

const SOURCE_LABEL: Record<string, string> = { agent: 'Agent', server: 'Server AI', manual: 'You' }

export function LetterStep({ flow }: { flow: ApplyFlow }) {
  const serverAi = useServerAi()
  const profile = useProfileStore((s) => s.profile)
  const [draft, setDraft] = useState<string | null>(null)
  const [note, setNote] = useState('')

  // Without server AI the agent writes the draft; pick it up as soon as it is saved.
  useLiveRefresh(() => {
    if (!serverAi && flow.jobId && draft === null) flow.refreshVersions()
  }, 8000)

  const editing = draft !== null
  const agentCanDraft = !serverAi && flow.jobId !== null

  return (
    <div className="space-y-5">
      {profile && !profile.full_name && (
        <Notice tone="warn">
          Your profile isn't parsed yet, so letters can't draw on your experience.{' '}
          <Link to="/profile" className="underline">
            Open profile
          </Link>
        </Notice>
      )}

      {!flow.hasLetter && !editing && (
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">No letter yet for {flow.details?.company}.</p>

          {serverAi && (
            <Button variant="primary" onClick={flow.generate} disabled={flow.busy === 'generate'}>
              {flow.busy === 'generate' ? 'Writing a first draft…' : 'Generate with server AI'}
            </Button>
          )}

          {!serverAi && !flow.jobId && (
            <div className="space-y-2">
              <p className="text-sm text-ink">
                Your agent drafts letters for saved jobs. Save this one, then ask it to write the letter.
              </p>
              <Button variant="primary" onClick={flow.saveInterested} disabled={flow.busy === 'save'}>
                {flow.busy === 'save' ? 'Saving…' : 'Save as Interested'}
              </Button>
            </div>
          )}

          {agentCanDraft && (
            <div className="space-y-2">
              <AgentHint
                prompt={`Draft a cover letter for job #${flow.jobId}: read the application context, use only facts from my profile, and save it as a draft.`}
              />
              <p className="text-xs text-ink-faint">This page picks up the draft as soon as the agent saves it.</p>
            </div>
          )}

          <Button variant="quiet" onClick={() => setDraft('')}>
            Write it yourself
          </Button>
        </div>
      )}

      {flow.versions.length > 0 && (
        <nav aria-label="Versions" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {flow.versions.map((v) => (
            <button
              key={v.id}
              type="button"
              disabled={editing}
              onClick={() => flow.selectVersion(v.id)}
              className={cn(
                'border-b-2 pb-1 transition-colors disabled:cursor-not-allowed',
                v.id === flow.selected?.id ? 'border-ink text-ink' : 'border-transparent text-ink-muted hover:text-ink',
              )}
            >
              v{v.version}
              {SOURCE_LABEL[v.source] && <span className="ml-1 text-ink-faint">· {SOURCE_LABEL[v.source]}</span>}
            </button>
          ))}
        </nav>
      )}

      {editing ? (
        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={20}
            aria-label="Letter text"
            placeholder="Dear hiring team,"
            className="max-w-[68ch] font-serif text-[16px] leading-[1.7]"
          />
          <div className="flex gap-2">
            <Button
              variant="primary"
              disabled={!draft?.trim() || flow.busy === 'manual'}
              onClick={async () => {
                if (await flow.saveManual(draft ?? '')) setDraft(null)
              }}
            >
              {flow.busy === 'manual' ? 'Saving…' : flow.selected ? 'Save as new version' : 'Use this letter'}
            </Button>
            <Button variant="quiet" onClick={() => setDraft(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        flow.hasLetter && (
          <>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setDraft(flow.currentLetter)}>Edit</Button>
              {serverAi && (
                <Button variant="quiet" onClick={flow.generate} disabled={flow.busy === 'generate'}>
                  {flow.busy === 'generate' ? 'Writing…' : 'Regenerate'}
                </Button>
              )}
            </div>
            <article className="max-w-[68ch] border-l border-rule pl-6 font-serif text-[16px] leading-[1.7] whitespace-pre-wrap text-ink">
              {flow.currentLetter}
            </article>

            <section className="max-w-[68ch] space-y-2 pt-2">
              <SectionHeading>Revise</SectionHeading>
              {serverAi ? (
                <>
                  <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    placeholder="Shorter, lead with the Python work, more formal…"
                  />
                  <Button
                    disabled={!note.trim() || flow.busy === 'refine'}
                    onClick={async () => {
                      if (await flow.refine(note)) setNote('')
                    }}
                  >
                    {flow.busy === 'refine' ? 'Revising…' : 'Refine with server AI'}
                  </Button>
                </>
              ) : flow.jobId && flow.selected ? (
                <AgentHint
                  prompt={`Revise cover letter v${flow.selected.version} for job #${flow.jobId}: <your notes>. Keep every claim backed by my profile and save it as a new draft.`}
                />
              ) : (
                <p className="text-sm text-ink-faint">Edit the text directly, or save the job so your agent can revise it.</p>
              )}
            </section>
          </>
        )
      )}

      <div className="flex flex-wrap gap-2 border-t border-rule pt-4">
        <Button variant="primary" disabled={editing} onClick={() => flow.setStep('documents')}>
          {flow.hasLetter ? 'Continue to documents' : 'Continue without a letter'}
        </Button>
        <Button variant="quiet" disabled={editing} onClick={() => flow.setStep('details')}>
          Back to details
        </Button>
      </div>
    </div>
  )
}
