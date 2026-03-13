import { useEffect, useState } from 'react'
import { useJobStore, type Job } from '../stores/jobStore'
import { Link } from 'react-router-dom'
import { Plus, Star, ExternalLink, Loader2, Trash2, Search, SlidersHorizontal } from 'lucide-react'

export default function JobFeed() {
  const { jobs, loading, error, fetchJobs, createJob, scoreJob, deleteJob, searchJobs } = useJobStore()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', company: '', description: '', url: '', location: '', remote_type: '' })
  const [showSearchFilters, setShowSearchFilters] = useState(true)
  const [searchSummary, setSearchSummary] = useState('')
  const [searchForm, setSearchForm] = useState({
    query: '',
    location: '',
    remote_only: false,
    salary_min: '',
    salary_max: '',
    min_fit_score: '',
    max_scored_jobs: '8',
    per_page: '20',
    country: 'europe',
    score_results: true,
    use_jsearch: true,
    use_adzuna: true,
    use_google_scrape: false,
    scrape_greenhouse: true,
    scrape_lever: true,
    scrape_ashby: true,
  })
  const [scoring, setScoring] = useState<number | null>(null)

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  const handleCreate = async () => {
    if (!form.title || !form.company || !form.description) return
    try {
      const job = await createJob(form)
      setForm({ title: '', company: '', description: '', url: '', location: '', remote_type: '' })
      setShowForm(false)
      // Auto-score
      setScoring(job.id)
      try {
        await scoreJob(job.id)
      } catch {
        // scoring is optional
      }
      setScoring(null)
    } catch {
      // error
    }
  }

  const handleScore = async (id: number) => {
    setScoring(id)
    try {
      await scoreJob(id)
    } catch {
      // silent
    }
    setScoring(null)
  }

  const handleAutoFind = async () => {
    const query = searchForm.query.trim()

    const sources = [
      searchForm.use_jsearch ? 'jsearch' : '',
      searchForm.use_adzuna ? 'adzuna' : '',
      searchForm.use_google_scrape ? 'google_scrape' : '',
    ].filter(Boolean)

    if (sources.length === 0) {
      setSearchSummary('Select at least one source.')
      return
    }

    // Build scrape_sites list from checkboxes
    const scrape_sites = searchForm.use_google_scrape
      ? [
          searchForm.scrape_greenhouse ? 'boards.greenhouse.io' : '',
          searchForm.scrape_lever ? 'jobs.lever.co' : '',
          searchForm.scrape_ashby ? 'jobs.ashbyhq.com' : '',
        ].filter(Boolean)
      : undefined

    try {
      const found = await searchJobs({
        query: query || undefined,
        location: searchForm.location.trim() || undefined,
        remote_only: searchForm.remote_only,
        salary_min: searchForm.salary_min ? parseInt(searchForm.salary_min) : undefined,
        salary_max: searchForm.salary_max ? parseInt(searchForm.salary_max) : undefined,
        min_fit_score: searchForm.min_fit_score ? parseFloat(searchForm.min_fit_score) : undefined,
        max_scored_jobs: searchForm.max_scored_jobs ? parseInt(searchForm.max_scored_jobs) : 8,
        per_page: searchForm.per_page ? parseInt(searchForm.per_page) : 20,
        score_results: searchForm.score_results,
        sources,
        country: searchForm.country.trim() || undefined,
        scrape_sites,
      })
      if (found.length === 0) {
        setSearchSummary('Found 0 jobs. Try broader query/location, disable Remote only, or remove Min Fit Score.')
      } else {
        setSearchSummary(`Found ${found.length} job(s) matching your conditions.`)
      }
    } catch {
      setSearchSummary('Auto find failed. Check provider keys and conditions.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>
          <p className="text-gray-500 mt-1">Add jobs and get AI-powered fit scores</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus size={16} />
          Add Job
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>
      )}

      {/* Auto Find */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Search size={18} />
            Auto Find Jobs
          </h2>
          <button
            onClick={() => setShowSearchFilters((v) => !v)}
            className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-1"
          >
            <SlidersHorizontal size={14} />
            {showSearchFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
        </div>

        {showSearchFilters && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role / Query *</label>
              <input
                type="text"
                value={searchForm.query}
                onChange={(e) => setSearchForm((s) => ({ ...s, query: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. backend engineer"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <input
                type="text"
                value={searchForm.location}
                onChange={(e) => setSearchForm((s) => ({ ...s, location: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Berlin"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Country (Adzuna)</label>
              <select
                value={searchForm.country}
                onChange={(e) => setSearchForm((s) => ({ ...s, country: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="us">🇺🇸 United States</option>
                <option value="gb">🇬🇧 United Kingdom</option>
                <option value="europe">🌍 Europe (All)</option>
                <option value="de">🇩🇪 Germany</option>
                <option value="fr">🇫🇷 France</option>
                <option value="nl">🇳🇱 Netherlands</option>
                <option value="pl">🇵🇱 Poland</option>
                <option value="it">🇮🇹 Italy</option>
                <option value="es">🇪🇸 Spain</option>
                <option value="at">🇦🇹 Austria</option>
                <option value="be">🇧🇪 Belgium</option>
                <option value="ch">🇨🇭 Switzerland</option>
                <option value="au">🇦🇺 Australia</option>
                <option value="ca">🇨🇦 Canada</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Min Salary</label>
              <input
                type="number"
                value={searchForm.salary_min}
                onChange={(e) => setSearchForm((s) => ({ ...s, salary_min: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="80000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Salary</label>
              <input
                type="number"
                value={searchForm.salary_max}
                onChange={(e) => setSearchForm((s) => ({ ...s, salary_max: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="180000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Min Fit Score (0-10)</label>
              <input
                type="number"
                min="0"
                max="10"
                step="0.1"
                value={searchForm.min_fit_score}
                onChange={(e) => setSearchForm((s) => ({ ...s, min_fit_score: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="6.5"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Results Limit</label>
              <input
                type="number"
                min="1"
                max="100"
                value={searchForm.per_page}
                onChange={(e) => setSearchForm((s) => ({ ...s, per_page: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max AI-Scored Jobs</label>
              <input
                type="number"
                min="0"
                max="30"
                value={searchForm.max_scored_jobs}
                onChange={(e) => setSearchForm((s) => ({ ...s, max_scored_jobs: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={searchForm.remote_only}
                  onChange={(e) => setSearchForm((s) => ({ ...s, remote_only: e.target.checked }))}
                />
                Remote only
              </label>
            </div>
            <div className="md:col-span-3 flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={searchForm.score_results}
                  onChange={(e) => setSearchForm((s) => ({ ...s, score_results: e.target.checked }))}
                />
                Score with AI
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={searchForm.use_jsearch}
                  onChange={(e) => setSearchForm((s) => ({ ...s, use_jsearch: e.target.checked }))}
                />
                JSearch
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={searchForm.use_adzuna}
                  onChange={(e) => setSearchForm((s) => ({ ...s, use_adzuna: e.target.checked }))}
                />
                Adzuna
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={searchForm.use_google_scrape}
                  onChange={(e) => setSearchForm((s) => ({ ...s, use_google_scrape: e.target.checked }))}
                />
                Google Scrape
              </label>
            </div>
            {searchForm.use_google_scrape && (
              <div className="md:col-span-3 flex flex-wrap gap-4 pl-6 border-l-2 border-blue-200">
                <span className="text-xs font-medium text-gray-500 w-full">Job boards to scrape:</span>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={searchForm.scrape_greenhouse}
                    onChange={(e) => setSearchForm((s) => ({ ...s, scrape_greenhouse: e.target.checked }))}
                  />
                  Greenhouse
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={searchForm.scrape_lever}
                    onChange={(e) => setSearchForm((s) => ({ ...s, scrape_lever: e.target.checked }))}
                  />
                  Lever
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={searchForm.scrape_ashby}
                    onChange={(e) => setSearchForm((s) => ({ ...s, scrape_ashby: e.target.checked }))}
                  />
                  Ashby
                </label>
              </div>
            )}
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleAutoFind}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            Auto Find
          </button>
          <button
            onClick={() => fetchJobs()}
            disabled={loading}
            className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 disabled:opacity-50"
          >
            Show Saved Jobs
          </button>
          {searchSummary && <span className="text-sm text-gray-500">{searchSummary}</span>}
        </div>
      </div>

      {/* Add Job Form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Add a New Job</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Job Title *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Senior Software Engineer"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company *</label>
              <input
                type="text"
                value={form.company}
                onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Acme Inc"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="San Francisco, CA"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
              <input
                type="text"
                value={form.url}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://..."
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Job Description *</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={8}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Paste the full job description here..."
            />
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleCreate}
              disabled={!form.title || !form.company || !form.description}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Save & Score
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Job List */}
      {loading && jobs.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <Loader2 size={32} className="animate-spin mx-auto" />
        </div>
      )}

      {!loading && jobs.length === 0 && !showForm && (
        <div className="text-center py-12">
          <p className="text-gray-400">No jobs yet. Click "Add Job" to get started.</p>
        </div>
      )}

      <div className="space-y-3">
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} onScore={handleScore} onDelete={deleteJob} scoring={scoring === job.id} />
        ))}
      </div>
    </div>
  )
}

function JobCard({
  job,
  onScore,
  onDelete,
  scoring,
}: {
  job: Job
  onScore: (id: number) => void
  onDelete: (id: number) => void
  scoring: boolean
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-300 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-gray-900">{job.title}</h3>
            {job.fit_score !== null && <FitScoreBadge score={job.fit_score} />}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {job.company}
            {job.location && ` · ${job.location}`}
          </p>
          {job.fit_reasoning && (
            <p className="text-xs text-gray-500 mt-2 line-clamp-2">{job.fit_reasoning}</p>
          )}
        </div>
        <div className="flex items-center gap-2 ml-4">
          {job.url && (
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
            >
              <ExternalLink size={16} />
            </a>
          )}
          <Link
            to={`/cover-letters?job_id=${job.id}`}
            className="px-3 py-1.5 text-xs font-medium bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100"
          >
            Cover Letter
          </Link>
          {job.fit_score === null && (
            <button
              onClick={() => onScore(job.id)}
              disabled={scoring}
              className="px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 disabled:opacity-50 flex items-center gap-1"
            >
              {scoring ? <Loader2 size={12} className="animate-spin" /> : <Star size={12} />}
              Score
            </button>
          )}
          <button
            onClick={() => onDelete(job.id)}
            className="p-2 text-gray-400 hover:text-red-600 transition-colors"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3">
        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">{job.status.replace('_', ' ')}</span>
        <span className="text-xs text-gray-400">{job.source}</span>
        {job.date_saved && <span className="text-xs text-gray-400">Saved {new Date(job.date_saved).toLocaleDateString()}</span>}
      </div>
    </div>
  )
}

function FitScoreBadge({ score }: { score: number }) {
  let bg = 'bg-red-100 text-red-700'
  if (score >= 7) bg = 'bg-green-100 text-green-700'
  else if (score >= 5) bg = 'bg-yellow-100 text-yellow-700'

  return (
    <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${bg}`}>
      {score.toFixed(1)}/10
    </span>
  )
}
