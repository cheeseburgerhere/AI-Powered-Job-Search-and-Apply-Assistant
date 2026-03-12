import { create } from 'zustand'
import api from '../api/client'

export interface Experience {
  company: string
  title: string
  start_date: string
  end_date: string
  bullets: string[]
}

export interface Education {
  school: string
  degree: string
  field: string
  start_date: string
  end_date: string
}

export interface Certification {
  name: string
  issuer: string
  date: string
}

export interface Preferences {
  roles: string[]
  locations: string[]
  remote: boolean
  salary_min: number | null
  salary_max: number | null
  industries: string[]
}

export interface Profile {
  id: number
  full_name: string
  email: string
  phone: string
  location: string
  summary: string
  raw_resume_text: string
  resume_file_path: string | null
  skills: string[]
  experiences: Experience[]
  education: Education[]
  certifications: Certification[]
  writing_samples: string[]
  voice_profile: string
  preferences: Preferences
  created_at: string | null
  updated_at: string | null
}

interface ProfileState {
  profile: Profile | null
  loading: boolean
  error: string | null

  fetchProfile: () => Promise<void>
  uploadResume: (file?: File, text?: string) => Promise<void>
  updateProfile: (data: Partial<Profile>) => Promise<void>
  updatePreferences: (prefs: Partial<Preferences>) => Promise<void>
  addWritingSample: (text: string) => Promise<void>
  analyzeVoice: () => Promise<void>
}

export const useProfileStore = create<ProfileState>((set) => ({
  profile: null,
  loading: false,
  error: null,

  fetchProfile: async () => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.get('/profile')
      set({ profile: data, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  uploadResume: async (file?: File, text?: string) => {
    set({ loading: true, error: null })
    try {
      const formData = new FormData()
      if (file) {
        formData.append('file', file)
      } else if (text) {
        formData.append('resume_text', text)
      }
      const { data } = await api.post('/profile/upload-resume', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      set({ profile: data, loading: false })
    } catch (err: any) {
      set({ error: err.response?.data?.detail || 'Upload failed', loading: false })
    }
  },

  updateProfile: async (updates) => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.put('/profile', updates)
      set({ profile: data, loading: false })
    } catch (err: any) {
      set({ error: err.response?.data?.detail || 'Update failed', loading: false })
    }
  },

  updatePreferences: async (prefs) => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.put('/profile/preferences', prefs)
      set({ profile: data, loading: false })
    } catch (err: any) {
      set({ error: err.response?.data?.detail || 'Update failed', loading: false })
    }
  },

  addWritingSample: async (text: string) => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.post('/profile/writing-sample', { text })
      set({ profile: data, loading: false })
    } catch (err: any) {
      set({ error: err.response?.data?.detail || 'Failed to add sample', loading: false })
    }
  },

  analyzeVoice: async () => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.post('/profile/analyze-voice')
      set({ profile: data, loading: false })
    } catch (err: any) {
      set({ error: err.response?.data?.detail || 'Analysis failed', loading: false })
    }
  },
}))
