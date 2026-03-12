import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCoverLetterStore } from '../stores/coverLetterStore'
import { useJobStore } from '../stores/jobStore'
import { Loader2, Copy, Check, RefreshCw, CheckCircle2 } from 'lucide-react'

export default function CoverLetterEditor() {
  const [searchParams] = useSearchParams()
  const jobIdParam = searchParams.get('job_id')
  const { jobs, fetchJobs } = useJobStore()
  const { letters, loading, error, fetchLetters, generate, refine, updateStatus } = useCoverLetterStore()
  const [selectedJobId, setSelectedJobId] = useState<number | null>(jobIdParam ? parseInt(jobIdParam) : null)
  const [feedback, setFeedback] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  useEffect(() => {
    if (selectedJobId) {
      fetchLetters(selectedJobId)
    }
  }, [selectedJobId, fetchLetters])

  const selectedJob = jobs.find((j) => j.id === selectedJobId)
  const latestLetter = letters.length > 0 ? letters[0] : null

  const handleGenerate = async () => {
    if (!selectedJobId) return
    await generate(selectedJobId)
  }

  const handleRefine = async () => {
    if (!latestLetter || !feedback.trim()) return
    await refine(latestLetter.id, feedback)
    setFeedback('')
  }

  const handleCopy = () => {
    if (!latestLetter) return
    navigator.clipboard.writeText(latestLetter.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleMarkReady = async () => {
    if (!latestLetter) return
    await updateStatus(latestLetter.id, latestLetter.status === 'ready' ? 'draft' : 'ready')
    if (selectedJobId) fetchLetters(selectedJobId)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Cover Letter Generator</h1>
        <p className="text-gray-500 mt-1">Generate tailored cover letters for your saved jobs</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>
      )}

      {/* Job Selector */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Select a Job</label>
        <select
          value={selectedJobId || ''}
          onChange={(e) => setSelectedJobId(e.target.value ? parseInt(e.target.value) : null)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Choose a job...</option>
          {jobs.map((job) => (
            <option key={job.id} value={job.id}>
              {job.title} at {job.company}
            </option>
          ))}
        </select>

        {selectedJob && (
          <div className="mt-4 bg-gray-50 rounded-lg p-4">
            <div className="font-medium text-sm">{selectedJob.title} at {selectedJob.company}</div>
            <p className="text-xs text-gray-500 mt-1 line-clamp-3">{selectedJob.description}</p>
          </div>
        )}

        {selectedJobId && !latestLetter && (
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Generate Cover Letter
          </button>
        )}
      </div>

      {/* Cover Letter Display */}
      {latestLetter && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Letter content */}
          <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold">Cover Letter</h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                  v{latestLetter.version}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    latestLetter.status === 'ready'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}
                >
                  {latestLetter.status}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-1"
                >
                  {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                <button
                  onClick={handleMarkReady}
                  className="px-3 py-1.5 text-xs font-medium bg-green-50 text-green-700 rounded-lg hover:bg-green-100 flex items-center gap-1"
                >
                  <CheckCircle2 size={14} />
                  {latestLetter.status === 'ready' ? 'Mark Draft' : 'Mark Ready'}
                </button>
              </div>
            </div>
            <div className="prose prose-sm max-w-none whitespace-pre-wrap text-gray-800 leading-relaxed">
              {latestLetter.content}
            </div>
          </div>

          {/* Refinement panel */}
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h3 className="font-semibold text-sm mb-3">Refine</h3>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={4}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Make it shorter, emphasize Python more, more formal tone..."
              />
              <button
                onClick={handleRefine}
                disabled={loading || !feedback.trim()}
                className="mt-3 w-full px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                Refine
              </button>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h3 className="font-semibold text-sm mb-3">Actions</h3>
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                Regenerate from Scratch
              </button>
            </div>

            {/* Version History */}
            {letters.length > 1 && (
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h3 className="font-semibold text-sm mb-3">Version History</h3>
                <div className="space-y-2">
                  {letters.map((l) => (
                    <div
                      key={l.id}
                      className={`text-xs p-2 rounded-lg border ${
                        l.id === latestLetter.id ? 'border-blue-200 bg-blue-50' : 'border-gray-100'
                      }`}
                    >
                      <span className="font-medium">v{l.version}</span>
                      <span className="text-gray-500 ml-2">{l.status}</span>
                      {l.feedback && (
                        <p className="text-gray-400 mt-1 truncate">"{l.feedback}"</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
