import { useEffect, useState } from 'react'
import { useJobStore, type Job } from '../stores/jobStore'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Star, ExternalLink, Loader2, Send, Trash2 } from 'lucide-react'

function sanitizeText(value: string | null | undefined) {
  return (value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function readableRemoteType(remoteType: string) {
  if (!remoteType) return ''
  if (remoteType === 'onsite') return 'On-site'
  return remoteType.charAt(0).toUpperCase() + remoteType.slice(1)
}

function salaryLabel(job: Job) {
  const hasMin = job.salary_min !== null && job.salary_min !== undefined
  const hasMax = job.salary_max !== null && job.salary_max !== undefined
  if (!hasMin && !hasMax) return ''

  const fmt = (value: number | null) => (value === null ? '' : `$${new Intl.NumberFormat('en-US').format(value)}`)
  if (hasMin && hasMax) return `${fmt(job.salary_min)} - ${fmt(job.salary_max)}`
  if (hasMin) return `From ${fmt(job.salary_min)}`
  return `Up to ${fmt(job.salary_max)}`
}

function displayJobTitle(job: Job) {
  const raw = sanitizeText(job.title)
  const lowered = raw.toLowerCase()
  if (raw && lowered !== 'embed') return raw

  if (job.url) {
    try {
      const parts = new URL(job.url).pathname.split('/').filter(Boolean)
      const slug = parts.at(-1) || parts.at(-2)
      if (slug && slug.length > 2) {
        return slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
      }
    } catch {
      // Invalid URL: use fallback title below.
    }
  }

  return 'Open Position'
}

export default function JobsList() {
  const { jobs, loading, error, fetchJobs, createJob, scoreJob, deleteJob } = useJobStore()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', company: '', description: '', url: '', location: '', remote_type: '' })
  const [scoring, setScoring] = useState<number | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  const handleCreate = async () => {
    if (!form.title || !form.company || !form.description) return
    try {
      const job = await createJob(form)
      setForm({ title: '', company: '', description: '', url: '', location: '', remote_type: '' })
      setShowForm(false)
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/jobs')}
            className="p-2 text-gray-400 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Saved Jobs</h1>
            <p className="text-gray-500 mt-1">Manage your job listings and AI scores</p>
          </div>
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
          <p className="text-gray-400">No jobs yet. Add a job manually or find new ones.</p>
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
  const salary = salaryLabel(job)
  const remote = readableRemoteType(job.remote_type)
  const descriptionPreview = sanitizeText(job.description)

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-300 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-gray-900">{displayJobTitle(job)}</h3>
            {job.fit_score !== null && <FitScoreBadge score={job.fit_score} />}
            {job.category && (
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-50 text-indigo-700">
                {job.category}
              </span>
            )}
            {job.priority && (
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-orange-50 text-orange-700 capitalize">
                {job.priority} priority
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {job.company}
            {job.location && ` · ${job.location}`}
          </p>
          {(remote || salary) && (
            <p className="text-xs text-gray-500 mt-1">
              {remote}
              {remote && salary ? ' · ' : ''}
              {salary}
            </p>
          )}
          {descriptionPreview && (
            <p className="text-xs text-gray-600 mt-2 line-clamp-3">{descriptionPreview}</p>
          )}
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
          {job.status === 'discovered' && (
            <Link
              to={`/apply?jobId=${job.id}`}
              className="px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 inline-flex items-center gap-1"
            >
              <Send size={12} />
              Apply
            </Link>
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
        {job.link_type === 'expired' && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">Expired</span>
        )}
        {job.link_type === 'board' && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Job Board</span>
        )}
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
