import { useEffect, useRef } from 'react'

/**
 * Re-run `refresh` when the window regains focus and on an interval while the tab is visible.
 * The MCP agent writes to the same database out-of-band, so pages showing its output poll.
 */
export function useLiveRefresh(refresh: () => void, intervalMs = 15000) {
  const ref = useRef(refresh)
  useEffect(() => {
    ref.current = refresh
  }, [refresh])

  useEffect(() => {
    const run = () => {
      if (document.visibilityState === 'visible') ref.current()
    }
    const timer = window.setInterval(run, intervalMs)
    window.addEventListener('focus', run)
    document.addEventListener('visibilitychange', run)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', run)
      document.removeEventListener('visibilitychange', run)
    }
  }, [intervalMs])
}
