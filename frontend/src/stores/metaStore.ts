import { create } from 'zustand'
import api from '../api/client'

export interface Capabilities {
  server_ai: boolean
  ai_provider: string
  search_sources: string[]
}

interface MetaState {
  capabilities: Capabilities | null
  fetchCapabilities: () => Promise<void>
}

export const useMetaStore = create<MetaState>((set, get) => ({
  capabilities: null,

  fetchCapabilities: async () => {
    if (get().capabilities) return
    try {
      const { data } = await api.get('/meta/capabilities')
      set({ capabilities: data })
    } catch {
      // Treat an unreachable endpoint as "no server AI" so AI-only actions stay hidden.
      set({ capabilities: { server_ai: false, ai_provider: '', search_sources: [] } })
    }
  },
}))

/** Server-side AI actions render only when this is true. */
export function useServerAi(): boolean {
  return useMetaStore((s) => s.capabilities?.server_ai ?? false)
}
