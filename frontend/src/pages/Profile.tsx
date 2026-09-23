import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useProfileStore, type Preferences, type Profile as ProfileData } from '../stores/profileStore'
import { useServerAi } from '../stores/metaStore'
import { errorDetail } from '../api/client'
import { downloadFile } from '../lib/download'
import { useLiveRefresh } from '../lib/useLiveRefresh'
import { AgentHint } from '../components/ui/AgentHint'
import { Button } from '../components/ui/Button'
import { Field, Input, Textarea } from '../components/ui/Field'
import { Notice, PageHeader, SectionHeading } from '../components/ui/Layout'

const splitList = (value: string) =>
  value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

export default function Profile() {
  const { profile, error, fetchProfile } = useProfileStore()
  const refresh = useCallback(() => fetchProfile(), [fetchProfile])

  useEffect(() => {
    refresh()
  }, [refresh])
  // While the resume waits for the agent to parse it, or samples wait for a voice profile, watch for the result to land.
  useLiveRefresh(() => {
    const current = useProfileStore.getState().profile
    if (current?.needs_parsing || (current?.writing_samples?.length && !current.voice_profile)) refresh()
  }, 10000)

  if (!profile) {
    return (
      <div className="space-y-6">
        <PageHeader title="Profile" />
        {error ? <Notice tone="danger">{error}</Notice> : <p className="text-sm text-ink-faint">Loading profile…</p>}
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-10">
      <PageHeader
        title="Profile"
        description="Your resume, preferences and writing voice. Job analysis and letters are built from this."
      />
      {error && <Notice tone="danger">{error}</Notice>}
      <ResumeSection profile={profile} />
      {profile.full_name && <ProfileDetails key={`details-${profile.id}`} profile={profile} />}
      <PreferencesSection key={`prefs-${profile.id}`} preferences={profile.preferences} />
      <VoiceSection profile={profile} />
    </div>
  )
}

function ResumeSection({ profile }: { profile: ProfileData }) {
  const serverAi = useServerAi()
  const { uploadResume } = useProfileStore()
  const [pasting, setPasting] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const hasResume = Boolean(profile.raw_resume_text?.trim() || profile.full_name)

  const upload = async (file?: File, pasted?: string) => {
    setBusy(true)
    await uploadResume(file, pasted)
    setBusy(false)
    if (!useProfileStore.getState().error) {
      setText('')
      setPasting(false)
    }
  }

  return (
    <section className="space-y-4">
      <SectionHeading
        aside={
          hasResume && (
            <Button
              variant="quiet"
              size="sm"
              onClick={() =>
                downloadFile('/api/profile/resume/download', 'resume.pdf').catch((err) =>
                  setDownloadError(errorDetail(err, 'Download failed')),
                )
              }
            >
              Download PDF
            </Button>
          )
        }
      >
        Resume
      </SectionHeading>

      {profile.needs_parsing ? (
        <div className="space-y-3">
          <Notice tone="warn">
            Your resume text is saved but not parsed yet. Server AI is off, so your agent structures it. This page updates
            when it does.
          </Notice>
          <AgentHint prompt="Parse my uploaded resume text and save it as my structured profile. Don't invent anything." />
        </div>
      ) : profile.full_name ? (
        <p className="text-sm text-ink-muted">
          Parsed for <span className="text-ink">{profile.full_name}</span>
          {profile.resume_file_path ? ' from an uploaded PDF.' : ' from pasted text.'}{' '}
          {serverAi ? 'Uploading again replaces it.' : 'Upload a newer version and your agent re-parses it.'}
        </p>
      ) : (
        <p className="text-sm text-ink-muted">No resume yet. Upload a PDF or paste the text.</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInput}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) upload(file)
            e.target.value = ''
          }}
        />
        <Button variant={hasResume ? 'secondary' : 'primary'} disabled={busy} onClick={() => fileInput.current?.click()}>
          {busy ? 'Uploading…' : hasResume ? 'Replace with PDF' : 'Upload PDF'}
        </Button>
        <Button variant="quiet" onClick={() => setPasting((v) => !v)}>
          {pasting ? 'Cancel paste' : 'Paste text instead'}
        </Button>
        {!serverAi && <span className="text-xs text-ink-faint">Saved as text; your agent parses it.</span>}
      </div>

      {pasting && (
        <div className="space-y-2">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={10} placeholder="Paste your resume text" />
          <Button variant="primary" disabled={busy || !text.trim()} onClick={() => upload(undefined, text)}>
            {serverAi ? 'Save and parse' : 'Save text'}
          </Button>
        </div>
      )}
      {downloadError && <Notice tone="danger">{downloadError}</Notice>}
    </section>
  )
}

