export type ThemeChoice = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'theme'
// Light until every page is on the ledger tokens; switch to 'system' afterwards.
const DEFAULT_THEME: ThemeChoice = 'light'

export function readTheme(): ThemeChoice {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch {
    // Storage can be unavailable (private mode); fall through to the default.
  }
  return DEFAULT_THEME
}

export function applyTheme(choice: ThemeChoice) {
  const dark =
    choice === 'dark' || (choice === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
}

export function saveTheme(choice: ThemeChoice) {
  try {
    localStorage.setItem(STORAGE_KEY, choice)
  } catch {
    // Non-fatal: the choice still applies for this page view.
  }
  applyTheme(choice)
}
