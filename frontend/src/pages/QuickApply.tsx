import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  Send,
  AlertCircle,
  CheckCircle,
  RefreshCw,
} from 'lucide-react'
import { useProfileStore } from '../stores/profileStore'

interface JobDetails {
  title: string
  company: string
  description: string
  link: string
  company_info?: string
}

type Step = 'input' | 'confirming' | 'generating' | 'reviewing' | 'applied'

export default function QuickApply() {
  const navigate = useNavigate()
  const { profile } = useProfileStore()
  const [inputLink, setInputLink] = useState('')
  const [currentStep, setCurrentStep] = useState<Step>('input')
  const [error, setError] = useState('')
  const [jobDetails, setJobDetails] = useState<JobDetails | null>(null)
  const [coverLetter, setCoverLetter] = useState('')
  const [editingCoverLetter, setEditingCoverLetter] = useState(false)
  const [savingApply, setSavingApply] = useState(false)
  const [copyFeedback, setCopyFeedback] = useState('')
  const [isScraping, setIsScraping] = useState(false)
  const [isRefining, setIsRefining] = useState(false)
  const [refineFeedback, setRefineFeedback] = useState('')

  // Step 1: Extract job details from URL
  const handleScrapeJob = useCallback(async () => {
    if (!inputLink.trim()) {
      setError('Please enter a job link')
      return
    }

    setCurrentStep('confirming')
    setError('')
    setIsScraping(true)

    try {
      const response = await fetch('/api/apply/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: inputLink.trim() }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `Failed to scrape job (${response.status})`)
      }

      const data: JobDetails = await response.json()
      setJobDetails(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to scrape job details'
      setError(message)
    } finally {
      setIsScraping(false)
    }
  }, [inputLink])

  // Step 2: User confirms details, generate cover letter
  const handleGenerateCoverLetter = useCallback(async () => {
    if (!jobDetails || !profile) return

    setCurrentStep('generating')
    setError('')

    try {
      const response = await fetch('/api/apply/generate-cover-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job: jobDetails }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `Failed to generate cover letter (${response.status})`)
      }

      const data = await response.json()
      setCoverLetter(data.cover_letter)
      setCurrentStep('reviewing')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate cover letter'
      setError(message)
      setCurrentStep('confirming')
    }
  }, [jobDetails, profile])

  const handleRefineCoverLetter = async () => {
    if (!coverLetter || !refineFeedback.trim()) return

    setIsRefining(true)
    setError('')

    try {
      const response = await fetch('/api/apply/refine-cover-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cover_letter: coverLetter, feedback: refineFeedback }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `Failed to refine cover letter (${response.status})`)
      }

      const data = await response.json()
      setCoverLetter(data.cover_letter)
      setRefineFeedback('')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to refine cover letter'
      setError(message)
    } finally {
      setIsRefining(false)
    }
  }

  // Step 3: Save application
  const handleApplied = async () => {
    if (!jobDetails) return

    setSavingApply(true)
    try {
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: jobDetails.title,
          company: jobDetails.company,
          description: jobDetails.description,
          url: jobDetails.link,
          source: 'manual',
          status: 'applied',
          cover_letter: coverLetter,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save application')
      }

      setCurrentStep('applied')
      // Reset after 2 seconds
      setTimeout(() => {
        setCurrentStep('input')
        setJobDetails(null)
        setCoverLetter('')
        setInputLink('')
      }, 2000)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save application'
      setError(message)
    } finally {
      setSavingApply(false)
    }
  }

  const handleCopyCoverLetter = async () => {
    await navigator.clipboard.writeText(coverLetter)
    setCopyFeedback('Cover letter copied')
    setTimeout(() => setCopyFeedback(''), 1500)
  }

  const handleReset = () => {
    setCurrentStep('input')
    setJobDetails(null)
    setCoverLetter('')
    setInputLink('')
    setError('')
  }

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
          <h1 className="text-2xl font-bold text-gray-900">Quick Apply</h1>
          <p className="text-gray-500 mt-1">Paste a job link → verify details → generate cover letter</p>
        </div>
      </div>

      {/* Progress Indicator */}
      {currentStep !== 'input' && (
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 text-sm font-medium">
            <div className="flex items-center gap-2 text-blue-600">
              <CheckCircle2 size={20} className="text-green-600" />
              <span>Details Extracted</span>
            </div>
            <div className="w-8 h-px bg-gray-300" />
            <div className={`flex items-center gap-2 ${['generating', 'reviewing', 'applied'].includes(currentStep) ? 'text-blue-600' : 'text-gray-400'}`}>
              {['generating', 'reviewing', 'applied'].includes(currentStep) ? (
                <CheckCircle2 size={20} className="text-green-600" />
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
              )}
              <span>Cover Letter</span>
            </div>
            <div className="w-8 h-px bg-gray-300" />
            <div className={`flex items-center gap-2 ${currentStep === 'applied' ? 'text-green-600' : 'text-gray-400'}`}>
              {currentStep === 'applied' ? (
                <CheckCircle2 size={20} className="text-green-600" />
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
              )}
              <span>Applied</span>
            </div>
          </div>
        </div>
      )}

      {/* Step 1: Input Link */}
      {(currentStep === 'input' || (currentStep === 'confirming' && !jobDetails)) && (
        <section className="bg-white border border-gray-200 rounded-xl p-8 max-w-2xl mx-auto">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Job Posting Link</label>
              <input
                type="url"
                value={inputLink}
                onChange={(e) => {
                  setInputLink(e.target.value)
                  setError('')
                }}
                placeholder="https://jobs.lever.co/... or https://boards.greenhouse.io/..."
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleScrapeJob()
                  }
                }}
              />
              <p className="text-xs text-gray-400 mt-2">Works with LinkedIn, Greenhouse, Lever, Ashby, Indeed, and most job boards</p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex gap-3">
                <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <button
              onClick={handleScrapeJob}
              disabled={!inputLink.trim() || isScraping}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isScraping ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Extracting Job Details...
                </>
              ) : (
                <>
                  <Send size={18} />
                  Extract Job Details
                </>
              )}
            </button>
          </div>
        </section>
      )}

      {/* Step 2: Confirm Job Details */}
      {currentStep === 'confirming' && jobDetails && (
        <div className="space-y-6 max-w-4xl mx-auto">
          <section className="bg-white border border-blue-200 rounded-xl p-6 ring-1 ring-blue-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CheckCircle size={20} className="text-blue-600" />
              Job Details Extracted
            </h2>

            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Company</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{jobDetails.company}</p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Position</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{jobDetails.title}</p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Job Description</p>
                <p className="text-gray-700 leading-relaxed border-l-4 border-gray-200 pl-4 text-sm">
                  {jobDetails.description}
                </p>
              </div>

              {jobDetails.company_info && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Company Background</p>
                  <p className="text-gray-600 text-sm leading-relaxed border-l-4 border-gray-200 pl-4">
                    {jobDetails.company_info}
                  </p>
                </div>
              )}

              <a
                href={jobDetails.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium mt-2"
              >
                View full posting
                <ExternalLink size={14} />
              </a>
            </div>
          </section>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex gap-3">
              <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleGenerateCoverLetter}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
            >
              <Send size={18} />
              Proceed to Cover Letter
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Generating Cover Letter */}
      {currentStep === 'generating' && (
        <section className="bg-white border border-gray-200 rounded-xl p-8 max-w-2xl mx-auto text-center">
          <Loader2 size={48} className="text-blue-600 mx-auto mb-4 animate-spin" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Generating Cover Letter</h2>
          <p className="text-gray-500">Using your profile and job details to create a tailored cover letter...</p>
        </section>
      )}

      {/* Step 4: Review & Edit Cover Letter */}
      {currentStep === 'reviewing' && jobDetails && (
        <div className="space-y-6 max-w-4xl mx-auto">
          {/* Job Details Summary */}
          <section className="bg-gray-50 border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Position: {jobDetails.title} @ {jobDetails.company}</h3>
            <a
              href={jobDetails.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 text-xs font-medium"
            >
              View posting <ExternalLink size={12} />
            </a>
          </section>

          {/* Cover Letter */}
          <section className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Your Cover Letter</h3>
              <div className="flex items-center gap-2">
                {copyFeedback && (
                  <span className="text-xs text-green-600 font-medium">{copyFeedback}</span>
                )}
                <button
                  onClick={handleCopyCoverLetter}
                  className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Copy to clipboard"
                >
                  <Copy size={18} />
                </button>
              </div>
            </div>

            {editingCoverLetter ? (
              <div className="space-y-3">
                <textarea
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  className="w-full h-96 px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                />
                <button
                  onClick={() => setEditingCoverLetter(false)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
                >
                  Done Editing
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">
                  {coverLetter}
                </div>
                <button
                  onClick={() => setEditingCoverLetter(true)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Edit
                </button>
              </div>
            )}
          </section>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex gap-3">
              <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Actions - moved to the bottom of the left column if we split it, but keep it here for now */}
          {!editingCoverLetter && (
            <>
              {/* Refinement panel */}
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h3 className="font-semibold text-sm mb-3">Refine Cover Letter</h3>
                <textarea
                  value={refineFeedback}
                  onChange={(e) => setRefineFeedback(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Make it shorter, emphasize Python more, more formal tone..."
                />
                <button
                  onClick={handleRefineCoverLetter}
                  disabled={isRefining || !refineFeedback.trim()}
                  className="mt-3 w-full px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                >
                  {isRefining ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                  Refine with AI
                </button>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleReset}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Start Over
                </button>
                <button
                  onClick={handleApplied}
                  disabled={savingApply}
                  className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
                >
                  {savingApply ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={18} />
                      Mark as Applied
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Step 5: Applied Confirmation */}
      {currentStep === 'applied' && (
        <section className="bg-white border border-green-200 rounded-xl p-8 max-w-2xl mx-auto text-center">
          <CheckCircle2 size={48} className="text-green-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Application Saved!</h2>
          <p className="text-gray-500 mb-6">Your application has been saved to the tracker.</p>
          <button
            onClick={handleReset}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Apply to Another Job
          </button>
        </section>
      )}
    </div>
  )
}

