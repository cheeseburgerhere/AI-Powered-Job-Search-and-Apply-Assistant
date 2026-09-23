import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useMetaStore } from '../stores/metaStore'
import { readTheme, saveTheme, type ThemeChoice } from '../lib/theme'
import { cn } from '../lib/utils'

const navItems = [
  { to: '/', label: 'Today', end: true },
  { to: '/jobs', label: 'Jobs' },
  { to: '/find', label: 'Find' },
  { to: '/apply', label: 'Apply' },
  { to: '/letters', label: 'Letters' },
  { to: '/tracker', label: 'Tracker' },
  { to: '/profile', label: 'Profile' },
]

const themes: { value: ThemeChoice; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'Auto' },
]

export default function Layout() {
  const { capabilities, fetchCapabilities } = useMetaStore()
  const [theme, setTheme] = useState<ThemeChoice>(readTheme)

  useEffect(() => {
    fetchCapabilities()
  }, [fetchCapabilities])

  const chooseTheme = (choice: ThemeChoice) => {
    setTheme(choice)
    saveTheme(choice)
  }

  return (
    <div className="flex min-h-screen flex-col md:h-screen md:flex-row">
      <aside className="flex shrink-0 flex-col border-b border-rule bg-paper md:w-52 md:border-r md:border-b-0">
        <div className="px-5 pt-5 pb-4">
          <span className="font-serif text-lg font-medium tracking-tight text-ink">Job Search</span>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:gap-0 md:overflow-visible md:pb-0">
          {navItems.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'rounded-sm px-2 py-1.5 text-sm whitespace-nowrap transition-colors',
                  isActive ? 'bg-sunken font-medium text-ink' : 'text-ink-muted hover:text-ink',
                )
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden space-y-3 border-t border-rule px-5 py-4 text-xs text-ink-muted md:block">
          <div>
            <div className="text-ink-faint">Server AI</div>
            <div className="text-ink">
              {capabilities === null ? '…' : capabilities.server_ai ? capabilities.ai_provider : 'Off — use your agent'}
            </div>
          </div>
          <div className="flex gap-2" role="radiogroup" aria-label="Theme">
            {themes.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={theme === value}
                onClick={() => chooseTheme(value)}
                className={cn('hover:text-ink', theme === value ? 'text-ink underline underline-offset-4' : '')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto bg-paper">
        <div className="mx-auto max-w-[1180px] px-4 py-6 md:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
