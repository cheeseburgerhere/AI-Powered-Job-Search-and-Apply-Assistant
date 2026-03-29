import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  Save,
  Send,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  X,
  Download,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { useProfileStore } from '../stores/profileStore'

interface JobDetails {
  title: string
  company: string
  description: string
  link: string
  company_info?: string
  company_website?: string
}

interface WebsiteContextFindings {
  company: string
  company_website: string
  context_summary: string
}

interface CoverLetterVersion {
  id: number
  job_id: number
  version: number
  content: string
  feedback: string | null
  status: string
}

type Step = 'input' | 'confirming' | 'generating' | 'reviewing' | 'documents' | 'applied'

export default function QuickApply() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { profile, fetchProfile } = useProfileStore()
  const [inputLink, setInputLink] = useState('')
  const [currentStep, setCurrentStep] = useState<Step>('input')
  const [error, setError] = useState('')
  const [jobDetails, setJobDetails] = useState<JobDetails | null>(null)
  const [coverLetter, setCoverLetter] = useState('')
  const [companyWebsite, setCompanyWebsite] = useState('')
  const [editingCoverLetter, setEditingCoverLetter] = useState(false)
  const [savingApply, setSavingApply] = useState(false)
  const [savingInterested, setSavingInterested] = useState(false)
  const [savedInterestedId, setSavedInterestedId] = useState<number | null>(null)
  const [copyFeedback, setCopyFeedback] = useState('')
  const [isScraping, setIsScraping] = useState(false)
  const [isRescraping, setIsRescraping] = useState(false)
  const [isRefining, setIsRefining] = useState(false)
  const [isSavingManualEdit, setIsSavingManualEdit] = useState(false)
  const [refineFeedback, setRefineFeedback] = useState('')
  const [websiteFindings, setWebsiteFindings] = useState<WebsiteContextFindings | null>(null)
  const [isFetchingWebsiteFindings, setIsFetchingWebsiteFindings] = useState(false)
  const [versions, setVersions] = useState<CoverLetterVersion[]>([])
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null)
  const [currentStepChatInput, setCurrentStepChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [isChatting, setIsChatting] = useState(false)

  const loadCoverLetterVersions = useCallback(async (jobId: number) => {
    const response = await fetch(`/api/cover-letters?job_id=${jobId}`)
    if (!response.ok) {
      throw new Error('Failed to load cover letter versions')
    }
    const letters: CoverLetterVersion[] = await response.json()
    setVersions(letters)
    return letters
  }, [])

  useEffect(() => {
    if (!profile) {
      void fetchProfile()
    }
  }, [profile, fetchProfile])

  useEffect(() => {
    const jobIdParam = searchParams.get('jobId')
    if (!jobIdParam) return

    const jobId = Number(jobIdParam)
    if (!Number.isInteger(jobId) || jobId <= 0) return

    let isCancelled = false

    const loadJob = async () => {
      try {
        const response = await fetch(`/api/jobs/${jobId}`)
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.detail || `Failed to load job (${response.status})`)
        }

        const data: {
          id: number
          title: string
          company: string
          description: string
          url: string | null
          status: string
        } = await response.json()

        if (isCancelled) return

        setJobDetails({
          title: data.title,
          company: data.company,
          description: data.description,
          link: data.url || '',
        })
        setInputLink(data.url || '')
        setCurrentStep('confirming')
        setError('')
        setSavedInterestedId(data.id)
        setCompanyWebsite('')
        setWebsiteFindings(null)

        const letters = await loadCoverLetterVersions(data.id)
        if (letters.length > 0) {
          setSelectedVersionId(letters[0].id)
          setCoverLetter(letters[0].content)
        } else {
          setSelectedVersionId(null)
          setCoverLetter('')
        }
      } catch (err) {
        if (isCancelled) return
        const message = err instanceof Error ? err.message : 'Failed to load selected job'
        setError(message)
      }
    }

    void loadJob()

    return () => {
      isCancelled = true
    }
  }, [searchParams, loadCoverLetterVersions])

  // Step 1: Extract job details from URL
  const handleScrapeJob = useCallback(async () => {
    if (!inputLink.trim()) {
      setError('Please enter a job link')
      return
    }

    setCurrentStep('confirming')
    setError('')
    setIsScraping(true)
    setSavedInterestedId(null)
    setVersions([])
    setSelectedVersionId(null)
    setCoverLetter('')
    setWebsiteFindings(null)

    try {
      const response = await fetch('/api/apply/scrape/debug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: inputLink.trim() }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `Failed to scrape job (${response.status})`)
      }

      const data: {
        title: string
        company: string
        description: string
        company_info?: string
        extraction_method?: string
        confidence?: number
        scraper_used?: string
        html_length?: number
        raw_text?: string
      } = await response.json()
      setJobDetails({
        title: data.title,
        company: data.company,
        description: data.description,
        link: inputLink.trim(),
        company_info: data.company_info || '',
      })
      setCompanyWebsite('')
      setWebsiteFindings(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to scrape job details'
      setError(message)
    } finally {
      setIsScraping(false)
    }
  }, [inputLink])

  const handleRescrapeJob = useCallback(async () => {
    const url = (jobDetails?.link || inputLink).trim()
    if (!url) {
      setError('No job link available to scrape again')
      return
    }

    setError('')
    setIsRescraping(true)

    try {
      const response = await fetch('/api/apply/scrape/debug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `Failed to re-scrape job (${response.status})`)
      }

      const data: {
        title: string
        company: string
        description: string
        company_info?: string
        extraction_method?: string
        confidence?: number
        scraper_used?: string
        html_length?: number
        raw_text?: string
      } = await response.json()
      setJobDetails({
        title: data.title,
        company: data.company,
        description: data.description,
        link: url,
        company_info: data.company_info || '',
      })
      setInputLink(url)
      setWebsiteFindings(null)
      if (savedInterestedId) {
        await fetch(`/api/jobs/${savedInterestedId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: data.title,
            company: data.company,
            description: data.description,
            url,
          }),
        })
      }
      if (currentStep === 'reviewing') {
        setCurrentStep('confirming')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to scrape job details again'
      setError(message)
    } finally {
      setIsRescraping(false)
    }
  }, [jobDetails?.link, inputLink, currentStep, savedInterestedId])

  const handleSaveInterested = useCallback(async () => {
    if (!jobDetails || savingInterested || savedInterestedId) return

    setSavingInterested(true)
    setError('')

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
          status: 'interested',
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `Failed to save job (${response.status})`)
      }

      const data: { id: number } = await response.json()
      setSavedInterestedId(data.id)
      const letters = await loadCoverLetterVersions(data.id)
      if (letters.length > 0) {
        setSelectedVersionId(letters[0].id)
        setCoverLetter(letters[0].content)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save to interested'
      setError(message)
    } finally {
      setSavingInterested(false)
    }
  }, [jobDetails, savingInterested, savedInterestedId, loadCoverLetterVersions])

  // Step 2: User confirms details, generate cover letter
  const handleGenerateCoverLetter = useCallback(async () => {
    if (!jobDetails) return

    if (!useProfileStore.getState().profile) {
      await useProfileStore.getState().fetchProfile()
    }

    if (!useProfileStore.getState().profile) {
      setError('Profile not set up. Please complete onboarding before generating a cover letter.')
      return
    }

    setCurrentStep('generating')
    setError('')

    try {
      if (savedInterestedId) {
        const existing = await loadCoverLetterVersions(savedInterestedId)
        if (existing.length > 0) {
          setSelectedVersionId(existing[0].id)
          setCoverLetter(existing[0].content)
          setCurrentStep('reviewing')
          return
        }

        const generatedResponse = await fetch('/api/cover-letters/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            job_id: savedInterestedId,
            company_website: companyWebsite.trim() || undefined,
            company_context: websiteFindings?.context_summary || undefined,
          }),
        })

        if (!generatedResponse.ok) {
          const errorData = await generatedResponse.json().catch(() => ({}))
          throw new Error(errorData.detail || `Failed to generate cover letter (${generatedResponse.status})`)
        }

        const generated: CoverLetterVersion = await generatedResponse.json()
        const refreshed = await loadCoverLetterVersions(savedInterestedId)
        setSelectedVersionId(generated.id)
        setCoverLetter(generated.content)
        setVersions(refreshed)
        setCurrentStep('reviewing')
        return
      }

      const response = await fetch('/api/apply/generate-cover-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job: {
            ...jobDetails,
            company_website: companyWebsite.trim(),
            company_info: [jobDetails.company_info, websiteFindings?.context_summary].filter(Boolean).join('\n\n'),
          },
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `Failed to generate cover letter (${response.status})`)
      }

      const data = await response.json()
      setCoverLetter(data.cover_letter)
      setSelectedVersionId(null)
      setCurrentStep('reviewing')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate cover letter'
      setError(message)
      setCurrentStep('confirming')
    }
  }, [jobDetails, savedInterestedId, companyWebsite, websiteFindings?.context_summary, loadCoverLetterVersions])

  const handleRefineCoverLetter = async () => {
    if (!coverLetter || !refineFeedback.trim()) return

    setIsRefining(true)
    setError('')

    try {
      if (selectedVersionId && savedInterestedId) {
        const response = await fetch(`/api/cover-letters/${selectedVersionId}/refine`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ feedback: refineFeedback }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.detail || `Failed to refine cover letter (${response.status})`)
        }

        const newVersion: CoverLetterVersion = await response.json()
        const refreshed = await loadCoverLetterVersions(savedInterestedId)
        setVersions(refreshed)
        setSelectedVersionId(newVersion.id)
        setCoverLetter(newVersion.content)
        setRefineFeedback('')
        return
      }

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
      const endpoint = savedInterestedId ? `/api/jobs/${savedInterestedId}` : '/api/jobs'
      const method = savedInterestedId ? 'PUT' : 'POST'
      const payload = savedInterestedId
        ? {
            status: 'applied',
            ...(selectedVersionId ? {} : { cover_letter: coverLetter }),
          }
        : {
            title: jobDetails.title,
            company: jobDetails.company,
            description: jobDetails.description,
            url: jobDetails.link,
            source: 'manual',
            status: 'applied',
            cover_letter: coverLetter,
          }

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
        setVersions([])
        setSelectedVersionId(null)
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

  const handleDownloadPdf = async () => {
    if (!selectedVersionId || !jobDetails) return
    try {
      const response = await fetch(`/api/cover-letters/${selectedVersionId}/download`)
      if (!response.ok) {
        throw new Error('Failed to download PDF')
      }
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = response.headers.get('content-disposition')?.split('filename=')[1]?.replace(/"/g, '') || 'cover_letter.pdf'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error('Error downloading PDF:', err)
      alert('Failed to download PDF')
    }
  }

  const handleDownloadCoverLetterPdf = async () => {
    if (!jobDetails) return

    try {
      const response = selectedVersionId
        ? await fetch(`/api/cover-letters/${selectedVersionId}/download`)
        : await fetch('/api/apply/cover-letter/pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cover_letter: coverLetter }),
          })

      if (!response.ok) {
        throw new Error('Failed to download cover letter PDF')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = response.headers.get('content-disposition')?.split('filename=')[1]?.replace(/"/g, '') || 'cover_letter.pdf'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error('Error downloading cover letter PDF:', err)
      alert('Failed to download cover letter PDF')
    }
  }

  const handleDownloadResumePdf = async () => {
    try {
      const response = await fetch('/api/profile/resume/download')
      if (!response.ok) {
        throw new Error('Failed to download resume PDF')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = response.headers.get('content-disposition')?.split('filename=')[1]?.replace(/"/g, '') || 'resume.pdf'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error('Error downloading resume PDF:', err)
      alert('Failed to download resume PDF')
    }
  }

  const handleProceedToDocuments = () => {
    setCurrentStep('documents')
  }

  const handleSendApplyChat = async () => {
    if (!currentStepChatInput.trim() || !jobDetails) return

    const question = currentStepChatInput.trim()
    setCurrentStepChatInput('')
    setChatMessages((prev) => [...prev, { role: 'user', content: question }])
    setIsChatting(true)

    try {
      const response = await fetch('/api/apply/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          job: jobDetails,
          cover_letter: coverLetter,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || 'Failed to get an answer')
      }

      const data: { answer: string } = await response.json()
      setChatMessages((prev) => [...prev, { role: 'assistant', content: data.answer }])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get an answer'
      setChatMessages((prev) => [...prev, { role: 'assistant', content: message }])
    } finally {
      setIsChatting(false)
    }
  }


  const handleReset = () => {
    setCurrentStep('input')
    setJobDetails(null)
    setCoverLetter('')
    setInputLink('')
    setError('')
    setSavedInterestedId(null)
    setCompanyWebsite('')
    setWebsiteFindings(null)
    setVersions([])
    setSelectedVersionId(null)
    setChatMessages([])
    setCurrentStepChatInput('')
  }

  const handleFetchWebsiteFindings = useCallback(async () => {
    if (!jobDetails?.company || !companyWebsite.trim()) {
      setError('Enter a company website to fetch additional context')
      return
    }

    setError('')
    setIsFetchingWebsiteFindings(true)
    try {
      const response = await fetch('/api/apply/company-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: jobDetails.company,
          company_website: companyWebsite.trim(),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `Failed to fetch website findings (${response.status})`)
      }

      const data: WebsiteContextFindings = await response.json()
      setWebsiteFindings(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch website findings'
      setError(message)
    } finally {
      setIsFetchingWebsiteFindings(false)
    }
  }, [jobDetails?.company, companyWebsite])

  const handleSelectVersion = (versionId: number) => {
    const selected = versions.find((v) => v.id === versionId)
    if (!selected) return
    setSelectedVersionId(selected.id)
    setCoverLetter(selected.content)
    setEditingCoverLetter(false)
  }

  const handleSaveManualEdit = async () => {
    if (!coverLetter.trim()) return

    if (!savedInterestedId || !selectedVersionId) {
      setEditingCoverLetter(false)
      return
    }

    setIsSavingManualEdit(true)
    setError('')
    try {
      const response = await fetch(`/api/cover-letters/${selectedVersionId}/manual-version`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: coverLetter,
          feedback: 'Manual edit',
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `Failed to save manual version (${response.status})`)
      }

      const newVersion: CoverLetterVersion = await response.json()
      const refreshed = await loadCoverLetterVersions(savedInterestedId)
      setVersions(refreshed)
      setSelectedVersionId(newVersion.id)
      setCoverLetter(newVersion.content)
      setEditingCoverLetter(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save manual edit'
      setError(message)
    } finally {
      setIsSavingManualEdit(false)
    }
  }

  const handleCancelManualEdit = () => {
    if (selectedVersionId) {
      const active = versions.find((v) => v.id === selectedVersionId)
      if (active) {
        setCoverLetter(active.content)
      }
    }
    setEditingCoverLetter(false)
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
        {(jobDetails?.link || inputLink.trim()) && (
          <button
            onClick={handleRescrapeJob}
            disabled={isRescraping || isScraping}
            className="ml-auto px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors text-sm font-medium inline-flex items-center gap-2"
          >
            {isRescraping ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Scrape Again
          </button>
        )}
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
            <div className={`flex items-center gap-2 ${['generating', 'reviewing', 'documents', 'applied'].includes(currentStep) ? 'text-blue-600' : 'text-gray-400'}`}>
              {['generating', 'reviewing', 'documents', 'applied'].includes(currentStep) ? (
                <CheckCircle2 size={20} className="text-green-600" />
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
              )}
              <span>Cover Letter</span>
            </div>
            <div className="w-8 h-px bg-gray-300" />
            <div className={`flex items-center gap-2 ${['documents', 'applied'].includes(currentStep) ? 'text-blue-600' : 'text-gray-400'}`}>
              {['documents', 'applied'].includes(currentStep) ? (
                <CheckCircle2 size={20} className="text-green-600" />
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
              )}
              <span>Documents</span>
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
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <CheckCircle size={20} className="text-blue-600" />
                Job Details Extracted
              </h2>

            </div>

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

              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Company Website (Optional)
                </label>
                <input
                  type="url"
                  value={companyWebsite}
                  onChange={(e) => {
                    setCompanyWebsite(e.target.value)
                    setWebsiteFindings(null)
                  }}
                  placeholder="https://company.com"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Fetch extra website context before generating a cover letter.
                </p>
                <button
                  type="button"
                  onClick={handleFetchWebsiteFindings}
                  disabled={!companyWebsite.trim() || isFetchingWebsiteFindings}
                  className="mt-2 px-3 py-2 bg-slate-800 text-white text-xs font-medium rounded-lg hover:bg-slate-900 disabled:bg-slate-300 disabled:cursor-not-allowed inline-flex items-center gap-2"
                >
                  {isFetchingWebsiteFindings ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  Fetch Website Context
                </button>
              </div>

              <a
                href={jobDetails.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium mt-2"
              >
                View full posting
                <ExternalLink size={14} />
              </a>

              {websiteFindings && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                  <p className="text-xs font-medium text-emerald-900 uppercase tracking-wide mb-2">Website Context Findings</p>
                  <div className="text-xs text-emerald-900 mb-2">
                    <span className="font-medium">Source:</span> {websiteFindings.company_website}
                  </div>
                  <div className="text-xs text-gray-900 bg-white border border-emerald-100 rounded-md p-3 max-h-44 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                    {websiteFindings.context_summary || 'No additional context found from the website yet.'}
                  </div>
                </div>
              )}


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
              onClick={handleSaveInterested}
              disabled={savingInterested || !!savedInterestedId}
              className="flex-1 px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:bg-amber-200 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
            >
              {savingInterested ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Saving to Interested...
                </>
              ) : savedInterestedId ? (
                <>
                  <CheckCircle2 size={18} />
                  Saved to Interested
                </>
              ) : (
                <>
                  <CheckCircle2 size={18} />
                  Save to Interested
                </>
              )}
            </button>
            <button
              onClick={handleGenerateCoverLetter}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
            >
              <Send size={18} />
              Proceed to Cover Letter
            </button>
          </div>

          {savedInterestedId && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800 flex items-center justify-between gap-3">
              <span>Saved to tracker Interested board.</span>
              <button
                onClick={() => navigate('/tracker')}
                className="font-medium text-green-900 hover:text-green-700"
              >
                Open Tracker
              </button>
            </div>
          )}
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
            {companyWebsite.trim() && (
              <p className="text-xs text-gray-600 mb-2">Company website context: {companyWebsite.trim()}</p>
            )}
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
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-gray-900">Your Cover Letter</h3>
                {selectedVersionId && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                    v{versions.find((v) => v.id === selectedVersionId)?.version}
                  </span>
                )}
              </div>
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
                <button
                  onClick={handleDownloadPdf}
                  disabled={!selectedVersionId}
                  className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                  title="Download as PDF"
                >
                  <Download size={18} />
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
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveManualEdit}
                    disabled={isSavingManualEdit || !coverLetter.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-2"
                  >
                    {isSavingManualEdit ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    Save as New Version
                  </button>
                  <button
                    onClick={handleCancelManualEdit}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium flex items-center gap-2"
                  >
                    <X size={16} />
                    Cancel
                  </button>
                </div>
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

          {versions.length > 1 && (
            <section className="bg-white border border-gray-200 rounded-xl p-6">
              <h3 className="font-semibold text-sm mb-3">Version History</h3>
              <div className="space-y-2">
                {versions.map((version) => (
                  <button
                    key={version.id}
                    type="button"
                    onClick={() => handleSelectVersion(version.id)}
                    className={`w-full text-left text-xs p-2 rounded-lg border transition-colors ${
                      version.id === selectedVersionId
                        ? 'border-blue-200 bg-blue-50'
                        : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <span className="font-medium">v{version.version}</span>
                    <span className="text-gray-500 ml-2">{version.status}</span>
                    {version.feedback && (
                      <p className="text-gray-400 mt-1 truncate">"{version.feedback}"</p>
                    )}
                  </button>
                ))}
              </div>
            </section>
          )}

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
                {savedInterestedId && versions.length > 0 && (
                  <p className="text-xs text-gray-500 mb-3">
                    Existing versions found. Selecting and refining versions here saves extra AI generation calls.
                  </p>
                )}
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
                  onClick={handleProceedToDocuments}
                  disabled={savingApply}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
                >
                  {savingApply ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={18} />
                      Continue to Documents
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Step 5: Documents & AI Chat */}
      {currentStep === 'documents' && jobDetails && (
        <div className="space-y-6 max-w-4xl mx-auto">
          <section className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Download Application Files</h3>
            <p className="text-sm text-gray-500 mb-4">Grab your latest CV and cover letter PDFs.</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleDownloadResumePdf}
                className="flex-1 px-4 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors font-medium flex items-center justify-center gap-2"
              >
                <Download size={18} />
                Download CV (PDF)
              </button>
              <button
                onClick={handleDownloadCoverLetterPdf}
                disabled={!coverLetter.trim()}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
              >
                <Download size={18} />
                Download Cover Letter (PDF)
              </button>
            </div>
          </section>

          <section className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Ask Anything</h3>
            <p className="text-sm text-gray-500 mb-4">Get AI help for unusual requirements or last-minute questions.</p>
            <div className="space-y-3">
              <div className="max-h-64 overflow-y-auto space-y-2 border border-gray-200 rounded-lg p-3 bg-gray-50">
                {chatMessages.length === 0 ? (
                  <p className="text-sm text-gray-500">No questions yet. Ask about custom requirements or tweaks.</p>
                ) : (
                  chatMessages.map((msg, idx) => (
                    <div
                      key={`${msg.role}-${idx}`}
                      className={`text-sm rounded-lg px-3 py-2 shadow-sm ${
                        msg.role === 'user'
                          ? 'bg-gradient-to-r from-blue-600 to-sky-500 text-white'
                          : 'bg-slate-900 text-slate-100 border border-slate-800'
                      }`}
                    >
                      <ReactMarkdown className="prose prose-sm max-w-none prose-p:my-2 prose-ul:my-2 prose-ol:my-2">
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={currentStepChatInput}
                  onChange={(e) => setCurrentStepChatInput(e.target.value)}
                  placeholder="Ask about anything unusual for this application..."
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSendApplyChat()
                    }
                  }}
                />
                <button
                  onClick={handleSendApplyChat}
                  disabled={isChatting || !currentStepChatInput.trim()}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {isChatting ? 'Thinking...' : 'Ask'}
                </button>
              </div>
            </div>
          </section>

          <div className="flex gap-3">
            <button
              onClick={() => setCurrentStep('reviewing')}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Back to Cover Letter
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

