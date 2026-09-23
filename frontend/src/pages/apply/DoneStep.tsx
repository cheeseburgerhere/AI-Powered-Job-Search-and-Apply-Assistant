import { Link } from 'react-router-dom'
import type { ApplyFlow } from './useApplyFlow'
import { Button } from '../../components/ui/Button'
import { buttonClass } from '../../components/ui/styles'

export function DoneStep({ flow }: { flow: ApplyFlow }) {
  return (
    <div className="max-w-xl space-y-4">
      <p className="font-serif text-2xl text-ink">Recorded as applied.</p>
      <p className="text-sm text-ink-muted">
        {flow.details?.title} at {flow.details?.company} is now in the Applied column. Its follow-up reminder shows up on
        Today when it's due.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={flow.reset}>
          Apply to another job
        </Button>
        {flow.jobId && (
          <Link to={`/jobs?id=${flow.jobId}`} className={buttonClass('secondary')}>
            Open job
          </Link>
        )}
        <Link to="/tracker" className={buttonClass('quiet')}>
          Tracker
        </Link>
      </div>
    </div>
  )
}
