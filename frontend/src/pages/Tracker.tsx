import { useEffect } from 'react'
import { useTrackerStore } from '../stores/trackerStore'
import { useJobStore, type Job } from '../stores/jobStore'
import { ArrowRight, Calendar, ExternalLink } from 'lucide-react'

const COLUMNS = [
  { key: 'interested', label: 'Interested', color: 'border-blue-400' },
  { key: 'applied', label: 'Applied', color: 'border-green-400' },
  { key: 'follow_up', label: 'Follow Up', color: 'border-yellow-400' },
  { key: 'interview', label: 'Interview', color: 'border-purple-400' },
  { key: 'offer', label: 'Offer', color: 'border-emerald-400' },
  { key: 'rejected', label: 'Rejected', color: 'border-red-400' },
] as const

type StatusKey = (typeof COLUMNS)[number]['key']

const STATUS_FLOW: StatusKey[] = ['interested', 'applied', 'follow_up', 'interview', 'offer']

export default function Tracker() {
  const { board, fetchBoard } = useTrackerStore()
  const { updateJob } = useJobStore()

  useEffect(() => {
    fetchBoard()
  }, [fetchBoard])

  const moveJob = async (jobId: number, newStatus: string) => {
    await updateJob(jobId, { status: newStatus })
    fetchBoard()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Application Tracker</h1>
        <p className="text-gray-500 mt-1">Track your jobs through the pipeline</p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map(({ key, label, color }) => {
          const jobs = (board[key] || []) as Job[]
          return (
            <div key={key} className="min-w-[260px] flex-shrink-0">
              <div className={`border-t-4 ${color} bg-white rounded-xl border border-gray-200`}>
                <div className="px-4 py-3 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm text-gray-700">{label}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                      {jobs.length}
                    </span>
                  </div>
                </div>
                <div className="p-2 space-y-2 min-h-[200px]">
                  {jobs.map((job) => (
                    <TrackerCard
                      key={job.id}
                      job={job}
                      currentStatus={key}
                      onMove={moveJob}
                    />
                  ))}
                  {jobs.length === 0 && (
                    <div className="text-center py-6 text-xs text-gray-300">No jobs</div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TrackerCard({
  job,
  currentStatus,
  onMove,
}: {
  job: Job
  currentStatus: StatusKey
  onMove: (id: number, status: string) => void
}) {
  const currentIdx = STATUS_FLOW.indexOf(currentStatus)
  const nextStatus = currentIdx >= 0 && currentIdx < STATUS_FLOW.length - 1 ? STATUS_FLOW[currentIdx + 1] : null

  return (
    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 hover:border-gray-200 transition-colors">
      <div className="font-medium text-sm text-gray-900">{job.title}</div>
      <div className="text-xs text-gray-500">{job.company}</div>
      {job.fit_score !== null && (
        <span
          className={`inline-block mt-1 text-xs px-1.5 py-0.5 rounded-full font-medium ${
            job.fit_score >= 7
              ? 'bg-green-100 text-green-700'
              : job.fit_score >= 5
              ? 'bg-yellow-100 text-yellow-700'
              : 'bg-red-100 text-red-700'
          }`}
        >
          {job.fit_score.toFixed(1)}/10
        </span>
      )}
      {job.date_applied && (
        <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
          <Calendar size={10} />
          Applied {new Date(job.date_applied).toLocaleDateString()}
        </div>
      )}
      <div className="flex items-center gap-1 mt-2">
        {nextStatus && (
          <button
            onClick={() => onMove(job.id, nextStatus)}
            className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 flex items-center gap-1"
          >
            <ArrowRight size={10} />
            {nextStatus.replace('_', ' ')}
          </button>
        )}
        {currentStatus !== 'rejected' && (
          <button
            onClick={() => onMove(job.id, 'rejected')}
            className="text-xs px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100"
          >
            Reject
          </button>
        )}
        {job.url && (
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs p-1 text-gray-400 hover:text-blue-600"
          >
            <ExternalLink size={12} />
          </a>
        )}
      </div>
    </div>
  )
}
