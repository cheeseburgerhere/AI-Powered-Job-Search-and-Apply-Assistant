import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Building2, CheckCircle2, Circle, Clipboard, ExternalLink, Loader2, Star } from 'lucide-react'
import { useJobStore, type Job } from '../stores/jobStore'
import { useApplyStore, type ApplyPlan } from '../stores/applyStore'

const MIN_FIT_SCORE = 6
const BG_LOAD_STAGGER_MS = 400

type TaskId = 'open_link' | 'copy_materials' | 'submit_external' | 'confirm_applied'

type Task = {
  id: TaskId
  title: string
  done: boolean
}

function readinessChip(plan: ApplyPlan): { label: string; className: string } {
  if (plan.mode_recommendation === 'manual_only') {
    return { label: 'Manual only', className: 'bg-slate-200 text-slate-700' }
  }
  if (plan.missing_fields.length > 0) {
    return { label: 'Needs info', className: 'bg-amber-100 text-amber-800' }
  }
  return { label: 'Ready', className: 'bg-emerald-100 text-emerald-800' }
}

function formatFieldName(field: string): string {
  return field.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

export default function ApplyQueue() {
  const navigate = useNavigate()
  const { jobs, loading, fetchJobs, updateJob, scoreJob } = useJobStore()
  const { getApplyPlan } = useApplyStore()

  const [planMap, setPlanMap] = useState<Record<number, ApplyPlan>>({})
  const [loadingPlanIds, setLoadingPlanIds] = useState<Set<number>>(new Set())
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null)
  const [savingApplied, setSavingApplied] = useState(false)
  const [scoringJobId, setScoringJobId] = useState<number | null>(null)
  const [copyFeedback, setCopyFeedback] = useState('')
  const [tasks, setTasks] = useState<Task[]>([])
  const bgLoadRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fetchedIdsRef = useRef<Set<number>>(new Set())

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  const queueJobs = useMemo(
    () => jobs.filter((job) => Boolean(job.url) && job.status !== 'applied'),
    [jobs],
  )

  const sortedQueueJobs = useMemo(() => {
    const copy = [...queueJobs]
    copy.sort((a, b) => {
      const aScore = a.fit_score ?? -1
      const bScore = b.fit_score ?? -1
      return aScore === bScore ? b.id - a.id : bScore - aScore
    })
    return copy
  }, [queueJobs])

  // Fetch a single plan and cache it; no-op if already fetched
  const loadPlan = useCallback(
    async (jobId: number) => {
      if (fetchedIdsRef.current.has(jobId)) return
      fetchedIdsRef.current.add(jobId)
      setLoadingPlanIds((prev) => new Set(prev).add(jobId))
      try {
        const plan = await getApplyPlan(jobId)
        setPlanMap((prev) => ({ ...prev, [jobId]: plan }))
      } catch {
        // silently ignore; chip stays "Analyzing"
        fetchedIdsRef.current.delete(jobId)
      } finally {
        setLoadingPlanIds((prev) => {
          const next = new Set(prev)
          next.delete(jobId)
          return next
        })
      }
    },
    [getApplyPlan],
  )

  // Auto-select first job once list is available
  useEffect(() => {
    if (!sortedQueueJobs.length) {
      setSelectedJobId(null)
      return
    }
    const stillExists = sortedQueueJobs.some((job) => job.id === selectedJobId)
    if (!stillExists) setSelectedJobId(sortedQueueJobs[0].id)
  }, [sortedQueueJobs, selectedJobId])

  // Immediately load the selected job's plan (latency hiding)
  useEffect(() => {
    if (selectedJobId !== null) void loadPlan(selectedJobId)
  }, [selectedJobId, loadPlan])

  // Background-load remaining plans one-at-a-time with stagger after selected is done
  useEffect(() => {
    if (bgLoadRef.current) clearTimeout(bgLoadRef.current)

    const remaining = sortedQueueJobs.filter(
      (job) => job.id !== selectedJobId && !fetchedIdsRef.current.has(job.id),
    )
    if (!remaining.length) return

    let delay = BG_LOAD_STAGGER_MS
    for (const job of remaining) {
      const id = job.id
      bgLoadRef.current = setTimeout(() => void loadPlan(id), delay)
      delay += BG_LOAD_STAGGER_MS
    }

    return () => {
      if (bgLoadRef.current) clearTimeout(bgLoadRef.current)
    }
  // Re-run only when the list identity changes, not on every render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedQueueJobs.map((j) => j.id).join(',')])

  const selectedJob: Job | undefined = useMemo(
    () => sortedQueueJobs.find((job) => job.id === selectedJobId),
    [sortedQueueJobs, selectedJobId],
  )

  const selectedPlan = selectedJobId !== null ? planMap[selectedJobId] ?? null : null

  useEffect(() => {
    setTasks([
      { id: 'open_link', title: 'Open application page', done: false },
      { id: 'copy_materials', title: 'Copy and paste your application materials', done: false },
      { id: 'submit_external', title: 'Fill out and submit on company site', done: false },
      { id: 'confirm_applied', title: 'Confirm this application is done', done: false },
    ])
  }, [selectedJobId])

  const toggleTask = (taskId: TaskId) => {
    setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, done: !task.done } : task)))
  }

  const handleCopy = async (text: string, label: string) => {
    if (!text.trim()) return
    await navigator.clipboard.writeText(text)
    setCopyFeedback(`${label} copied`)
    setTasks((prev) => prev.map((task) => (task.id === 'copy_materials' ? { ...task, done: true } : task)))
    window.setTimeout(() => setCopyFeedback(''), 1400)
  }

  const handleScore = async (jobId: number) => {
    setScoringJobId(jobId)
    try {
      await scoreJob(jobId)
      await fetchJobs()
    } finally {
      setScoringJobId(null)
    }
  }

  const handleMarkApplied = async () => {
    if (!selectedJob) return
    setSavingApplied(true)
    try {
      await updateJob(selectedJob.id, { status: 'applied' })
      await fetchJobs()
    } finally {
      setSavingApplied(false)
    }
  }

  const doneCount = tasks.filter((task) => task.done).length
  const allTasksDone = tasks.length > 0 && tasks.every((task) => task.done)
  const isPlanLoading = selectedJobId !== null && loadingPlanIds.has(selectedJobId)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/jobs')}
          className="p-2 text-gray-400 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Apply Queue</h1>
          <p className="text-gray-500 mt-1">Jobs sorted by fit score — click any to start an assisted application</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-semibold text-gray-900">Queue</h2>
            <span className="text-xs text-gray-400">{sortedQueueJobs.length} job{sortedQueueJobs.length !== 1 ? 's' : ''}</span>
          </div>

          {loading && sortedQueueJobs.length === 0 && (
            <div className="py-10 text-gray-400 text-sm flex items-center gap-2">
              <Loader2 size={16} className="animate-spin" /> Loading jobs...
            </div>
          )}
          {!loading && sortedQueueJobs.length === 0 && (
            <p className="py-10 text-sm text-gray-400 text-center">No jobs with apply links yet. Add jobs and score them first.</p>
          )}

          <div className="mt-3 space-y-2">
            {sortedQueueJobs.map((job) => {
              const plan = planMap[job.id]
              const chip = plan ? readinessChip(plan) : null
              const isRecommended = job.fit_score !== null && job.fit_score >= MIN_FIT_SCORE
              const isSelected = selectedJobId === job.id
              const isLoadingThisPlan = loadingPlanIds.has(job.id)

              return (
                <div
                  key={job.id}
                  className={`border rounded-xl p-4 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-200'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/60'
                  }`}
                  onClick={() => setSelectedJobId(job.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-gray-500 truncate">{job.company}</p>
                      <h3 className="mt-0.5 text-sm font-semibold text-gray-900 leading-snug line-clamp-2">{job.title || 'Open Position'}</h3>
                    </div>
                    <div className="shrink-0">
                      {isLoadingThisPlan && !chip ? (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500 inline-flex items-center gap-1">
                          <Loader2 size={10} className="animate-spin" /> loading
                        </span>
                      ) : chip ? (
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${chip.className}`}>{chip.label}</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold inline-flex items-center gap-1 ${
                      job.fit_score === null ? 'bg-gray-100 text-gray-500' :
                      job.fit_score >= 8 ? 'bg-emerald-100 text-emerald-700' :
                      job.fit_score >= 6 ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      <Star size={10} />
                      {job.fit_score !== null ? `${job.fit_score.toFixed(1)} / 10` : 'Unscored'}
                    </span>
                    {isRecommended && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">Recommended</span>
                    )}
                    {plan && plan.missing_fields.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-amber-50 text-amber-700 border border-amber-200">
                        {plan.missing_fields.length} field{plan.missing_fields.length > 1 ? 's' : ''} missing
                      </span>
                    )}
                  </div>

                  <div className="mt-2.5 flex items-center gap-2">
                    {job.fit_score === null && (
                      <button
                        onClick={(e) => { e.stopPropagation(); void handleScore(job.id) }}
                        disabled={scoringJobId === job.id}
                        className="px-2.5 py-1 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                      >
                        {scoringJobId === job.id ? 'Scoring...' : 'Score'}
                      </button>
                    )}
                    {job.url && (
                      <a
                        onClick={(e) => e.stopPropagation()}
                        href={job.url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 text-xs font-medium rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 inline-flex items-center gap-1"
                      >
                        <ExternalLink size={11} /> Open
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-base font-semibold text-gray-900">Assisted Apply</h2>

          {!selectedJob ? (
            <p className="text-sm text-gray-400 mt-3">Select a job from the queue to begin.</p>
          ) : (
            <div className="mt-4 space-y-4">

              {/* Job identity */}
              <div className="pb-3 border-b border-gray-100">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                  <Building2 size={12} />
                  <span className="font-medium">{selectedJob.company}</span>
                </div>
                <h3 className="text-sm font-semibold text-gray-900 leading-snug">{selectedJob.title}</h3>
              </div>

              {/* Plan metadata */}
              {isPlanLoading && !selectedPlan && (
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Loader2 size={13} className="animate-spin" /> Loading apply plan...
                </div>
              )}

              {selectedPlan && (
                <>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600 font-medium capitalize">{selectedPlan.adapter_type}</span>
                    <span className="px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 font-medium">{Math.round(selectedPlan.confidence_score * 100)}% confidence</span>
                    <span className={`px-2 py-1 rounded-full font-medium ${
                      selectedPlan.mode_recommendation === 'assisted'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}>{selectedPlan.mode_recommendation.replace('_', ' ')}</span>
                  </div>

                  {selectedPlan.missing_fields.length > 0 && (
                    <div className="rounded-md border-l-4 border-l-amber-500 bg-amber-50 p-4 shadow-sm">
                    <p className="text-sm font-bold text-amber-900">Missing fields</p>
                    <ul className="mt-2 ml-4 list-disc space-y-1 text-sm text-amber-800 marker:text-amber-500">
                        {selectedPlan.missing_fields.map((f) => (
                        <li key={f}>{formatFieldName(f)}</li>
                        ))}
                    </ul>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="space-y-2">
                    <button
                      onClick={() => {
                        if (selectedJob.url) {
                          window.open(selectedJob.url, '_blank', 'noopener,noreferrer')
                          setTasks((prev) => prev.map((task) => (task.id === 'open_link' ? { ...task, done: true } : task)))
                        }
                      }}
                      className="w-full px-3 py-2.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 inline-flex items-center justify-center gap-2"
                    >
                      <ExternalLink size={14} /> Open Application Page
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => void handleCopy(selectedPlan.prefill_payload.materials.cover_letter || '', 'Cover letter')}
                        className="px-3 py-2 text-sm font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 inline-flex items-center justify-center gap-2"
                      >
                        <Clipboard size={13} /> Cover Letter
                      </button>
                      <button
                        onClick={() =>
                          void handleCopy(
                            selectedPlan.prefill_payload.materials.resume_text ||
                              selectedPlan.prefill_payload.materials.resume_file_path ||
                              '',
                            'Resume',
                          )
                        }
                        className="px-3 py-2 text-sm font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 inline-flex items-center justify-center gap-2"
                      >
                        <Clipboard size={13} /> Resume
                      </button>
                    </div>
                    {copyFeedback && <p className="text-xs text-emerald-600 text-center">{copyFeedback}</p>}
                  </div>
                </>
              )}

              {/* Task list */}
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Tasks</p>
                  <p className="text-xs text-gray-400">{doneCount}/{tasks.length}</p>
                </div>
                <div className="divide-y divide-gray-100">
                  {tasks.map((task, idx) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => toggleTask(task.id)}
                      className={`w-full text-left px-3 py-3 flex items-center gap-3 transition-colors ${
                        task.done ? 'bg-slate-800/55 hover:bg-slate-800/70' : 'hover:bg-slate-800/45'
                      }`}
                    >
                      <span className="shrink-0 w-5 h-5 flex items-center justify-center">
                        {task.done ? (
                          <CheckCircle2 size={18} className="text-emerald-500" />
                        ) : (
                          <Circle size={18} className="text-gray-300" />
                        )}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm ${
                          task.done ? 'text-slate-400 line-through' : 'text-slate-100'
                        }`}>{task.title}</span>
                      </div>
                      <span className="shrink-0 text-xs text-slate-300">{idx + 1}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleMarkApplied}
                disabled={!allTasksDone || savingApplied}
                className="w-full px-3 py-2.5 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                {savingApplied ? 'Saving...' : 'Mark Applied'}
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
