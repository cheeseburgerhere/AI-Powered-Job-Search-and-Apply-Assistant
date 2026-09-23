import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import api, { errorDetail } from '../api/client'
import { useJobStore, type Job, type JobSearchFilters } from '../stores/jobStore'
import { useMetaStore } from '../stores/metaStore'
import { JobRow } from '../components/JobRow'
import { AgentHint } from '../components/ui/AgentHint'
import { Button } from '../components/ui/Button'
import { Field, Input, Select } from '../components/ui/Field'
import { Notice, PageHeader, SectionHeading } from '../components/ui/Layout'
import { Tabs } from '../components/ui/Tabs'
import { buttonClass } from '../components/ui/styles'

type Mode = 'api' | 'boards' | 'ats'

const MODES: { value: Mode; label: string }[] = [
  { value: 'api', label: 'Job APIs' },
  { value: 'boards', label: 'Board search' },
  { value: 'ats', label: 'Company boards' },
]

const SOURCE_INFO: Record<string, { label: string; env?: string }> = {
  jsearch: { label: 'JSearch', env: 'JSEARCH_API_KEY' },
  adzuna: { label: 'Adzuna', env: 'ADZUNA_APP_ID and ADZUNA_API_KEY' },
  brave_scrape: { label: 'Brave Search', env: 'BRAVE_API_KEY' },
  greenhouse: { label: 'Greenhouse' },
  lever: { label: 'Lever' },
  ashby: { label: 'Ashby' },
}

/** Brave site-restricted search. Greenhouse stays off until the Brave adapter handles its pages. */
const BOARD_SITES = [
  { id: 'lever', label: 'Lever', domain: 'jobs.lever.co', available: true },
  { id: 'ashby', label: 'Ashby', domain: 'jobs.ashbyhq.com', available: true },
  { id: 'greenhouse', label: 'Greenhouse', domain: 'boards.greenhouse.io', available: false },
]

const ATS_SOURCES = ['greenhouse', 'lever', 'ashby']

const COUNTRIES: [string, string][] = [
  ['us', 'United States'],
  ['gb', 'United Kingdom'],
  ['europe', 'Europe (all)'],
  ['de', 'Germany'],
  ['fr', 'France'],
  ['nl', 'Netherlands'],
  ['pl', 'Poland'],
  ['it', 'Italy'],
  ['es', 'Spain'],
  ['at', 'Austria'],
  ['be', 'Belgium'],
  ['ch', 'Switzerland'],
  ['au', 'Australia'],
  ['ca', 'Canada'],
]

interface HealthCheck {
  status: 'ok' | 'error' | 'not_configured'
  sample_count: number
  error: string | null
}

