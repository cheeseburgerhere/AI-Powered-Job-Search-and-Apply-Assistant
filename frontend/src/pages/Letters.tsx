import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useCoverLetterStore, type CoverLetter } from '../stores/coverLetterStore'
import { useJobStore, type Job } from '../stores/jobStore'
import { useServerAi } from '../stores/metaStore'
import { errorDetail } from '../api/client'
import { jobTitle, relativeTime } from '../lib/jobs'
import { downloadFile } from '../lib/download'
import { useLiveRefresh } from '../lib/useLiveRefresh'
import { cn } from '../lib/utils'
import { AgentHint } from '../components/ui/AgentHint'
import { Button } from '../components/ui/Button'
import { Field, Select, Textarea } from '../components/ui/Field'
import { EmptyState, Notice, PageHeader, SectionHeading } from '../components/ui/Layout'
import { Tag } from '../components/ui/Marks'
import { buttonClass } from '../components/ui/styles'

const SOURCE_LABEL: Record<string, string> = { agent: 'Agent', server: 'Server AI', manual: 'You' }
const WRITTEN_BY: Record<string, string> = {
  agent: 'Written by your agent',
  server: 'Written by server AI',
  manual: 'Written by you',
}

function byVersionDesc(a: CoverLetter, b: CoverLetter) {
  return b.version - a.version
}

