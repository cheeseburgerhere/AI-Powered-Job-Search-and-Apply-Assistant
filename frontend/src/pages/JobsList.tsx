import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useJobStore, type Job } from '../stores/jobStore'
import { JOB_STATUSES, PRIORITIES, isAnalysed, jobTitle } from '../lib/jobs'
import { useLiveRefresh } from '../lib/useLiveRefresh'
import { cn } from '../lib/utils'
import { JobRow } from '../components/JobRow'
import { JobDetail } from '../components/JobDetail'
import { AddJobDrawer } from '../components/AddJobDrawer'
import { Button } from '../components/ui/Button'
import { Input, Select } from '../components/ui/Field'
import { EmptyState, Notice, PageHeader } from '../components/ui/Layout'
import { Tabs } from '../components/ui/Tabs'
import { buttonClass } from '../components/ui/styles'

type Sort = 'fit' | 'recent'

export default function JobsList() {
  const { jobs, loading, error, fetchJobs } = useJobStore()
  const [params, setParams] = useSearchParams()
  // Filters are local state; `?analysis=none` only seeds the "Not analysed" toggle for deep links.
  const [text, setText] = useState('')
  const [category, setCategory] = useState('')
  const [priority, setPriority] = useState('')
  const [minScore, setMinScore] = useState('')
  const [needsAnalysis, setNeedsAnalysis] = useState(() => params.get('analysis') === 'none')
  const [sort, setSort] = useState<Sort>('fit')
  const [adding, setAdding] = useState(false)

  const status = params.get('status') || 'all'
  const selectedId = Number(params.get('id')) || null

  const refresh = useCallback(() => fetchJobs(), [fetchJobs])
  useEffect(() => {
    refresh()
  }, [refresh])
  useLiveRefresh(refresh)

  const setParam = (key: string, value: string | null) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value === null) next.delete(key)
        else next.set(key, value)
        return next
      },
      { replace: key === 'id' },
    )
  }

  const counts = useMemo(() => {
    const byStatus: Record<string, number> = {}
    for (const job of jobs) byStatus[job.status] = (byStatus[job.status] || 0) + 1
    return byStatus
  }, [jobs])

  const categories = useMemo(
    () => [...new Set(jobs.map((j) => j.category).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [jobs],
  )

  const visible = useMemo(() => {
    const needle = text.trim().toLowerCase()
    const min = minScore ? Number(minScore) : null
    const filtered = jobs.filter((job) => {
      if (status !== 'all' && job.status !== status) return false
      if (category && job.category !== category) return false
      if (priority && job.priority !== priority) return false
      if (min !== null && (job.fit_score ?? -1) < min) return false
      if (needsAnalysis && isAnalysed(job)) return false
      if (needle && !`${jobTitle(job)} ${job.company} ${job.location}`.toLowerCase().includes(needle)) return false
      return true
    })
    const recent = (job: Job) => new Date(job.updated_at || job.date_saved || 0).getTime()
    return filtered.sort((a, b) =>
      sort === 'fit' ? (b.fit_score ?? -1) - (a.fit_score ?? -1) || recent(b) - recent(a) : recent(b) - recent(a),
    )
  }, [jobs, status, category, priority, minScore, needsAnalysis, text, sort])

  const selected = jobs.find((job) => job.id === selectedId) || null
  const filtersActive = Boolean(text || category || priority || minScore || needsAnalysis)
  const clearFilters = () => {
    setText('')
    setCategory('')
    setPriority('')
    setMinScore('')
    setNeedsAnalysis(false)
  }

  const statusTabs = [
    { value: 'all', label: 'All', count: jobs.length },
    ...JOB_STATUSES.map((s) => ({ value: s.key as string, label: s.label, count: counts[s.key] || 0 })),
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title="Jobs"
        description="Everything you or your agent has saved. Select a job to review its analysis."
        actions={
          <>
            <Link to="/find" className={buttonClass('secondary')}>
              Find more
            </Link>
            <Button variant="primary" onClick={() => setAdding(true)}>
              Add job
            </Button>
          </>
        }
      />

      <div className={cn('space-y-5', selected && 'hidden lg:block')}>
        <div className="overflow-x-auto">
          <Tabs items={statusTabs} value={status} onChange={(v) => setParam('status', v === 'all' ? null : v)} className="min-w-max" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Filter by title, company, place"
            aria-label="Filter jobs"
            className="w-60 py-1"
          />
          <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category" className="w-auto py-1">
            <option value="">Any category</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Select value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="Priority" className="w-auto py-1">
            <option value="">Any priority</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </option>
            ))}
          </Select>
          <Input
            type="number"
            min={0}
            max={10}
            step={0.5}
            value={minScore}
            onChange={(e) => setMinScore(e.target.value)}
            placeholder="Min fit"
            aria-label="Minimum fit score"
            className="w-24 py-1"
          />
          <label className="flex items-center gap-1.5 text-sm text-ink-muted">
            <input type="checkbox" checked={needsAnalysis} onChange={(e) => setNeedsAnalysis(e.target.checked)} />
            Not analysed
          </label>
          <span className="flex-1" />
          <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort" className="w-auto py-1">
            <option value="fit">Best fit first</option>
            <option value="recent">Recently updated</option>
          </Select>
        </div>
      </div>

      {error && <Notice tone="danger">{error}</Notice>}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <section className={cn('min-w-0', selected && 'hidden lg:block')} aria-label="Job list">
          {loading && jobs.length === 0 ? (
            <p className="py-12 text-center text-sm text-ink-faint">Loading jobs…</p>
          ) : visible.length === 0 ? (
            jobs.length === 0 ? (
              <EmptyState title="No jobs yet">
                Search from <Link to="/find" className="text-accent hover:underline">Find</Link>, add one by hand, or ask
                your agent to search and save jobs.
              </EmptyState>
            ) : (
              <EmptyState title="Nothing matches these filters">
                {filtersActive && (
                  <Button variant="quiet" size="sm" onClick={clearFilters}>
                    Clear filters
                  </Button>
                )}
              </EmptyState>
            )
          ) : (
            <div className="border-t border-rule">
              {visible.map((job) => (
                <JobRow
                  key={job.id}
                  job={job}
                  selected={job.id === selectedId}
                  onSelect={(j) => setParam('id', String(j.id))}
                  showStatus={status === 'all'}
                />
              ))}
              <p className="py-3 text-xs text-ink-faint">
                {visible.length} of {jobs.length} jobs
              </p>
            </div>
          )}
        </section>

        <section
          className={cn(
            'min-w-0 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto lg:border-l lg:border-rule lg:pl-8',
            !selected && 'hidden lg:block',
          )}
          aria-label="Job details"
        >
          {selected ? (
            <>
              <Button variant="quiet" size="sm" className="mb-3 -ml-2 lg:hidden" onClick={() => setParam('id', null)}>
                <ArrowLeft size={14} /> All jobs
              </Button>
              <JobDetail key={selected.id} job={selected} onDeleted={() => setParam('id', null)} />
            </>
          ) : (
            <p className="pt-10 text-center text-sm text-ink-faint">Select a job to see its analysis and description.</p>
          )}
        </section>
      </div>

      <AddJobDrawer
        open={adding}
        onClose={() => setAdding(false)}
        onCreated={(job) => {
          setAdding(false)
          setParam('id', String(job.id))
        }}
      />
    </div>
  )
}
