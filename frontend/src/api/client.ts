import axios from 'axios'

// In Electron, the preload script injects __BACKEND_PORT__ into the window
// object so the renderer knows which port the Python backend is running on.
// In normal Vite dev mode, the Vite proxy handles /api → localhost:8000.
declare global {
  interface Window {
    __BACKEND_PORT__?: number
  }
}

function getBaseURL(): string {
  if (typeof window !== 'undefined' && window.__BACKEND_PORT__) {
    return `http://localhost:${window.__BACKEND_PORT__}/api`
  }
  return '/api'
}

const api = axios.create({
  baseURL: getBaseURL(),
  headers: { 'Content-Type': 'application/json' },
})

export default api

