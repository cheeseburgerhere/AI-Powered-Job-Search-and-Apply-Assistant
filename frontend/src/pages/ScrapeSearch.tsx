import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useJobStore } from '../stores/jobStore'
import { ArrowLeft, Search, Loader2, Check, AlertTriangle } from 'lucide-react'
import api from '../api/client'

interface ScrapeAgent {
  id: string
  name: string
  domain: string
  description: string
  color: string
  bgColor: string
  borderColor: string
  available: boolean
}

const SCRAPE_AGENTS: ScrapeAgent[] = [
  {
    id: 'greenhouse',
    name: 'Greenhouse',
    domain: 'boards.greenhouse.io',
    description: 'Search open positions from Greenhouse job boards via API',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-500',
    available: true,
  },
  {
    id: 'lever',
    name: 'Lever',
    domain: 'jobs.lever.co',
    description: 'Search listings from Lever career pages via API',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-500',
    available: true,
  },
  {
    id: 'ashby',
    name: 'Ashby',
    domain: 'jobs.ashbyhq.com',
    description: 'Search job postings from Ashby boards via API',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-500',
    available: true,
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    domain: 'linkedin.com/jobs',
    description: 'Scrape LinkedIn job listings',
    color: 'text-sky-700',
    bgColor: 'bg-sky-50',
    borderColor: 'border-sky-500',
    available: false,
  },
  {
    id: 'indeed',
    name: 'Indeed',
    domain: 'indeed.com',
    description: 'Scrape Indeed job postings',
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-500',
    available: false,
  },
  {
    id: 'workday',
    name: 'Workday',
    domain: 'myworkdayjobs.com',
    description: 'Scrape Workday career sites',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-500',
    available: false,
  },
]

const DIRECT_ATS_AGENTS = new Set(['greenhouse', 'lever', 'ashby'])

export default function ScrapeSearch() {
  const { loading, searchJobs } = useJobStore()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('')
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set(['greenhouse']))
  const [searchSummary, setSearchSummary] = useState('')
  const [scoreResults, setScoreResults] = useState(true)
  const [cseConfigured, setCseConfigured] = useState<boolean | null>(null)

  useEffect(() => {
    api.get('/jobs/providers/health')
      .then(({ data }) => {
        const bs = data?.checks?.brave_scrape
        setCseConfigured(bs && bs.status !== 'not_configured')
      })
      .catch(() => setCseConfigured(null))
  }, [])

  const toggleAgent = (id: string) => {
    const agent = SCRAPE_AGENTS.find((a) => a.id === id)
    if (!agent?.available) return

    setSelectedAgents((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleScrape = async () => {
    if (!query.trim()) {
      setSearchSummary('Enter a search query.')
      return
    }

    const selectedList = SCRAPE_AGENTS.filter((a) => selectedAgents.has(a.id) && a.available)
    if (selectedList.length === 0) {
      setSearchSummary('Select at least one agent.')
      return
    }

    // Split selected agents into direct ATS sources and brave_scrape sites
    const directSources = selectedList.filter((a) => DIRECT_ATS_AGENTS.has(a.id)).map((a) => a.id)
    const braveSites = selectedList.filter((a) => !DIRECT_ATS_AGENTS.has(a.id)).map((a) => a.domain)

    const sources = [...directSources]
    if (braveSites.length > 0) {
      sources.push('brave_scrape')
    }

    try {
      const found = await searchJobs({
        query: query.trim(),
        location: location.trim() || undefined,
        sources,
        scrape_sites: braveSites.length > 0 ? braveSites : undefined,
        score_results: scoreResults,
        max_scored_jobs: 8,
        per_page: 30,
      })
      if (found.length === 0) {
        setSearchSummary('Found 0 jobs. Try a different query.')
      } else {
        setSearchSummary(`Found ${found.length} job(s). View them in Jobs.`)
      }
    } catch (err: any) {
      setSearchSummary(err?.message || 'Search failed. Try again.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/jobs/find')}
          className="p-2 text-gray-400 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Board Search</h1>
          <p className="text-gray-500 mt-1">Search job boards directly via their APIs</p>
        </div>
      </div>

      {/* Brave Search setup banner */}
      {cseConfigured === false && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-5 flex gap-4">
          <AlertTriangle size={20} className="text-amber-600 mt-0.5 shrink-0" />
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-amber-900">Brave Search API not configured</p>
            <p className="text-amber-800">Brave Search is optional and adds broad web discovery alongside direct board APIs. To enable it:</p>
            <ol className="list-decimal ml-4 space-y-1 text-amber-800">
              <li>
                Go to{' '}
                <span className="font-mono bg-amber-100 px-1 rounded">https://api.search.brave.com/</span>
                {' '}and sign up for a free account.
              </li>
              <li>
                Copy your API key and add it to{' '}
                <span className="font-mono bg-amber-100 px-1 rounded">backend/.env</span>
              </li>
            </ol>
            <pre className="bg-amber-100 text-amber-900 rounded-lg p-3 text-xs font-mono whitespace-pre-wrap">
{`BRAVE_API_KEY=your-brave-api-key`}
            </pre>
          </div>
        </div>
      )}

      {/* Query inputs */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search Query *</label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder='e.g. AI developer, backend engineer'
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location (optional)</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="e.g. Berlin, remote"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={scoreResults}
              onChange={(e) => setScoreResults(e.target.checked)}
            />
            Score results with AI
          </label>
        </div>
      </div>

      {/* Agent cards */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Search Agents</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {SCRAPE_AGENTS.map((agent) => {
            const isSelected = selectedAgents.has(agent.id)
            return (
              <button
                key={agent.id}
                onClick={() => toggleAgent(agent.id)}
                disabled={!agent.available}
                className={`relative flex flex-col items-start gap-3 p-6 rounded-2xl border-2 text-left transition-all ${
                  !agent.available
                    ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                    : isSelected
                      ? `${agent.borderColor} ${agent.bgColor} shadow-md`
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm cursor-pointer'
                }`}
              >
                {/* Selection indicator */}
                {isSelected && agent.available && (
                  <div className={`absolute top-4 right-4 w-6 h-6 rounded-full ${agent.bgColor} flex items-center justify-center`}>
                    <Check size={14} className={agent.color} />
                  </div>
                )}

                {!agent.available && (
                  <span className="absolute top-4 right-4 text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-500 font-medium">
                    Coming Soon
                  </span>
                )}

                <div>
                  <h3 className={`text-lg font-bold ${agent.available ? agent.color : 'text-gray-400'}`}>
                    {agent.name}
                  </h3>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">{agent.domain}</p>
                </div>
                <p className="text-sm text-gray-500">{agent.description}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Action */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleScrape}
          disabled={loading || selectedAgents.size === 0}
          className="px-6 py-2.5 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          Run Selected Agents
        </button>
        {searchSummary && <span className="text-sm text-gray-500">{searchSummary}</span>}
      </div>

      {/* Link to view results */}
      {searchSummary && searchSummary.includes('Found') && !searchSummary.includes('Found 0') && (
        <button
          onClick={() => navigate('/jobs/list')}
          className="w-full py-3 bg-emerald-50 text-emerald-700 text-sm font-medium rounded-xl hover:bg-emerald-100 transition-colors"
        >
          View found jobs
        </button>
      )}
    </div>
  )
}
