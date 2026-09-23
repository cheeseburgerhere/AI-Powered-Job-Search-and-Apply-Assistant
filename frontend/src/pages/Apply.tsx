import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useProfileStore } from '../stores/profileStore'
import { cn } from '../lib/utils'
import { Notice, PageHeader } from '../components/ui/Layout'
import { STEPS, useApplyFlow, type ApplyFlow, type ApplyStep } from './apply/useApplyFlow'
import { LinkStep } from './apply/LinkStep'
import { DetailsStep } from './apply/DetailsStep'
import { LetterStep } from './apply/LetterStep'
import { DocumentsStep } from './apply/DocumentsStep'
import { DoneStep } from './apply/DoneStep'

export default function Apply() {
  const flow = useApplyFlow()
  const [params, setParams] = useSearchParams()
  const fetchProfile = useProfileStore((s) => s.fetchProfile)
  const { loadSavedJob } = flow

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  // Entry from Jobs / Tracker: /apply?jobId=12 opens that saved job, then drops the param
  // so "Apply to another job" starts clean.
  const requestedJob = Number(params.get('jobId')) || null
  useEffect(() => {
    if (!requestedJob) return
    loadSavedJob(requestedJob)
    setParams({}, { replace: true })
  }, [requestedJob, loadSavedJob, setParams])

  return (
    <div className="space-y-6">
      <PageHeader title="Apply" description="Read a posting, prepare the letter and files, then record the application." />

      <div className="grid gap-8 lg:grid-cols-[11rem_minmax(0,1fr)]">
        <StepRail flow={flow} />
        <section className="min-w-0 space-y-4">
          {flow.error && <Notice tone="danger">{flow.error}</Notice>}
          <StepBody flow={flow} />
        </section>
      </div>
    </div>
  )
}

function StepBody({ flow }: { flow: ApplyFlow }) {
  if (flow.step === 'link' || !flow.details) return <LinkStep flow={flow} />
  if (flow.step === 'details') return <DetailsStep flow={flow} />
  if (flow.step === 'letter') return <LetterStep flow={flow} />
  if (flow.step === 'documents') return <DocumentsStep flow={flow} />
  return <DoneStep flow={flow} />
}

function StepRail({ flow }: { flow: ApplyFlow }) {
  const currentIndex = STEPS.findIndex((s) => s.key === flow.step)
  const reachable = (key: ApplyStep) => {
    if (flow.step === 'done') return key === 'done'
    if (key === 'link') return true
    if (key === 'done') return false
    return flow.details !== null
  }

  return (
    <nav aria-label="Steps">
      <ol className="flex gap-4 overflow-x-auto border-b border-rule pb-2 lg:flex-col lg:gap-0 lg:border-b-0 lg:border-l lg:pb-0">
        {STEPS.map((s, index) => {
          const current = s.key === flow.step
          const done = index < currentIndex
          return (
            <li key={s.key}>
              <button
                type="button"
                disabled={!reachable(s.key) || current}
                onClick={() => flow.setStep(s.key)}
                aria-current={current ? 'step' : undefined}
                className={cn(
                  'flex items-baseline gap-2 py-1.5 text-sm whitespace-nowrap lg:-ml-px lg:border-l-2 lg:pl-3',
                  current ? 'border-ink text-ink' : 'border-transparent',
                  !current && done && 'text-ink-muted hover:text-ink',
                  !current && !done && 'text-ink-faint',
                  'disabled:cursor-default',
                )}
              >
                <span className="font-mono text-xs tabular">{String(index + 1).padStart(2, '0')}</span>
                {s.label}
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
