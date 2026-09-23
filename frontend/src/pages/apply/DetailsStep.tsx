import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import type { ApplyFlow } from './useApplyFlow'
import { readableText } from '../../lib/jobs'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'
import { SectionHeading } from '../../components/ui/Layout'

export function DetailsStep({ flow }: { flow: ApplyFlow }) {
  const [expanded, setExpanded] = useState(false)
  const details = flow.details
  if (!details) return null

  const description = readableText(details.description)
  const long = description.length > 1200

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h2 className="font-serif text-[26px] leading-tight text-ink">{details.title}</h2>
        <p className="text-sm text-ink-muted">{details.company}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-sm">
          {details.link && (
            <a href={details.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
              Posting <ArrowUpRight size={13} />
            </a>
          )}
          {details.link && (
            <button
              type="button"
              onClick={flow.rescrape}
              disabled={flow.busy === 'rescrape'}
              className="text-ink-muted hover:text-ink hover:underline"
            >
              {flow.busy === 'rescrape' ? 'Reading again…' : 'Read posting again'}
            </button>
          )}
          {flow.jobId ? (
            <Link to={`/jobs?id=${flow.jobId}`} className="text-ink-muted hover:text-ink hover:underline">
              Saved as job #{flow.jobId}
            </Link>
          ) : null}
        </div>
      </header>

      <section className="space-y-2">
        <SectionHeading>Description</SectionHeading>
        <div
          className={
            'text-sm leading-relaxed whitespace-pre-line text-ink ' +
            (long && !expanded ? 'max-h-72 overflow-hidden [mask-image:linear-gradient(to_bottom,black_70%,transparent)]' : '')
          }
        >
          {description || <span className="text-ink-faint">No description found. Try reading the posting again.</span>}
        </div>
        {long && (
          <Button variant="quiet" size="sm" onClick={() => setExpanded((v) => !v)}>
            {expanded ? 'Show less' : 'Show full description'}
          </Button>
        )}
      </section>

      {details.company_info && (
        <section className="space-y-2">
          <SectionHeading>About the company</SectionHeading>
          <p className="text-sm leading-relaxed text-ink-muted">{details.company_info}</p>
        </section>
      )}

      <section className="space-y-3">
        <SectionHeading>Company website</SectionHeading>
        <p className="text-sm text-ink-muted">Optional. Adds context from the company's own site to a server-generated letter.</p>
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Website" className="min-w-64 flex-1">
            <Input type="url" value={flow.website} onChange={(e) => flow.setWebsite(e.target.value)} placeholder="https://company.com" />
          </Field>
          <Button onClick={flow.fetchContext} disabled={!flow.website.trim() || flow.busy === 'context'}>
            {flow.busy === 'context' ? 'Reading…' : 'Read website'}
          </Button>
        </div>
        {flow.websiteContext !== null && (
          <p className="max-h-44 overflow-y-auto border-l border-rule pl-4 text-sm leading-relaxed whitespace-pre-wrap text-ink-muted">
            {flow.websiteContext || 'Nothing useful found on that site.'}
          </p>
        )}
      </section>

      <div className="flex flex-wrap gap-2 border-t border-rule pt-4">
        <Button variant="primary" onClick={() => flow.setStep('letter')}>
          Continue to letter
        </Button>
        {!flow.jobId && (
          <Button onClick={flow.saveInterested} disabled={flow.busy === 'save'}>
            {flow.busy === 'save' ? 'Saving…' : 'Save as Interested'}
          </Button>
        )}
        <Button variant="quiet" onClick={flow.reset}>
          Start over
        </Button>
      </div>
    </div>
  )
}
