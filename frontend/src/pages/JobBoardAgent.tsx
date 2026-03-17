import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Bot, Loader2, Play, Plus, Trash2, ExternalLink } from 'lucide-react'

import { useJobBoardStore, type JobBoard } from '../stores/jobBoardStore'

export default function JobBoardAgent() {
  const navigate = useNavigate()
  const {
    boards,
    loading,
    error,
    activeRun,
    fetchBoards,
    createBoard,
    updateBoard,
    deleteBoard,
    runBoard,
    clearRunResult,
  } = useJobBoardStore()

  const [form, setForm] = useState({
    name: '',
    domain: '',
    query: '',
    location: '',
    min_fit_score: '6.5',
    max_scored_jobs: '8',
    remote_only: false,
    score_results: true,
    auto_apply_enabled: false,
    notes: '',
  })
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    fetchBoards()
  }, [fetchBoards])

  const sortedBoards = useMemo(
    () => [...boards].sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()),
    [boards]
  )

  const handleCreate = async () => {
    setFormError(null)
    if (!form.name.trim() || !form.domain.trim() || !form.query.trim()) {
      setFormError('Name, domain, and query are required.')
      return
    }

    try {
      await createBoard({
        name: form.name.trim(),
        domain: form.domain.trim(),
        query: form.query.trim(),
        location: form.location.trim() || undefined,
        remote_only: form.remote_only,
        min_fit_score: form.min_fit_score.trim() ? parseFloat(form.min_fit_score) : undefined,
        max_scored_jobs: form.max_scored_jobs.trim() ? parseInt(form.max_scored_jobs, 10) : undefined,
        score_results: form.score_results,
        auto_apply_enabled: form.auto_apply_enabled,
        notes: form.notes.trim() || undefined,
      })
      setForm({
        name: '',
        domain: '',
        query: '',
        location: '',
        min_fit_score: '6.5',
        max_scored_jobs: '8',
        remote_only: false,
        score_results: true,
        auto_apply_enabled: false,
        notes: '',
      })
    } catch (err: any) {
      setFormError(err?.message || 'Failed to track board.')
    }
  }

  const toggleAutoApply = async (board: JobBoard) => {
    await updateBoard(board.id, { auto_apply_enabled: !board.auto_apply_enabled })
  }

  const runTrackedBoard = async (boardId: number) => {
    await runBoard(boardId)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/')}
          className="p-2 text-gray-400 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Job Board Agent</h1>
          <p className="text-gray-500 mt-1">Track great boards, scan for fit-matched roles, and prep future apply automation</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2 text-gray-900">
          <Bot size={16} />
          <h2 className="font-semibold">Track a board</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            value={form.name}
            onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="Board name (e.g. Greenhouse picks)"
          />
          <input
            value={form.domain}
            onChange={(e) => setForm((s) => ({ ...s, domain: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="boards.greenhouse.io"
          />
          <input
            value={form.query}
            onChange={(e) => setForm((s) => ({ ...s, query: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="Search query (e.g. ai engineer)"
          />
          <input
            value={form.location}
            onChange={(e) => setForm((s) => ({ ...s, location: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="Location (optional)"
          />
          <input
            type="number"
            min="0"
            max="10"
            step="0.1"
            value={form.min_fit_score}
            onChange={(e) => setForm((s) => ({ ...s, min_fit_score: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="Min fit score"
          />
          <input
            type="number"
            min="0"
            max="30"
            value={form.max_scored_jobs}
            onChange={(e) => setForm((s) => ({ ...s, max_scored_jobs: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="Max scored jobs"
          />
        </div>

        <textarea
          value={form.notes}
          onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          rows={2}
          placeholder="Notes for apply agent rules (optional)"
        />

        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.remote_only}
              onChange={(e) => setForm((s) => ({ ...s, remote_only: e.target.checked }))}
            />
            Remote only
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.score_results}
              onChange={(e) => setForm((s) => ({ ...s, score_results: e.target.checked }))}
            />
            Score with AI
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.auto_apply_enabled}
              onChange={(e) => setForm((s) => ({ ...s, auto_apply_enabled: e.target.checked }))}
            />
            Enable apply-agent readiness
          </label>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={handleCreate}
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Track Board
          </button>
          {(formError || error) && <p className="text-sm text-red-600">{formError || error}</p>}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Tracked boards</h2>
        {sortedBoards.length === 0 && <p className="text-sm text-gray-500">No tracked boards yet.</p>}
        <div className="space-y-3">
          {sortedBoards.map((board) => (
            <div key={board.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="font-semibold text-gray-900">{board.name}</h3>
                  <p className="text-xs text-gray-500">{board.domain}</p>
                  <p className="text-sm text-gray-700">Query: {board.query}</p>
                  <p className="text-xs text-gray-500">
                    Fit &gt;= {board.min_fit_score ?? 'n/a'} | Remote only: {board.remote_only ? 'yes' : 'no'} | Auto-apply: {board.auto_apply_enabled ? 'on' : 'off'}
                  </p>
                  {board.last_run_at && <p className="text-xs text-gray-400">Last run: {new Date(board.last_run_at).toLocaleString()}</p>}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleAutoApply(board)}
                    className="px-3 py-1.5 text-xs rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200"
                  >
                    Toggle apply
                  </button>
                  <button
                    onClick={() => runTrackedBoard(board.id)}
                    disabled={loading}
                    className="px-3 py-1.5 text-xs rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1"
                  >
                    <Play size={12} />
                    Run
                  </button>
                  <button
                    onClick={() => deleteBoard(board.id)}
                    disabled={loading}
                    className="px-2 py-1.5 text-xs rounded-md bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50"
                    aria-label={`Delete ${board.name}`}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {activeRun && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Latest run: {activeRun.board.name}</h2>
              <p className="text-sm text-gray-500">
                Total found: {activeRun.total_found} | Fit matched: {activeRun.fit_matched} | Apply ready: {activeRun.apply_ready}
              </p>
            </div>
            <button
              onClick={clearRunResult}
              className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200"
            >
              Clear
            </button>
          </div>

          {activeRun.matched_jobs.length === 0 && <p className="text-sm text-gray-500">No fit-matched jobs in this run.</p>}
          <div className="space-y-2">
            {activeRun.matched_jobs.slice(0, 8).map((job) => (
              <div key={job.id} className="border border-gray-100 rounded-md p-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{job.title}</p>
                  <p className="text-xs text-gray-600">{job.company} {job.location ? `- ${job.location}` : ''}</p>
                  <p className="text-xs text-gray-500">Fit: {job.fit_score !== null ? `${job.fit_score.toFixed(1)}/10` : 'not scored'}</p>
                </div>
                {job.url && (
                  <a
                    href={job.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                  >
                    Open
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => navigate('/jobs/list')}
              className="px-4 py-2 text-sm rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            >
              View jobs list
            </button>
            <button
              onClick={() => navigate('/tracker')}
              className="px-4 py-2 text-sm rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100"
            >
              Open tracker
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
