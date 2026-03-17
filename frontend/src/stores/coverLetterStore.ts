import { create } from 'zustand'
import api from '../api/client'

export interface CoverLetter {
  id: number
  job_id: number
  version: number
  content: string
  feedback: string | null
  status: string
  created_at: string | null
  updated_at: string | null
}

interface CoverLetterState {
  letters: CoverLetter[]
  loading: boolean
  error: string | null

  fetchLetters: (jobId: number) => Promise<void>
  generate: (jobId: number) => Promise<CoverLetter>
  refine: (letterId: number, feedback: string) => Promise<CoverLetter>
  updateContent: (letterId: number, content: string) => Promise<CoverLetter>
  updateStatus: (letterId: number, status: string) => Promise<void>
}

export const useCoverLetterStore = create<CoverLetterState>((set) => ({
  letters: [],
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

  generate: async (jobId: number) => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.post('/cover-letters/generate', { job_id: jobId })
      set((s) => ({ letters: [data, ...s.letters], loading: false }))
      return data
    } catch (err: any) {
      set({ error: err.response?.data?.detail || 'Generation failed', loading: false })
      throw err
    }
  },

  refine: async (letterId: number, feedback: string) => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.post(`/cover-letters/${letterId}/refine`, { feedback })
      set((s) => ({ letters: [data, ...s.letters], loading: false }))
      return data
    } catch (err: any) {
      set({ error: err.response?.data?.detail || 'Refinement failed', loading: false })
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
    } catch (err: any) {
      set({ error: err.response?.data?.detail || 'Save failed', loading: false })
      throw err
    }
  },

  updateStatus: async (letterId: number, status: string) => {
    const { data } = await api.put(`/cover-letters/${letterId}/status`, { status })
    set((s) => ({ letters: s.letters.map((l) => (l.id === letterId ? data : l)) }))
  },
}))
