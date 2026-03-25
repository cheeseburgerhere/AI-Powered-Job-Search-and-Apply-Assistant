import { create } from 'zustand'
import api from '../api/client'
import type { Job } from './jobStore'

interface TrackerBoard {
  interested: Job[]
  applied: Job[]
  follow_up: Job[]
  interview: Job[]
  offer: Job[]
  rejected: Job[]
}

interface TrackerStats {
  total: number
  discovered: number
  interested: number
  applied: number
  follow_up: number
  interview: number
  offer: number
  rejected: number
}

interface RejectedBin {
  key: string
  label: string
  count: number
  jobs: Job[]
}

interface TrackerEvent {
  id: number
  job_id: number
  from_status: string
  to_status: string
  note: string | null
  created_at: string | null
}

interface TrackerState {
  board: TrackerBoard
  stats: TrackerStats
  events: TrackerEvent[]
  rejectedBins: RejectedBin[]
  loading: boolean

  fetchBoard: () => Promise<void>
  fetchStats: () => Promise<void>
  fetchEvents: (jobId: number) => Promise<void>
  fetchRejectedBins: () => Promise<void>
}

const emptyBoard: TrackerBoard = {
  interested: [],
  applied: [],
  follow_up: [],
  interview: [],
  offer: [],
  rejected: [],
}

const emptyStats: TrackerStats = {
  total: 0,
  discovered: 0,
  interested: 0,
  applied: 0,
  follow_up: 0,
  interview: 0,
  offer: 0,
  rejected: 0,
}

export const useTrackerStore = create<TrackerState>((set) => ({
  board: emptyBoard,
  stats: emptyStats,
  events: [],
  rejectedBins: [],
  loading: false,

  fetchBoard: async () => {
    set({ loading: true })
    try {
      const { data } = await api.get('/tracker/board')
      set({ board: data, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  fetchStats: async () => {
    try {
      const { data } = await api.get('/tracker/stats')
      set({ stats: data })
    } catch {
      // silent
    }
  },

  fetchEvents: async (jobId: number) => {
    try {
      const { data } = await api.get('/tracker/events', { params: { job_id: jobId } })
      set({ events: data })
    } catch {
      // silent
    }
  },

  fetchRejectedBins: async () => {
    try {
      const { data } = await api.get('/tracker/rejected-bins')
      set({ rejectedBins: data })
    } catch {
      // silent
    }
  },
}))
