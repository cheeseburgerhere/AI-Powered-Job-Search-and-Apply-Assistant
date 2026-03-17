import { create } from 'zustand'
import api from '../api/client'
import type { Job } from './jobStore'

export interface JobBoard {
    id: number
    name: string
    domain: string
    query: string
    location: string | null
    remote_only: boolean
    min_fit_score: number | null
    score_results: boolean
    max_scored_jobs: number
    auto_apply_enabled: boolean
    apply_mode: string
    notes: string | null
    last_run_at: string | null
    created_at: string | null
    updated_at: string | null
}

interface RunBoardResult {
    board: JobBoard
    total_found: number
    fit_matched: number
    apply_ready: number
    matched_jobs: Job[]
}

interface CreateBoardPayload {
    name: string
    domain: string
    query: string
    location?: string
    remote_only?: boolean
    min_fit_score?: number
    score_results?: boolean
    max_scored_jobs?: number
    auto_apply_enabled?: boolean
    apply_mode?: string
    notes?: string
}

interface UpdateBoardPayload {
    name?: string
    domain?: string
    query?: string
    location?: string
    remote_only?: boolean
    min_fit_score?: number | null
    score_results?: boolean
    max_scored_jobs?: number
    auto_apply_enabled?: boolean
    apply_mode?: string
    notes?: string
}

interface JobBoardState {
    boards: JobBoard[]
    activeRun: RunBoardResult | null
    loading: boolean
    error: string | null

    fetchBoards: () => Promise<void>
    createBoard: (payload: CreateBoardPayload) => Promise<JobBoard>
    updateBoard: (id: number, payload: UpdateBoardPayload) => Promise<JobBoard>
    deleteBoard: (id: number) => Promise<void>
    runBoard: (id: number) => Promise<RunBoardResult>
    clearRunResult: () => void
}

function getErrorMessage(err: any, fallback: string): string {
    const detail = err?.response?.data?.detail
    if (typeof detail === 'string' && detail.trim()) {
        return detail
    }
    return fallback
}

export const useJobBoardStore = create<JobBoardState>((set, get) => ({
    boards: [],
    activeRun: null,
    loading: false,
    error: null,

    fetchBoards: async () => {
        set({ loading: true, error: null })
        try {
            const { data } = await api.get('/job-boards')
            set({ boards: data, loading: false })
        } catch (err: any) {
            set({ loading: false, error: getErrorMessage(err, 'Failed to load tracked boards') })
        }
    },

    createBoard: async (payload) => {
        set({ loading: true, error: null })
        try {
            const { data } = await api.post('/job-boards', payload)
            set({ boards: [data, ...get().boards], loading: false })
            return data
        } catch (err: any) {
            const message = getErrorMessage(err, 'Failed to create board')
            set({ loading: false, error: message })
            throw new Error(message)
        }
    },

    updateBoard: async (id, payload) => {
        set({ loading: true, error: null })
        try {
            const { data } = await api.put(`/job-boards/${id}`, payload)
            set({
                boards: get().boards.map((board) => (board.id === id ? data : board)),
                loading: false,
            })
            return data
        } catch (err: any) {
            const message = getErrorMessage(err, 'Failed to update board')
            set({ loading: false, error: message })
            throw new Error(message)
        }
    },

    deleteBoard: async (id) => {
        set({ loading: true, error: null })
        try {
            await api.delete(`/job-boards/${id}`)
            set({
                boards: get().boards.filter((board) => board.id !== id),
                loading: false,
            })
        } catch (err: any) {
            const message = getErrorMessage(err, 'Failed to delete board')
            set({ loading: false, error: message })
            throw new Error(message)
        }
    },

    runBoard: async (id) => {
        set({ loading: true, error: null })
        try {
            const { data } = await api.post(`/job-boards/${id}/run`)
            set({
                boards: get().boards.map((board) => (board.id === data.board.id ? data.board : board)),
                activeRun: data,
                loading: false,
            })
            return data
        } catch (err: any) {
            const message = getErrorMessage(err, 'Board scan failed')
            set({ loading: false, error: message })
            throw new Error(message)
        }
    },

    clearRunResult: () => set({ activeRun: null }),
}))
