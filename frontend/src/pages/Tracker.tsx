import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import { useTrackerStore } from '../stores/trackerStore'
import { useJobStore, type Job } from '../stores/jobStore'
import { ArrowLeft, ArrowRight, Calendar, ExternalLink } from 'lucide-react'

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
  const navigate = useNavigate()
  const { board, rejectedBins, fetchBoard, fetchRejectedBins } = useTrackerStore()
  const { updateJob } = useJobStore()
  const [draggedJob, setDraggedJob] = useState<{ id: number; from: StatusKey } | null>(null)
  const [dropTarget, setDropTarget] = useState<StatusKey | null>(null)

  useEffect(() => {
    fetchBoard()
    fetchRejectedBins()
  }, [fetchBoard, fetchRejectedBins])

  const moveJob = async (jobId: number, newStatus: string) => {
    await updateJob(jobId, { status: newStatus })
    fetchBoard()
    fetchRejectedBins()
  }

  const openApplyFlow = (jobId: number) => {
    navigate(`/apply?jobId=${jobId}`)
  }

  const startDragging = (jobId: number, from: StatusKey) => {
    setDraggedJob({ id: jobId, from })
  }

  const stopDragging = () => {
    setDraggedJob(null)
    setDropTarget(null)
  }

  const dropJobToColumn = async (to: StatusKey) => {
    if (!draggedJob) return
    const { id, from } = draggedJob
    setDropTarget(null)
    if (from !== to) {
      await moveJob(id, to)
    }
    setDraggedJob(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Application Tracker</h1>
          <p className="text-gray-500 mt-1">Track your jobs through the pipeline</p>
        </div>
        <Link
          to="/apply"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Apply
        </Link>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map(({ key, label, color }) => {
          const jobs = (board[key] || []) as Job[]
          const isDropZoneActive = dropTarget === key
          return (
            <div key={key} className="min-w-[260px] flex-shrink-0">
              <div
                className={`border-t-4 ${color} bg-white rounded-xl border border-gray-200 transition ${isDropZoneActive ? 'ring-2 ring-blue-200 bg-blue-50/30' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDropTarget(key)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  void dropJobToColumn(key)
                }}
                onDragLeave={() => {
                  if (dropTarget === key) {
                    setDropTarget(null)
                  }
                }}
              >
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
                      onOpenApply={openApplyFlow}
                      onDragStart={startDragging}
                      onDragEnd={stopDragging}
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

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Rejected Bins</h2>
        <p className="text-sm text-gray-500">Grouped by which stage the process stopped.</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rejectedBins.map((bin) => (
            <div key={bin.key} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-800">{bin.label}</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-700 font-medium">
                  {bin.count}
                </span>
              </div>
              {bin.jobs.length === 0 ? (
                <p className="text-xs text-gray-400">No jobs in this bin.</p>
              ) : (
                <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                  {bin.jobs.map((job) => (
                    <div key={job.id} className="rounded-md border border-gray-100 bg-gray-50 px-2 py-1.5">
                      <div className="text-xs font-medium text-gray-800 truncate">{job.title}</div>
                      <div className="text-xs text-gray-500 truncate">{job.company}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function TrackerCard({
  job,
  currentStatus,
  onMove,
  onOpenApply,
  onDragStart,
  onDragEnd,
}: {
  job: Job
  currentStatus: StatusKey
  onMove: (id: number, status: string) => void
  onOpenApply: (id: number) => void
  onDragStart: (id: number, from: StatusKey) => void
  onDragEnd: () => void
}) {
  const currentIdx = STATUS_FLOW.indexOf(currentStatus)
  const nextStatus = currentIdx >= 0 && currentIdx < STATUS_FLOW.length - 1 ? STATUS_FLOW[currentIdx + 1] : null

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', String(job.id))
        e.dataTransfer.effectAllowed = 'move'
        onDragStart(job.id, currentStatus)
      }}
      onDragEnd={onDragEnd}
      className="bg-gray-50 rounded-lg p-3 border border-gray-100 hover:border-gray-200 transition-colors cursor-move"
    >
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
        {currentStatus === 'interested' && (
          <button
            onClick={() => onOpenApply(job.id)}
            className="text-xs px-2 py-1 bg-indigo-50 text-indigo-700 rounded hover:bg-indigo-100"
          >
            Apply
          </button>
        )}
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
