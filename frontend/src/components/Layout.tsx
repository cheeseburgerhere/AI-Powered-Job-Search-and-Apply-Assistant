import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { FileText, Briefcase, PenTool, Kanban, LayoutDashboard } from 'lucide-react'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, match: (p: string) => p === '/' },
  { to: '/onboarding', label: 'Profile', icon: FileText, match: (p: string) => p === '/onboarding' },
  { to: '/jobs', label: 'Jobs', icon: Briefcase, match: (p: string) => p.startsWith('/jobs') },
  { to: '/cover-letters', label: 'Cover Letters', icon: PenTool, match: (p: string) => p === '/cover-letters' },
  { to: '/tracker', label: 'Tracker', icon: Kanban, match: (p: string) => p === '/tracker' },
]

export default function Layout() {
  const location = useLocation()

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-lg font-bold text-blue-600">AI Job Assistant</h1>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map(({ to, label, icon: Icon, match }) => {
            const isActive = match(location.pathname)
            return (
              <NavLink
                key={to}
                to={to}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon size={18} />
                {label}
              </NavLink>
            )
          })}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
