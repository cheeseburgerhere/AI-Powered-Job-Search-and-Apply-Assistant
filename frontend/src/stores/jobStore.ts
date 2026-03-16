import { create } from 'zustand'
import api from '../api/client'

export interface Job {
  id: number
  external_id: string | null
  source: string
  title: string
  company: string
  location: string
  remote_type: string
  salary_min: number | null
  salary_max: number | null
  description: string
  url: string | null
  fit_score: number | null
  fit_reasoning: string | null
  status: string
  date_saved: string | null
  date_applied: string | null
  next_follow_up: string | null
  notes: string | null
  link_type: string | null
  created_at: string | null
  updated_at: string | null
}

export interface JobSearchFilters {
  query?: string
  location?: string
  remote_only?: boolean
  salary_min?: number
  salary_max?: number
  sources?: string[]
  score_results?: boolean
  min_fit_score?: number
  max_scored_jobs?: number
  page?: number
  per_page?: number
  country?: string
  scrape_sites?: string[]
  company_slugs?: string[]
}

interface JobState {
  jobs: Job[]
  nudges: Job[]
  loading: boolean
  error: string | null

  fetchJobs: (status?: string) => Promise<void>
  createJob: (data: { title: string; company: string; description: string; url?: string; location?: string; remote_type?: string }) => Promise<Job>
  updateJob: (id: number, data: { status?: string; notes?: string; next_follow_up?: string }) => Promise<void>
  deleteJob: (id: number) => Promise<void>
  scoreJob: (id: number) => Promise<void>
  searchJobs: (filters: JobSearchFilters) => Promise<Job[]>
  fetchNudges: () => Promise<void>
}

export const useJobStore = create<JobState>((set) => ({
  jobs: [],
  nudges: [],
  loading: false,
  error: null,

  fetchJobs: async (status?: string) => {
    set({ loading: true })
    try {
      const params = status ? { status } : {}
      const { data } = await api.get('/jobs', { params })
      set({ jobs: data, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  createJob: async (jobData) => {
    const { data } = await api.post('/jobs', jobData)
    set((s) => ({ jobs: [data, ...s.jobs] }))
    return data
  },

  updateJob: async (id, updates) => {
    const { data } = await api.put(`/jobs/${id}`, updates)
    set((s) => ({ jobs: s.jobs.map((j) => (j.id === id ? data : j)) }))
  },

  deleteJob: async (id) => {
    await api.delete(`/jobs/${id}`)
    set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) }))
  },

  scoreJob: async (id) => {
    const { data } = await api.post(`/jobs/${id}/score`)
    set((s) => ({ jobs: s.jobs.map((j) => (j.id === id ? data : j)) }))
  },

  searchJobs: async (filters) => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.post('/jobs/search', filters)
      set({ jobs: data, loading: false })
      return data
    } catch (err: any) {
      const status = err?.response?.status
      const detail = err?.response?.data?.detail || ''
      if (status === 404 && typeof detail === 'string' && detail.toLowerCase().includes('no jobs found')) {
        set({ jobs: [], loading: false, error: null })
        return []
      }
      const message = detail || 'Job search failed'
      set({ loading: false, error: message })
      throw new Error(message)
    }
  },

  fetchNudges: async () => {
    try {
      const { data } = await api.get('/jobs/nudges')
      set({ nudges: data })
    } catch {
      // silent
    }
  },
}))
