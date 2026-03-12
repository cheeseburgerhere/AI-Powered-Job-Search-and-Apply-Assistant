import { useEffect, useState } from 'react'
import { useProfileStore } from '../stores/profileStore'
import { Upload, FileText, Plus, Sparkles, CheckCircle2, Loader2 } from 'lucide-react'

export default function Onboarding() {
  const { profile, loading, error, fetchProfile, uploadResume, addWritingSample, analyzeVoice, updatePreferences } =
    useProfileStore()
  const [resumeText, setResumeText] = useState('')
  const [sampleText, setSampleText] = useState('')
  const [prefsForm, setPrefsForm] = useState({
    roles: '',
    locations: '',
    remote: true,
    salary_min: '',
    salary_max: '',
    industries: '',
  })

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  useEffect(() => {
    if (profile?.preferences) {
      const p = profile.preferences
      setPrefsForm({
        roles: (p.roles || []).join(', '),
        locations: (p.locations || []).join(', '),
        remote: p.remote ?? true,
        salary_min: p.salary_min?.toString() || '',
        salary_max: p.salary_max?.toString() || '',
        industries: (p.industries || []).join(', '),
      })
    }
  }, [profile?.preferences])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) await uploadResume(file)
  }

  const handleTextUpload = async () => {
    if (resumeText.trim()) await uploadResume(undefined, resumeText)
  }

  const handleAddSample = async () => {
    if (sampleText.trim()) {
      await addWritingSample(sampleText)
      setSampleText('')
    }
  }

  const handleSavePrefs = async () => {
    await updatePreferences({
      roles: prefsForm.roles.split(',').map((s) => s.trim()).filter(Boolean),
      locations: prefsForm.locations.split(',').map((s) => s.trim()).filter(Boolean),
      remote: prefsForm.remote,
      salary_min: prefsForm.salary_min ? parseInt(prefsForm.salary_min) : null,
      salary_max: prefsForm.salary_max ? parseInt(prefsForm.salary_max) : null,
      industries: prefsForm.industries.split(',').map((s) => s.trim()).filter(Boolean),
    })
  }

  const hasProfile = profile && profile.full_name

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profile & Onboarding</h1>
        <p className="text-gray-500 mt-1">Upload your resume and set your preferences. This powers everything else.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>
      )}

      {/* Resume Upload */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Upload size={20} />
          Resume Upload
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* File upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Upload PDF</label>
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              disabled={loading}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
            />
          </div>

          {/* Text paste */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Or paste resume text</label>
            <textarea
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              rows={4}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Paste your resume text here..."
            />
            <button
              onClick={handleTextUpload}
              disabled={loading || !resumeText.trim()}
              className="mt-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
              Parse Resume
            </button>
          </div>
        </div>
      </section>

      {/* Parsed Profile */}
      {hasProfile && (
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CheckCircle2 size={20} className="text-green-500" />
            Parsed Profile
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-500">Name:</span>{' '}
              <span className="text-gray-900">{profile.full_name}</span>
            </div>
            <div>
              <span className="font-medium text-gray-500">Email:</span>{' '}
              <span className="text-gray-900">{profile.email}</span>
            </div>
            <div>
              <span className="font-medium text-gray-500">Phone:</span>{' '}
              <span className="text-gray-900">{profile.phone}</span>
            </div>
            <div>
              <span className="font-medium text-gray-500">Location:</span>{' '}
              <span className="text-gray-900">{profile.location}</span>
            </div>
          </div>

          {profile.summary && (
            <div className="mt-4">
              <span className="font-medium text-gray-500 text-sm">Summary:</span>
              <p className="text-sm text-gray-700 mt-1">{profile.summary}</p>
            </div>
          )}

          {profile.skills?.length > 0 && (
            <div className="mt-4">
              <span className="font-medium text-gray-500 text-sm">Skills:</span>
              <div className="flex flex-wrap gap-2 mt-1">
                {profile.skills.map((skill, i) => (
                  <span key={i} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-md">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {profile.experiences?.length > 0 && (
            <div className="mt-4">
              <span className="font-medium text-gray-500 text-sm">Experience:</span>
              <div className="space-y-3 mt-2">
                {profile.experiences.map((exp, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-3">
                    <div className="font-medium text-sm">{exp.title} at {exp.company}</div>
                    <div className="text-xs text-gray-500">{exp.start_date} — {exp.end_date}</div>
                    {exp.bullets?.length > 0 && (
                      <ul className="mt-1 text-xs text-gray-600 space-y-1">
                        {exp.bullets.map((b, j) => (
                          <li key={j}>• {b}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {profile.education?.length > 0 && (
            <div className="mt-4">
              <span className="font-medium text-gray-500 text-sm">Education:</span>
              <div className="space-y-2 mt-1">
                {profile.education.map((edu, i) => (
                  <div key={i} className="text-sm">
                    {edu.degree} in {edu.field} — {edu.school} ({edu.start_date} – {edu.end_date})
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Preferences */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">Job Preferences</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Target Roles (comma-separated)</label>
            <input
              type="text"
              value={prefsForm.roles}
              onChange={(e) => setPrefsForm((p) => ({ ...p, roles: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Senior Developer, Tech Lead"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Locations (comma-separated)</label>
            <input
              type="text"
              value={prefsForm.locations}
              onChange={(e) => setPrefsForm((p) => ({ ...p, locations: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="San Francisco, Remote"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Min Salary</label>
            <input
              type="number"
              value={prefsForm.salary_min}
              onChange={(e) => setPrefsForm((p) => ({ ...p, salary_min: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="80000"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max Salary</label>
            <input
              type="number"
              value={prefsForm.salary_max}
              onChange={(e) => setPrefsForm((p) => ({ ...p, salary_max: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="150000"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Industries (comma-separated)</label>
            <input
              type="text"
              value={prefsForm.industries}
              onChange={(e) => setPrefsForm((p) => ({ ...p, industries: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Tech, Finance, Healthcare"
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={prefsForm.remote}
                onChange={(e) => setPrefsForm((p) => ({ ...p, remote: e.target.checked }))}
                className="rounded"
              />
              Open to remote
            </label>
          </div>
        </div>
        <button
          onClick={handleSavePrefs}
          disabled={loading}
          className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          Save Preferences
        </button>
      </section>

      {/* Writing Samples & Voice */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Sparkles size={20} />
          Writing Voice
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Add samples of your writing (emails, cover letters, LinkedIn posts) so the AI can match your tone.
        </p>

        <textarea
          value={sampleText}
          onChange={(e) => setSampleText(e.target.value)}
          rows={4}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Paste a writing sample here..."
        />
        <div className="flex gap-3 mt-3">
          <button
            onClick={handleAddSample}
            disabled={loading || !sampleText.trim()}
            className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 disabled:opacity-50 flex items-center gap-2"
          >
            <Plus size={16} />
            Add Sample
          </button>
          <button
            onClick={analyzeVoice}
            disabled={loading || !profile?.writing_samples?.length}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            Analyze My Voice
          </button>
        </div>

        {profile?.writing_samples && profile.writing_samples.length > 0 && (
          <div className="mt-4">
            <span className="text-sm font-medium text-gray-500">{profile.writing_samples.length} sample(s) added</span>
          </div>
        )}

        {profile?.voice_profile && (
          <div className="mt-4 bg-purple-50 border border-purple-200 rounded-lg p-4">
            <span className="text-sm font-medium text-purple-700">Your Voice Profile:</span>
            <p className="text-sm text-purple-900 mt-1">{profile.voice_profile}</p>
          </div>
        )}
      </section>
    </div>
  )
}
