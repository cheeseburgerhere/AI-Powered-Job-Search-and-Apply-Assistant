import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useJobStore } from '../stores/jobStore'
import { ArrowLeft, Search, Loader2 } from 'lucide-react'

export default function ApiSearch() {
  const { loading, searchJobs } = useJobStore()
  const navigate = useNavigate()
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
  })

  const handleSearch = async () => {
    const query = searchForm.query.trim()

    if (!query) {
      setSearchSummary('Enter a search query.')
      return
    }

    const sources = [
      searchForm.use_jsearch ? 'jsearch' : '',
      searchForm.use_adzuna ? 'adzuna' : '',
    ].filter(Boolean)

    if (sources.length === 0) {
      setSearchSummary('Select at least one source.')
      return
    }

    try {
      const found = await searchJobs({
        query,
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
      })
      if (found.length === 0) {
        setSearchSummary('Found 0 jobs. Try broader query/location, disable Remote only, or remove Min Fit Score.')
      } else {
        setSearchSummary(`Found ${found.length} job(s). View them in Jobs.`)
      }
    } catch (err: any) {
      setSearchSummary(err?.message || 'Search failed. Check provider keys and conditions.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/find')}
          className="p-2 text-gray-400 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">API Search</h1>
          <p className="text-gray-500 mt-1">Search via JSearch and Adzuna APIs</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
            <select
              value={searchForm.country}
              onChange={(e) => setSearchForm((s) => ({ ...s, country: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="us">United States</option>
              <option value="gb">United Kingdom</option>
              <option value="europe">Europe (All)</option>
              <option value="de">Germany</option>
              <option value="fr">France</option>
              <option value="nl">Netherlands</option>
              <option value="pl">Poland</option>
              <option value="it">Italy</option>
              <option value="es">Spain</option>
              <option value="at">Austria</option>
              <option value="be">Belgium</option>
              <option value="ch">Switzerland</option>
              <option value="au">Australia</option>
              <option value="ca">Canada</option>
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
        </div>

        {/* Source toggles */}
        <div className="mt-6 flex flex-wrap gap-6">
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
        </div>

        {/* Action */}
        <div className="mt-6 flex items-center gap-4">
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            Search
          </button>
          {searchSummary && <span className="text-sm text-gray-500">{searchSummary}</span>}
        </div>
      </div>

      {/* Link to view results */}
      {searchSummary && searchSummary.includes('Found') && !searchSummary.includes('Found 0') && (
        <button
          onClick={() => navigate('/jobs')}
          className="w-full py-3 bg-emerald-50 text-emerald-700 text-sm font-medium rounded-xl hover:bg-emerald-100 transition-colors"
        >
          View found jobs
        </button>
      )}
    </div>
  )
}