export default function Find() {
  const { loading, searchJobs } = useJobStore()
  const { capabilities } = useMetaStore()
  const serverAi = capabilities?.server_ai ?? false
  const configured = new Set(capabilities?.search_sources ?? [])
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const hasApiSource = configured.has('jsearch') || configured.has('adzuna')
  const defaultMode: Mode = capabilities && !hasApiSource ? 'ats' : 'api'
  const mode = (MODES.some((m) => m.value === params.get('tab')) ? params.get('tab') : defaultMode) as Mode

  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('')
  const [remoteOnly, setRemoteOnly] = useState(false)
  const [country, setCountry] = useState('europe')
  const [salaryMin, setSalaryMin] = useState('')
  const [salaryMax, setSalaryMax] = useState('')
  const [limit, setLimit] = useState('20')
  const [apiSources, setApiSources] = useState<Set<string>>(new Set(['jsearch', 'adzuna']))
  const [sites, setSites] = useState<Set<string>>(new Set(['lever']))
  const [atsSources, setAtsSources] = useState<Set<string>>(new Set(ATS_SOURCES))
  const [slugs, setSlugs] = useState('')
  const [score, setScore] = useState(true)
  const [minFit, setMinFit] = useState('')
  const [maxScored, setMaxScored] = useState('8')

  const [results, setResults] = useState<Job[] | null>(null)
  const [message, setMessage] = useState<{ tone: 'info' | 'danger'; text: string } | null>(null)

  const changeMode = (next: Mode) => {
    setParams({ tab: next }, { replace: true })
    setResults(null)
    setMessage(null)
  }

  const companySlugs = slugs
    .split(/[\s,]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)

  const toggle = (setter: typeof setApiSources) => (id: string) =>
    setter((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const buildRequest = (): JobSearchFilters | string => {
    if (!query.trim()) return 'Enter what to search for.'
    const scoring = serverAi && score
    const common = {
      query: query.trim(),
      location: location.trim() || undefined,
      remote_only: remoteOnly,
      score_results: scoring,
      max_scored_jobs: scoring ? Number(maxScored) || 8 : 0,
      min_fit_score: scoring && minFit ? Number(minFit) : undefined,
    }
    if (mode === 'api') {
      const sources = [...apiSources].filter((s) => configured.has(s))
      if (sources.length === 0) return 'Pick at least one configured API.'
      return {
        ...common,
        sources,
        country,
        salary_min: salaryMin ? Number(salaryMin) : undefined,
        salary_max: salaryMax ? Number(salaryMax) : undefined,
        per_page: Number(limit) || 20,
      }
    }
    if (mode === 'boards') {
      const domains = BOARD_SITES.filter((s) => s.available && sites.has(s.id)).map((s) => s.domain)
      if (!configured.has('brave_scrape')) return 'Board search needs a Brave Search API key.'
      if (domains.length === 0) return 'Pick at least one board.'
      return { ...common, sources: ['brave_scrape'], scrape_sites: domains, per_page: 30 }
    }
    if (atsSources.size === 0) return 'Pick at least one board system.'
    if (companySlugs.length === 0) return 'Add at least one company identifier.'
    return { ...common, sources: [...atsSources], company_slugs: companySlugs, per_page: Number(limit) || 20 }
  }

  const search = async () => {
    const request = buildRequest()
    if (typeof request === 'string') {
      setMessage({ tone: 'danger', text: request })
      return
    }
    setMessage(null)
    try {
      const found = await searchJobs(request)
      setResults(found)
      setMessage({
        tone: 'info',
        text:
          found.length === 0
            ? 'No jobs found. Try a broader query, drop the location, or turn off remote only.'
            : `Saved ${found.length} ${found.length === 1 ? 'job' : 'jobs'} to Jobs as Discovered.`,
      })
    } catch (err) {
      setResults(null)
      setMessage({ tone: 'danger', text: errorDetail(err, 'Search failed. Check provider keys and try again.') })
    }
  }

  const agentPrompt = (() => {
    const what = query.trim() ? `"${query.trim()}"` : 'my preferred role'
    const where = location.trim() ? ` in ${location.trim()}` : ''
    const remote = remoteOnly ? ', remote only' : ''
    if (mode === 'ats') {
      const companies = companySlugs.length ? companySlugs.join(', ') : '<company slugs>'
      return `Search ${[...atsSources].join('/')} boards for ${companies} for ${what} jobs${where}${remote}, save them, then analyse the new ones against my profile.`
    }
    return `Search and save ${what} jobs${where}${remote}, then analyse the new ones against my profile and flag the top matches.`
  })()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Find"
        description="Search results are saved straight to Jobs as Discovered."
        actions={
          <Link to="/jobs" className={buttonClass('secondary')}>
            Saved jobs
          </Link>
        }
      />

      <Tabs items={MODES} value={mode} onChange={changeMode} />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault()
            search()
          }}
        >
          <ModeIntro mode={mode} />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Role or keywords" className="sm:col-span-2">
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="backend engineer" autoFocus />
            </Field>
            <Field label="Location">
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Berlin, remote" />
            </Field>
            {mode === 'api' && (
              <Field label="Country" hint="Used by Adzuna.">
                <Select value={country} onChange={(e) => setCountry(e.target.value)}>
                  {COUNTRIES.map(([code, name]) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {mode === 'ats' && (
              <Field label="Company identifiers" hint="As they appear in board URLs, e.g. stripe, figma, linear.">
                <Input value={slugs} onChange={(e) => setSlugs(e.target.value)} placeholder="stripe, figma" />
              </Field>
            )}
            {mode === 'api' && (
              <>
                <Field label="Salary from">
                  <Input type="number" value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} placeholder="80000" />
                </Field>
                <Field label="Salary to">
                  <Input type="number" value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} placeholder="180000" />
                </Field>
              </>
            )}
            {mode !== 'boards' && (
              <Field label="Result limit">
                <Input type="number" min={1} max={100} value={limit} onChange={(e) => setLimit(e.target.value)} />
              </Field>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={remoteOnly} onChange={(e) => setRemoteOnly(e.target.checked)} />
            Remote only
          </label>

          <fieldset className="space-y-2">
            <legend className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-muted">Sources</legend>
            {mode === 'api' &&
              ['jsearch', 'adzuna'].map((id) => (
                <SourceCheckbox
                  key={id}
                  label={SOURCE_INFO[id].label}
                  checked={apiSources.has(id)}
                  onChange={() => toggle(setApiSources)(id)}
                  disabledReason={configured.has(id) ? undefined : `Set ${SOURCE_INFO[id].env} in backend/.env`}
                />
              ))}
            {mode === 'boards' &&
              BOARD_SITES.map((site) => (
                <SourceCheckbox
                  key={site.id}
                  label={site.label}
                  detail={site.domain}
                  checked={site.available && sites.has(site.id)}
                  onChange={() => toggle(setSites)(site.id)}
                  disabledReason={site.available ? undefined : 'Not supported yet'}
                />
              ))}
            {mode === 'ats' &&
              ATS_SOURCES.map((id) => (
                <SourceCheckbox
                  key={id}
                  label={SOURCE_INFO[id].label}
                  detail="public board API, no key needed"
                  checked={atsSources.has(id)}
                  onChange={() => toggle(setAtsSources)(id)}
                />
              ))}
          </fieldset>

          {mode === 'boards' && capabilities && !configured.has('brave_scrape') && (
            <Notice tone="warn">
              Board search runs through the Brave Search API. Get a free key at{' '}
              <span className="font-mono">api.search.brave.com</span>, then add{' '}
              <span className="font-mono">BRAVE_API_KEY=…</span> to <span className="font-mono">backend/.env</span> and
              restart the backend. Company boards work without it.
            </Notice>
          )}

          {serverAi && (
            <fieldset className="space-y-3 border-t border-rule pt-4">
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={score} onChange={(e) => setScore(e.target.checked)} />
                Score results with server AI ({capabilities?.ai_provider})
              </label>
              {score && (
                <div className="grid grid-cols-2 gap-4 sm:w-2/3">
                  <Field label="Min fit (0–10)">
                    <Input type="number" min={0} max={10} step={0.1} value={minFit} onChange={(e) => setMinFit(e.target.value)} placeholder="6.5" />
                  </Field>
                  <Field label="Score at most">
                    <Input type="number" min={0} max={30} value={maxScored} onChange={(e) => setMaxScored(e.target.value)} />
                  </Field>
                </div>
              )}
            </fieldset>
          )}

          <div className="flex items-center gap-3">
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? 'Searching…' : 'Search and save'}
            </Button>
            {!serverAi && <span className="text-xs text-ink-faint">Results are saved unscored.</span>}
          </div>

          {message && <Notice tone={message.tone}>{message.text}</Notice>}
        </form>

        <aside className="space-y-6">
          <AgentHint label="Or ask your agent" prompt={agentPrompt} />
          <ProviderStatus configured={configured} />
        </aside>
      </div>

      {results && results.length > 0 && (
        <section className="space-y-2">
          <SectionHeading aside={`${results.length} saved`}>This search</SectionHeading>
          <div>
            {results.map((job) => (
              <JobRow key={job.id} job={job} onSelect={(j) => navigate(`/jobs?id=${j.id}`)} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function ModeIntro({ mode }: { mode: Mode }) {
  const text: Record<Mode, ReactNode> = {
    api: 'Aggregated listings from JSearch and Adzuna. Structured, with salaries where posted.',
    boards: 'Web search restricted to job-board domains, for postings the APIs miss.',
    ats: "Every open role at specific companies, read straight from their Greenhouse, Lever or Ashby boards.",
  }
  return <p className="text-sm text-ink-muted">{text[mode]}</p>
}

function SourceCheckbox({
  label,
  detail,
  checked,
  onChange,
  disabledReason,
}: {
  label: string
  detail?: string
  checked: boolean
  onChange: () => void
  disabledReason?: string
}) {
  const disabled = Boolean(disabledReason)
  return (
    <label className={'flex items-baseline gap-2 text-sm ' + (disabled ? 'text-ink-faint' : 'text-ink')}>
      <input type="checkbox" checked={checked && !disabled} disabled={disabled} onChange={onChange} className="translate-y-0.5" />
      <span>{label}</span>
      {(disabledReason || detail) && <span className="text-xs text-ink-faint">{disabledReason || detail}</span>}
    </label>
  )
}

function ProviderStatus({ configured }: { configured: Set<string> }) {
  const [checks, setChecks] = useState<Record<string, HealthCheck> | null>(null)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runCheck = async () => {
    setChecking(true)
    setError(null)
    try {
      const { data } = await api.get('/jobs/providers/health')
      setChecks(data.checks)
    } catch (err) {
      setError(errorDetail(err, 'Provider check failed'))
    } finally {
      setChecking(false)
    }
  }

  return (
    <section className="space-y-2">
      <SectionHeading
        aside={
          <Button variant="quiet" size="sm" disabled={checking} onClick={runCheck}>
            {checking ? 'Checking…' : 'Test providers'}
          </Button>
        }
      >
        Providers
      </SectionHeading>
      <table className="w-full text-sm">
        <tbody>
          {Object.entries(SOURCE_INFO).map(([id, info]) => {
            const check = checks?.[id]
            const isOn = configured.has(id)
            let state = !info.env ? 'No key needed' : isOn ? 'Configured' : 'No key'
            // Company-board sources can't be sampled without company slugs, so only keyed ones report counts.
            if (check?.status === 'ok' && info.env) {
              state = `OK · ${check.sample_count} ${check.sample_count === 1 ? 'result' : 'results'}`
            }
            if (check?.status === 'error') state = 'Error'
            return (
              <tr key={id} className="border-b border-rule last:border-0">
                <td className="py-1.5 text-ink">{info.label}</td>
                <td
                  className={
                    'py-1.5 text-right text-xs ' +
                    (check?.status === 'error' ? 'text-danger' : isOn ? 'text-ink-muted' : 'text-ink-faint')
                  }
                  title={check?.error || undefined}
                >
                  {state}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="text-xs text-ink-faint">Testing runs a small live query against each configured provider.</p>
      {error && <Notice tone="danger">{error}</Notice>}
    </section>
  )
}