function ProfileDetails({ profile }: { profile: ProfileData }) {
  const { updateProfile } = useProfileStore()
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState(() => detailsForm(profile))
  const set = (key: keyof ReturnType<typeof detailsForm>) => (value: string) => setForm((f) => ({ ...f, [key]: value }))

  const save = async () => {
    setBusy(true)
    await updateProfile({
      full_name: form.full_name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      location: form.location.trim(),
      summary: form.summary.trim(),
      skills: splitList(form.skills),
    })
    setBusy(false)
    if (!useProfileStore.getState().error) setEditing(false)
  }

  const contact = [profile.email, profile.phone, profile.location].filter(Boolean)

  return (
    <section className="space-y-4">
      <SectionHeading
        aside={
          !editing && (
            <Button
              variant="quiet"
              size="sm"
              onClick={() => {
                setForm(detailsForm(profile))
                setEditing(true)
              }}
            >
              Edit details
            </Button>
          )
        }
      >
        {profile.needs_parsing ? 'Parsed profile · from your previous resume' : 'Parsed profile'}
      </SectionHeading>

      {editing ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name">
              <Input value={form.full_name} onChange={(e) => set('full_name')(e.target.value)} />
            </Field>
            <Field label="Location">
              <Input value={form.location} onChange={(e) => set('location')(e.target.value)} />
            </Field>
            <Field label="Email">
              <Input type="email" value={form.email} onChange={(e) => set('email')(e.target.value)} />
            </Field>
            <Field label="Phone">
              <Input value={form.phone} onChange={(e) => set('phone')(e.target.value)} />
            </Field>
          </div>
          <Field label="Summary">
            <Textarea value={form.summary} onChange={(e) => set('summary')(e.target.value)} rows={4} />
          </Field>
          <Field label="Skills" hint="Comma-separated.">
            <Textarea value={form.skills} onChange={(e) => set('skills')(e.target.value)} rows={3} />
          </Field>
          <p className="text-xs text-ink-faint">Experience and education come from the resume. Re-upload or ask your agent to fix them.</p>
          <div className="flex gap-2">
            <Button variant="primary" disabled={busy || !form.full_name.trim()} onClick={save}>
              {busy ? 'Saving…' : 'Save details'}
            </Button>
            <Button variant="quiet" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div>
            <p className="font-serif text-2xl text-ink">{profile.full_name}</p>
            {contact.length > 0 && <p className="text-sm text-ink-muted">{contact.join(' · ')}</p>}
          </div>
          {profile.summary && <p className="text-sm leading-relaxed text-ink">{profile.summary}</p>}
          {profile.skills?.length > 0 && (
            <Block label="Skills">
              <p className="text-sm leading-relaxed text-ink">{profile.skills.join(' · ')}</p>
            </Block>
          )}
          {profile.experiences?.length > 0 && (
            <Block label="Experience">
              <ol className="space-y-4">
                {profile.experiences.map((exp, i) => (
                  <li key={i}>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="text-sm font-medium text-ink">
                        {exp.title}
                        {exp.company && <span className="font-normal text-ink-muted"> · {exp.company}</span>}
                      </span>
                      <span className="font-mono text-xs text-ink-faint">
                        {[exp.start_date, exp.end_date].filter(Boolean).join(' – ')}
                      </span>
                    </div>
                    {exp.bullets?.length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {exp.bullets.map((bullet, j) => (
                          <li key={j} className="grid grid-cols-[1rem_1fr] text-sm text-ink-muted">
                            <span className="text-ink-faint">–</span>
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>
            </Block>
          )}
          {profile.education?.length > 0 && (
            <Block label="Education">
              <ul className="space-y-1">
                {profile.education.map((edu, i) => (
                  <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                    <span className="text-ink">
                      {[edu.degree, edu.field].filter(Boolean).join(' in ')}
                      {edu.school && <span className="text-ink-muted"> · {edu.school}</span>}
                    </span>
                    <span className="font-mono text-xs text-ink-faint">
                      {[edu.start_date, edu.end_date].filter(Boolean).join(' – ')}
                    </span>
                  </li>
                ))}
              </ul>
            </Block>
          )}
          {profile.certifications?.length > 0 && (
            <Block label="Certifications">
              <ul className="space-y-1">
                {profile.certifications.map((cert, i) => (
                  <li key={i} className="text-sm text-ink">
                    {cert.name}
                    {cert.issuer && <span className="text-ink-muted"> · {cert.issuer}</span>}
                    {cert.date && <span className="ml-2 font-mono text-xs text-ink-faint">{cert.date}</span>}
                  </li>
                ))}
              </ul>
            </Block>
          )}
        </div>
      )}
    </section>
  )
}

function detailsForm(profile: ProfileData) {
  return {
    full_name: profile.full_name || '',
    email: profile.email || '',
    phone: profile.phone || '',
    location: profile.location || '',
    summary: profile.summary || '',
    skills: (profile.skills || []).join(', '),
  }
}

function Block({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[8rem_1fr] sm:gap-4">
      <div className="text-xs text-ink-faint">{label}</div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function PreferencesSection({ preferences }: { preferences: Preferences }) {
  const { updatePreferences } = useProfileStore()
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState(() => ({
    roles: (preferences?.roles || []).join(', '),
    locations: (preferences?.locations || []).join(', '),
    remote: preferences?.remote ?? true,
    salary_min: preferences?.salary_min?.toString() || '',
    salary_max: preferences?.salary_max?.toString() || '',
    industries: (preferences?.industries || []).join(', '),
  }))
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setSaved(false)
    setForm((f) => ({ ...f, [key]: value }))
  }

  const save = async () => {
    setBusy(true)
    await updatePreferences({
      roles: splitList(form.roles),
      locations: splitList(form.locations),
      remote: form.remote,
      salary_min: form.salary_min ? Number(form.salary_min) : null,
      salary_max: form.salary_max ? Number(form.salary_max) : null,
      industries: splitList(form.industries),
    })
    setBusy(false)
    setSaved(!useProfileStore.getState().error)
  }

  return (
    <section className="space-y-4">
      <SectionHeading>Preferences</SectionHeading>
      <p className="text-sm text-ink-muted">
        Used when a search has no query of its own, and by your agent when it ranks jobs.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Target roles" hint="Comma-separated. The first is the default search.">
          <Input value={form.roles} onChange={(e) => set('roles', e.target.value)} placeholder="Backend Engineer, Tech Lead" />
        </Field>
        <Field label="Locations" hint="Comma-separated.">
          <Input value={form.locations} onChange={(e) => set('locations', e.target.value)} placeholder="Berlin, Remote" />
        </Field>
        <Field label="Salary from">
          <Input type="number" value={form.salary_min} onChange={(e) => set('salary_min', e.target.value)} placeholder="80000" />
        </Field>
        <Field label="Salary to">
          <Input type="number" value={form.salary_max} onChange={(e) => set('salary_max', e.target.value)} placeholder="150000" />
        </Field>
        <Field label="Industries" hint="Comma-separated.">
          <Input value={form.industries} onChange={(e) => set('industries', e.target.value)} placeholder="Developer tools, Health" />
        </Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-ink">
          <input type="checkbox" checked={form.remote} onChange={(e) => set('remote', e.target.checked)} />
          Open to remote
        </label>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="primary" disabled={busy} onClick={save}>
          {busy ? 'Saving…' : 'Save preferences'}
        </Button>
        {saved && <span className="text-xs text-ok">Saved</span>}
      </div>
    </section>
  )
}

function VoiceSection({ profile }: { profile: ProfileData }) {
  const serverAi = useServerAi()
  const { addWritingSample, analyzeVoice } = useProfileStore()
  const [sample, setSample] = useState('')
  const [busy, setBusy] = useState<'add' | 'analyze' | null>(null)
  const samples = profile.writing_samples || []

  const add = async () => {
    setBusy('add')
    await addWritingSample(sample)
    setBusy(null)
    if (!useProfileStore.getState().error) setSample('')
  }

  const analyze = async () => {
    setBusy('analyze')
    await analyzeVoice()
    setBusy(null)
  }

  return (
    <section className="space-y-4">
      <SectionHeading aside={samples.length > 0 ? `${samples.length} ${samples.length === 1 ? 'sample' : 'samples'}` : undefined}>
        Writing voice
      </SectionHeading>
      <p className="text-sm text-ink-muted">
        Paste things you've written yourself (emails, past cover letters, posts) so letters sound like you.
      </p>

      {profile.voice_profile && (
        <blockquote className="border-l-2 border-accent pl-4 text-sm leading-relaxed text-ink">{profile.voice_profile}</blockquote>
      )}

      <Textarea value={sample} onChange={(e) => setSample(e.target.value)} rows={5} placeholder="Paste a writing sample" />
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={busy !== null || !sample.trim()} onClick={add}>
          {busy === 'add' ? 'Adding…' : 'Add sample'}
        </Button>
        {serverAi ? (
          <Button variant="primary" disabled={busy !== null || samples.length === 0} onClick={analyze}>
            {busy === 'analyze' ? 'Analysing…' : profile.voice_profile ? 'Re-analyse voice' : 'Analyse my voice'}
          </Button>
        ) : (
          samples.length === 0 && <span className="text-xs text-ink-faint">Your agent describes your voice from these.</span>
        )}
      </div>
      {!serverAi && samples.length > 0 && (
        <AgentHint prompt="Read my writing samples, describe my writing voice, and save it to my profile." />
      )}
    </section>
  )
}
