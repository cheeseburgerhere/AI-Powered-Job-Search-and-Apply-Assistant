import { useCallback, useState } from 'react'
import api, { errorDetail } from '../../api/client'
import type { CoverLetter } from '../../stores/coverLetterStore'
import type { Job } from '../../stores/jobStore'
import { downloadFile } from '../../lib/download'

export type ApplyStep = 'link' | 'details' | 'letter' | 'documents' | 'done'

export const STEPS: { key: ApplyStep; label: string }[] = [
  { key: 'link', label: 'Posting' },
  { key: 'details', label: 'Details' },
  { key: 'letter', label: 'Letter' },
  { key: 'documents', label: 'Documents' },
  { key: 'done', label: 'Applied' },
]

export interface PostingDetails {
  title: string
  company: string
  description: string
  link: string
  company_info?: string
}

type Busy = 'extract' | 'rescrape' | 'save' | 'context' | 'generate' | 'refine' | 'manual' | 'chat' | 'download' | 'applied' | null
/** Where unsaved letter text came from, recorded when it is finally stored with the job. */
type LetterOrigin = '' | 'server' | 'manual'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const byVersionDesc = (a: CoverLetter, b: CoverLetter) => b.version - a.version

/**
 * State and API calls for the apply flow. A job can be worked on before it is saved
 * (letter text lives here) or after (letters are real versions on the job).
 */
