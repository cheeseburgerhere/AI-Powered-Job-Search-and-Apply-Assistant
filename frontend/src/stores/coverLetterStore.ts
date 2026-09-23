import { create } from 'zustand'
import api, { errorDetail } from '../api/client'

export interface CoverLetter {
  id: number
  job_id: number
  version: number
  content: string
  feedback: string | null
  status: string
  /** 'agent' | 'server' | 'manual', or '' when unknown */
  source: string
  created_at: string | null
  updated_at: string | null
}

interface CoverLetterState {
  letters: CoverLetter[]
  allLetters: CoverLetter[]
  loading: boolean
  error: string | null

  fetchLetters: (jobId: number) => Promise<void>
  fetchAllLetters: () => Promise<void>
  generate: (jobId: number) => Promise<CoverLetter>
  refine: (letterId: number, feedback: string) => Promise<CoverLetter>
  updateContent: (letterId: number, content: string) => Promise<CoverLetter>
  updateStatus: (letterId: number, status: string) => Promise<void>
  createManualVersion: (letterId: number, content: string, feedback?: string) => Promise<CoverLetter>
}

export const useCoverLetterStore = create<CoverLetterState>((set) => ({
  letters: [],
  allLetters: [],
  loading: false,
  error: null,

  fetchLetters: async (jobId: number) => {
    set({ loading: true })
    try {
      const { data } = await api.get('/cover-letters', { params: { job_id: jobId } })
      set({ letters: data, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  fetchAllLetters: async () => {
    try {
      const { data } = await api.get('/cover-letters')
      set({ allLetters: data })
    } catch {
      // silent
    }
  },

  generate: async (jobId: number) => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.post('/cover-letters/generate', { job_id: jobId })
      set((s) => ({ letters: [data, ...s.letters], loading: false }))
      return data
    } catch (err) {
      set({ error: errorDetail(err, 'Generation failed'), loading: false })
      throw err
    }
  },

  refine: async (letterId: number, feedback: string) => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.post(`/cover-letters/${letterId}/refine`, { feedback })
      set((s) => ({ letters: [data, ...s.letters], loading: false }))
      return data
    } catch (err) {
      set({ error: errorDetail(err, 'Refinement failed'), loading: false })
      throw err
    }
  },

  updateContent: async (letterId: number, content: string) => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.put(`/cover-letters/${letterId}`, { content })
      set((s) => ({
        letters: s.letters.map((l) => (l.id === letterId ? data : l)),
        loading: false,
      }))
      return data
    } catch (err) {
      set({ error: errorDetail(err, 'Save failed'), loading: false })
      throw err
    }
  },

  updateStatus: async (letterId: number, status: string) => {
    const { data } = await api.put(`/cover-letters/${letterId}/status`, { status })
    set((s) => ({
      letters: s.letters.map((l) => (l.id === letterId ? data : l)),
      allLetters: s.allLetters.map((l) => (l.id === letterId ? data : l)),
    }))
  },

  createManualVersion: async (letterId: number, content: string, feedback?: string) => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.post(`/cover-letters/${letterId}/manual-version`, { content, feedback })
      set((s) => ({ letters: [data, ...s.letters], allLetters: [data, ...s.allLetters], loading: false }))
      return data
    } catch (err) {
      set({ error: errorDetail(err, 'Save failed'), loading: false })
      throw err
    }
  },
}))
