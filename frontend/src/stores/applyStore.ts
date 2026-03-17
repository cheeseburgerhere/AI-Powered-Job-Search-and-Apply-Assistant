import { create } from 'zustand'
import api from '../api/client'

export interface ApplyPlan {
    job_id: number
    adapter_type: string
    mode_recommendation: string
    confidence_score: number
    required_fields: string[]
    missing_fields: string[]
    detection_reasons: string[]
    prefill_payload: {
        identity: {
            full_name: string
            email: string
            phone: string
            location: string
        }
        eligibility: {
            work_authorization: string | null
            sponsorship_required: boolean | null
        }
        materials: {
            resume_file_path: string | null
            resume_text: string
            cover_letter: string
        }
        custom_questions: Array<{ question: string; answer: string }>
    }
}

interface ApplyState {
    getApplyPlan: (jobId: number) => Promise<ApplyPlan>
}

export const useApplyStore = create<ApplyState>(() => ({
    getApplyPlan: async (jobId: number) => {
        const { data } = await api.post(`/apply/plan/${jobId}`)
        return data as ApplyPlan
    },
}))
