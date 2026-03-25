import { useEffect } from 'react'
import { useProfileStore } from '../stores/profileStore'
import { useTrackerStore } from '../stores/trackerStore'
import { useJobStore } from '../stores/jobStore'
import { Link } from 'react-router-dom'
import { AlertTriangle, Briefcase, FileText, TrendingUp, Search, Clock3, Ban } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type StatColor = 'slate' | 'blue' | 'amber' | 'green' | 'violet' | 'emerald' | 'rose'

export default function Dashboard() {
  const { profile, fetchProfile } = useProfileStore()
  const { stats, fetchStats } = useTrackerStore()
  const { nudges, fetchNudges } = useJobStore()

  useEffect(() => {
    fetchProfile()
    fetchStats()
    fetchNudges()
  }, [fetchProfile, fetchStats, fetchNudges])

  const hasProfile = profile && profile.full_name

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">
          {hasProfile ? `Welcome back, ${profile.full_name}` : 'Get started by uploading your resume'}
        </p>
      </div>

      {!hasProfile && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-blue-900">Get Started</h2>
          <p className="text-sm text-blue-700 mt-1">
            Upload your resume to unlock job matching, cover letter generation, and more.
          </p>
          <Link
            to="/onboarding"
            className="inline-block mt-3 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          >
            Go to Profile Setup
          </Link>
        </div>
      )}

      {/* Stats */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Pipeline Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-4">
          <StatCard label="Total" value={stats.total} icon={Briefcase} color="slate" />
          <StatCard label="Discovered" value={stats.discovered} icon={Search} color="blue" />
          <StatCard label="Interested" value={stats.interested} icon={TrendingUp} color="amber" />
          <StatCard label="Applied" value={stats.applied} icon={FileText} color="green" />
          <StatCard label="Follow Up" value={stats.follow_up} icon={Clock3} color="blue" />
          <StatCard label="Interview" value={stats.interview} icon={TrendingUp} color="violet" />
          <StatCard label="Offer" value={stats.offer} icon={TrendingUp} color="emerald" />
          <StatCard label="Rejected" value={stats.rejected} icon={Ban} color="rose" />
        </div>
      </div>

      {/* Nudges */}
      {nudges.length > 0 && (
        <section className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-amber-900 flex items-center gap-2">
            <AlertTriangle size={20} />
            Follow-up Reminders
          </h2>
          <div className="mt-3 space-y-2">
            {nudges.map((job) => (
              <div key={job.id} className="flex items-center justify-between bg-white rounded-lg p-3 border border-amber-100">
                <div>
                  <span className="font-medium text-sm">{job.title}</span>
                  <span className="text-gray-500 text-sm"> at {job.company}</span>
                </div>
                <span className="text-xs text-amber-700">
                  Applied {job.date_applied ? new Date(job.date_applied).toLocaleDateString() : ''}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/jobs"
          className="bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-sm transition-all"
        >
          <Briefcase size={24} className="text-blue-600 mb-2" />
          <h3 className="font-semibold text-gray-900">Add a Job</h3>
          <p className="text-sm text-gray-500 mt-1">Paste a job description and get a fit score</p>
        </Link>
        <Link
          to="/cover-letters"
          className="bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-sm transition-all"
        >
          <FileText size={24} className="text-purple-600 mb-2" />
          <h3 className="font-semibold text-gray-900">Generate Cover Letter</h3>
          <p className="text-sm text-gray-500 mt-1">Create a tailored letter for any saved job</p>
        </Link>
        <Link
          to="/tracker"
          className="bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-sm transition-all"
        >
          <TrendingUp size={24} className="text-green-600 mb-2" />
          <h3 className="font-semibold text-gray-900">Track Applications</h3>
          <p className="text-sm text-gray-500 mt-1">Manage your pipeline with the kanban board</p>
        </Link>
      </div>
    </div>
  )
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: LucideIcon; color: StatColor }) {
  const colors: Record<StatColor, string> = {
    slate: 'bg-slate-100 text-slate-700',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-700',
    green: 'bg-green-50 text-green-600',
    violet: 'bg-violet-50 text-violet-700',
    emerald: 'bg-emerald-50 text-emerald-600',
    rose: 'bg-rose-50 text-rose-700',
  }
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors[color]}`}>
        <Icon size={20} />
      </div>
      <div className="mt-3">
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        <div className="text-sm text-gray-500">{label}</div>
      </div>
    </div>
  )
}