export default function Letters() {
  const { jobs, fetchJobs } = useJobStore()
  const { allLetters, fetchAllLetters } = useCoverLetterStore()
  const [params, setParams] = useSearchParams()
  const selectedJobId = Number(params.get('job_id')) || null

  const refresh = useCallback(() => {
    fetchJobs()
    fetchAllLetters()
  }, [fetchJobs, fetchAllLetters])
  useEffect(() => {
    refresh()
  }, [refresh])
  useLiveRefresh(refresh)

  const jobsById = useMemo(() => new Map(jobs.map((job) => [job.id, job])), [jobs])

  // One row per job that has letters, newest activity first, carrying its latest version.
  const threads = useMemo(() => {
    const latest = new Map<number, CoverLetter>()
    for (const letter of allLetters) {
      const current = latest.get(letter.job_id)
      if (!current || letter.version > current.version) latest.set(letter.job_id, letter)
    }
    return [...latest.values()]
      .filter((letter) => jobsById.has(letter.job_id))
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
  }, [allLetters, jobsById])

  const jobsWithoutLetters = jobs.filter((job) => !threads.some((t) => t.job_id === job.id))
  const selectedJob = selectedJobId ? jobsById.get(selectedJobId) ?? null : null
  const selectJob = (id: number | null) => setParams(id ? { job_id: String(id) } : {}, { replace: true })

  return (
    <div className="space-y-6">
      <PageHeader title="Letters" description="Review, edit and approve cover letters. Every save keeps the earlier versions." />

      <div className="grid gap-8 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className={cn('space-y-5', selectedJob && 'hidden lg:block')}>
          <section>
            <SectionHeading aside={threads.length || undefined}>With letters</SectionHeading>
            {threads.length === 0 ? (
              <p className="py-4 text-sm text-ink-faint">No letters yet.</p>
            ) : (
              <ul>
                {threads.map((letter) => {
                  const job = jobsById.get(letter.job_id)!
                  const active = job.id === selectedJobId
                  return (
                    <li key={job.id}>
                      <button
                        type="button"
                        onClick={() => selectJob(job.id)}
                        aria-current={active ? 'true' : undefined}
                        className={cn(
                          'w-full border-b border-rule px-2 py-2.5 text-left transition-colors',
                          active ? 'bg-sunken' : 'hover:bg-surface',
                        )}
                      >
                        <div className="truncate font-serif text-[15px] text-ink">{jobTitle(job)}</div>
                        <div className="flex items-center justify-between gap-2 text-xs text-ink-muted">
                          <span className="truncate">{job.company}</span>
                          <span className="shrink-0">
                            v{letter.version} · {letter.status === 'ready' ? 'Approved' : 'Draft'}
                          </span>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {jobsWithoutLetters.length > 0 && (
            <Field label="Start a letter for">
              <Select value="" onChange={(e) => e.target.value && selectJob(Number(e.target.value))}>
                <option value="">Choose a saved job…</option>
                {jobsWithoutLetters.map((job) => (
                  <option key={job.id} value={job.id}>
                    {jobTitle(job)} · {job.company}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </aside>

        <section className={cn('min-w-0', !selectedJob && 'hidden lg:block')}>
          {selectedJob ? (
            <>
              <Button variant="quiet" size="sm" className="mb-3 -ml-2 lg:hidden" onClick={() => selectJob(null)}>
                <ArrowLeft size={14} /> All letters
              </Button>
              <LetterWorkspace key={selectedJob.id} job={selectedJob} onChanged={fetchAllLetters} />
            </>
          ) : (
            <EmptyState title="Pick a job">
              Choose a job on the left to read its letters, or start one for a saved job.
            </EmptyState>
          )}
        </section>
      </div>
    </div>
  )
}

function LetterWorkspace({ job, onChanged }: { job: Job; onChanged: () => void }) {
  const serverAi = useServerAi()
  const { letters, loading, error, fetchLetters, generate, refine, updateContent, updateStatus, createManualVersion } =
    useCoverLetterStore()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [draft, setDraft] = useState<string | null>(null)
  const [refineNote, setRefineNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const refresh = useCallback(() => fetchLetters(job.id), [fetchLetters, job.id])
  useEffect(() => {
    refresh()
  }, [refresh])
  useLiveRefresh(refresh)

  const versions = letters.filter((l) => l.job_id === job.id).sort(byVersionDesc)
  const latest = versions[0] ?? null
  const current = versions.find((l) => l.id === selectedId) ?? latest
  const editing = draft !== null

  // Your own latest draft is updated in place; anything else becomes a new manual version,
  // so an agent or server-AI draft is never overwritten.
  const editsInPlace = current !== null && current.id === latest?.id && current.source === 'manual' && current.status === 'draft'

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true)
    setActionError(null)
    try {
      await action()
      onChanged()
    } catch (err) {
      setActionError(errorDetail(err, 'Something went wrong'))
    } finally {
      setBusy(false)
    }
  }

  const save = () =>
    run(async () => {
      if (!current || draft === null || !draft.trim()) return
      if (editsInPlace) {
        await updateContent(current.id, draft)
      } else {
        const created = await createManualVersion(current.id, draft)
        setSelectedId(created.id)
      }
      setDraft(null)
    })

  const copy = async () => {
    if (!current) return
    try {
      await navigator.clipboard.writeText(current.content)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setActionError('Clipboard is blocked; select the text instead.')
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-rule pb-3">
        <div className="min-w-0">
          <h2 className="font-serif text-2xl leading-tight text-ink">{jobTitle(job)}</h2>
          <p className="text-sm text-ink-muted">
            {job.company}
            {job.location && ` · ${job.location}`}
          </p>
        </div>
        <Link to={`/jobs?id=${job.id}`} className={buttonClass('quiet', 'sm')}>
          Open job
        </Link>
      </header>

      {(error || actionError) && <Notice tone="danger">{actionError || error}</Notice>}

      {!current ? (
        <div className="space-y-4 py-4">
          <p className="text-sm text-ink-muted">No letter for this job yet.</p>
          <AgentHint
            prompt={`Draft a cover letter for job #${job.id}: read the application context, use only facts from my profile, and save it as a draft.`}
          />
          {serverAi && (
            <Button variant="primary" disabled={loading || busy} onClick={() => run(() => generate(job.id))}>
              {loading ? 'Generating…' : 'Generate with server AI'}
            </Button>
          )}
        </div>
      ) : (
        <>
          <nav aria-label="Versions" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {versions.map((letter) => (
              <button
                key={letter.id}
                type="button"
                disabled={editing}
                onClick={() => setSelectedId(letter.id)}
                className={cn(
                  'border-b-2 pb-1 transition-colors disabled:cursor-not-allowed',
                  letter.id === current.id ? 'border-ink text-ink' : 'border-transparent text-ink-muted hover:text-ink',
                )}
              >
                v{letter.version}
                {SOURCE_LABEL[letter.source] && <span className="ml-1 text-ink-faint">· {SOURCE_LABEL[letter.source]}</span>}
                {letter.status === 'ready' && <span className="ml-1 text-ok">· Approved</span>}
              </button>
            ))}
          </nav>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
            <Tag tone={current.status === 'ready' ? 'accent' : 'warn'}>{current.status === 'ready' ? 'Approved' : 'Draft'}</Tag>
            <span>
              {WRITTEN_BY[current.source] ?? 'Source not recorded'} · saved {relativeTime(current.created_at)}
            </span>
            {current.feedback && <span className="italic">“{current.feedback}”</span>}
          </div>

          <div className="flex flex-wrap gap-2">
            {editing ? (
              <>
                <Button variant="primary" disabled={busy || !draft?.trim()} onClick={save}>
                  {busy ? 'Saving…' : editsInPlace ? 'Save' : `Save as v${(latest?.version ?? 0) + 1}`}
                </Button>
                <Button variant="quiet" onClick={() => setDraft(null)}>
                  Cancel
                </Button>
              </>
            ) : (
              <>
                {current.status === 'ready' ? (
                  <Button disabled={busy} onClick={() => run(() => updateStatus(current.id, 'draft'))}>
                    Back to draft
                  </Button>
                ) : (
                  <Button variant="primary" disabled={busy} onClick={() => run(() => updateStatus(current.id, 'ready'))}>
                    Approve
                  </Button>
                )}
                <Button onClick={() => setDraft(current.content)}>Edit</Button>
                <Button variant="quiet" onClick={copy}>
                  {copied ? 'Copied' : 'Copy'}
                </Button>
                <Button
                  variant="quiet"
                  onClick={() =>
                    downloadFile(`/api/cover-letters/${current.id}/download`, `cover_letter_v${current.version}.pdf`).catch(
                      (err) => setActionError(errorDetail(err, 'PDF download failed')),
                    )
                  }
                >
                  PDF
                </Button>
              </>
            )}
          </div>

          {editing ? (
            <div className="space-y-1.5">
              <Textarea
                value={draft ?? ''}
                onChange={(e) => setDraft(e.target.value)}
                rows={22}
                aria-label="Letter text"
                className="max-w-[68ch] font-serif text-[16px] leading-[1.7]"
              />
              {!editsInPlace && (
                <p className="text-xs text-ink-faint">Saving keeps v{current.version} unchanged and adds your edit as a new version.</p>
              )}
            </div>
          ) : (
            <article className="max-w-[68ch] border-l border-rule pl-6 font-serif text-[16px] leading-[1.7] whitespace-pre-wrap text-ink">
              {current.content}
            </article>
          )}

          {!editing && (
            <section className="max-w-[68ch] space-y-3 pt-2">
              <SectionHeading>Revise</SectionHeading>
              {serverAi ? (
                <div className="space-y-2">
                  <Textarea
                    value={refineNote}
                    onChange={(e) => setRefineNote(e.target.value)}
                    rows={3}
                    placeholder="Shorter, lead with the Python work, more formal…"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={loading || busy || !refineNote.trim()}
                      onClick={() =>
                        run(async () => {
                          const refined = await refine(current.id, refineNote)
                          setSelectedId(refined.id)
                          setRefineNote('')
                        })
                      }
                    >
                      {loading ? 'Working…' : 'Refine with server AI'}
                    </Button>
                    <Button
                      variant="quiet"
                      disabled={loading || busy}
                      onClick={() =>
                        run(async () => {
                          const fresh = await generate(job.id)
                          setSelectedId(fresh.id)
                        })
                      }
                    >
                      Regenerate from scratch
                    </Button>
                  </div>
                </div>
              ) : (
                <AgentHint
                  prompt={`Revise cover letter v${current.version} for job #${job.id}: <your notes>. Keep every claim backed by my profile and save the result as a new draft.`}
                />
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}