export function useApplyFlow() {
  const [step, setStep] = useState<ApplyStep>('link')
  const [link, setLink] = useState('')
  const [details, setDetails] = useState<PostingDetails | null>(null)
  const [jobId, setJobId] = useState<number | null>(null)
  const [website, setWebsite] = useState('')
  const [websiteContext, setWebsiteContext] = useState<string | null>(null)
  const [versions, setVersions] = useState<CoverLetter[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [letterText, setLetterText] = useState('')
  const [letterOrigin, setLetterOrigin] = useState<LetterOrigin>('')
  const [chat, setChat] = useState<ChatMessage[]>([])
  const [busy, setBusy] = useState<Busy>(null)
  const [error, setError] = useState<string | null>(null)

  const selected = versions.find((v) => v.id === selectedId) ?? null
  /** The letter the user is looking at: a saved version, or unsaved text for an unsaved job. */
  const currentLetter = selected ? selected.content : letterText

  /** Runs an action with a busy flag; resolves to false (with `error` set) when it fails. */
  const run = useCallback(async (kind: NonNullable<Busy>, action: () => Promise<void>, fallback: string) => {
    setBusy(kind)
    setError(null)
    try {
      await action()
      return true
    } catch (err) {
      setError(errorDetail(err, fallback))
      return false
    } finally {
      setBusy(null)
    }
  }, [])

  const loadVersions = useCallback(async (id: number, select?: number) => {
    const { data } = await api.get<CoverLetter[]>('/cover-letters', { params: { job_id: id } })
    const sorted = [...data].sort(byVersionDesc)
    setVersions(sorted)
    setSelectedId((current) => {
      if (select) return select
      if (current && sorted.some((v) => v.id === current)) return current
      return sorted[0]?.id ?? null
    })
    return sorted
  }, [])

  /** Poll-safe refresh used while waiting for the agent to save a draft. */
  const refreshVersions = useCallback(() => {
    if (jobId) loadVersions(jobId).catch(() => undefined)
  }, [jobId, loadVersions])

  const scrape = async (url: string) => {
    const { data } = await api.post('/apply/scrape/debug', { url })
    return {
      title: data.title,
      company: data.company,
      description: data.description,
      link: url,
      company_info: data.company_info || '',
    } satisfies PostingDetails
  }

  const reset = useCallback(() => {
    setStep('link')
    setLink('')
    setDetails(null)
    setJobId(null)
    setWebsite('')
    setWebsiteContext(null)
    setVersions([])
    setSelectedId(null)
    setLetterText('')
    setLetterOrigin('')
    setChat([])
    setError(null)
  }, [])

  const loadSavedJob = useCallback(
    (id: number) =>
      run(
        'extract',
        async () => {
          const { data } = await api.get<Job>(`/jobs/${id}`)
          setDetails({ title: data.title, company: data.company, description: data.description, link: data.url || '' })
          setLink(data.url || '')
          setJobId(data.id)
          setWebsite('')
          setWebsiteContext(null)
          setLetterText('')
          setLetterOrigin('')
          setChat([])
          await loadVersions(data.id)
          setStep('details')
        },
        'Could not load that job',
      ),
    [run, loadVersions],
  )

  const extract = () =>
    run(
      'extract',
      async () => {
        const url = link.trim()
        if (!url) throw new Error('Paste a job link first.')
        const posting = await scrape(url)
        setDetails(posting)
        setJobId(null)
        setVersions([])
        setSelectedId(null)
        setLetterText('')
        setLetterOrigin('')
        setWebsite('')
        setWebsiteContext(null)
        setStep('details')
      },
      'Could not read that posting',
    )

  const rescrape = () =>
    run(
      'rescrape',
      async () => {
        const url = (details?.link || link).trim()
        if (!url) throw new Error('There is no link to read again.')
        const posting = await scrape(url)
        setDetails(posting)
        setLink(url)
        setWebsiteContext(null)
        if (jobId) {
          await api.put(`/jobs/${jobId}`, {
            title: posting.title,
            company: posting.company,
            description: posting.description,
            url,
          })
        }
        setStep('details')
      },
      'Could not read that posting again',
    )

  const saveInterested = () =>
    run(
      'save',
      async () => {
        if (!details || jobId) return
        const { data } = await api.post<Job>('/jobs', {
          title: details.title,
          company: details.company,
          description: details.description,
          url: details.link,
          status: 'interested',
        })
        setJobId(data.id)
        await loadVersions(data.id)
      },
      'Could not save the job',
    )

  const fetchContext = () =>
    run(
      'context',
      async () => {
        if (!details?.company || !website.trim()) throw new Error('Enter the company website first.')
        const { data } = await api.post('/apply/company-context', {
          company: details.company,
          company_website: website.trim(),
        })
        setWebsiteContext(data.context_summary || '')
      },
      'Could not read the company website',
    )

  const generate = () =>
    run(
      'generate',
      async () => {
        if (!details) return
        if (jobId) {
          const { data } = await api.post<CoverLetter>('/cover-letters/generate', {
            job_id: jobId,
            company_website: website.trim() || undefined,
            company_context: websiteContext || undefined,
          })
          await loadVersions(jobId, data.id)
          return
        }
        const { data } = await api.post('/apply/generate-cover-letter', {
          job: {
            ...details,
            company_website: website.trim(),
            company_info: [details.company_info, websiteContext].filter(Boolean).join('\n\n'),
          },
        })
        setLetterText(data.cover_letter)
        setLetterOrigin('server')
      },
      'Could not generate a letter',
    )

  const refine = (note: string) =>
    run(
      'refine',
      async () => {
        if (!note.trim() || !currentLetter) return
        if (jobId && selected) {
          const { data } = await api.post<CoverLetter>(`/cover-letters/${selected.id}/refine`, { feedback: note })
          await loadVersions(jobId, data.id)
          return
        }
        const { data } = await api.post('/apply/refine-cover-letter', { cover_letter: currentLetter, feedback: note })
        setLetterText(data.cover_letter)
        setLetterOrigin('server')
      },
      'Could not refine the letter',
    )

  /** Store the user's own text: a new manual version on a saved job, or local text otherwise. */
  const saveManual = (text: string) =>
    run(
      'manual',
      async () => {
        if (!text.trim()) return
        if (jobId && selected) {
          const { data } = await api.post<CoverLetter>(`/cover-letters/${selected.id}/manual-version`, {
            content: text,
            feedback: 'Manual edit',
          })
          await loadVersions(jobId, data.id)
        } else if (jobId) {
          await api.put(`/jobs/${jobId}`, { cover_letter: text, cover_letter_source: 'manual' })
          await loadVersions(jobId)
        } else {
          setLetterText(text)
          setLetterOrigin('manual')
        }
      },
      'Could not save your edit',
    )

  const ask = (question: string) =>
    run(
      'chat',
      async () => {
        if (!question.trim() || !details) return
        setChat((prev) => [...prev, { role: 'user', content: question }])
        try {
          const { data } = await api.post('/apply/chat', { question, job: details, cover_letter: currentLetter })
          setChat((prev) => [...prev, { role: 'assistant', content: data.answer }])
        } catch (err) {
          setChat((prev) => [...prev, { role: 'assistant', content: errorDetail(err, 'No answer this time.') }])
        }
      },
      'Could not get an answer',
    )

  const downloadLetter = () =>
    run(
      'download',
      async () => {
        if (selected) {
          await downloadFile(`/api/cover-letters/${selected.id}/download`, `cover_letter_v${selected.version}.pdf`)
        } else {
          await downloadFile('/api/apply/cover-letter/pdf', 'cover_letter.pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cover_letter: letterText }),
          })
        }
      },
      'Could not download the letter',
    )

  const downloadResume = () =>
    run('download', () => downloadFile('/api/profile/resume/download', 'resume.pdf'), 'Could not download your resume')

  const markApplied = () =>
    run(
      'applied',
      async () => {
        if (!details) return
        // Unsaved letter text is stored with the job; saved versions are already on it.
        const letter =
          !selected && letterText.trim() ? { cover_letter: letterText, cover_letter_source: letterOrigin } : {}
        if (jobId) {
          await api.put(`/jobs/${jobId}`, { status: 'applied', ...letter })
        } else {
          const { data } = await api.post<Job>('/jobs', {
            title: details.title,
            company: details.company,
            description: details.description,
            url: details.link,
            status: 'applied',
            ...letter,
          })
          setJobId(data.id)
        }
        setStep('done')
      },
      'Could not mark the job as applied',
    )

  return {
    step,
    setStep,
    link,
    setLink,
    details,
    jobId,
    website,
    setWebsite: (value: string) => {
      setWebsite(value)
      setWebsiteContext(null)
    },
    websiteContext,
    versions,
    selected,
    selectVersion: setSelectedId,
    currentLetter,
    hasLetter: Boolean(currentLetter.trim()),
    chat,
    busy,
    error,
    clearError: () => setError(null),
    reset,
    loadSavedJob,
    extract,
    rescrape,
    saveInterested,
    fetchContext,
    generate,
    refine,
    saveManual,
    refreshVersions,
    ask,
    downloadLetter,
    downloadResume,
    markApplied,
  }
}

export type ApplyFlow = ReturnType<typeof useApplyFlow>
