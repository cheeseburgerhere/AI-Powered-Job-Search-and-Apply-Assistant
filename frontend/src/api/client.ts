import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

/** FastAPI error `detail` when present, otherwise the fallback message. */
export function errorDetail(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail
    if (typeof detail === 'string' && detail.trim()) return detail
  }
  if (err instanceof Error && err.message && !axios.isAxiosError(err)) return err.message
  return fallback
}

export default api
