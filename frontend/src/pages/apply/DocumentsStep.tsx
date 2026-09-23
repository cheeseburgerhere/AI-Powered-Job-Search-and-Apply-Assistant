import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import type { ApplyFlow } from './useApplyFlow'
import { useServerAi } from '../../stores/metaStore'
import { AgentHint } from '../../components/ui/AgentHint'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Field'
import { SectionHeading } from '../../components/ui/Layout'

export function DocumentsStep({ flow }: { flow: ApplyFlow }) {
  const serverAi = useServerAi()
  const [question, setQuestion] = useState('')

  const send = async () => {
    const q = question.trim()
    if (!q) return
    setQuestion('')
    await flow.ask(q)
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <SectionHeading>Files to attach</SectionHeading>
        <div className="flex flex-wrap gap-2">
          <Button onClick={flow.downloadResume} disabled={flow.busy === 'download'}>
            Resume PDF
          </Button>
          <Button onClick={flow.downloadLetter} disabled={!flow.hasLetter || flow.busy === 'download'}>
            Cover letter PDF{flow.selected ? ` (v${flow.selected.version})` : ''}
          </Button>
        </div>
        {!flow.hasLetter && <p className="text-xs text-ink-faint">No letter for this application.</p>}
      </section>

      <section className="space-y-3">
        <SectionHeading>Questions about this application</SectionHeading>
        {serverAi ? (
          <>
            {flow.chat.length > 0 && (
              <ol className="max-h-80 space-y-3 overflow-y-auto">
                {flow.chat.map((message, i) => (
                  <li key={i} className={message.role === 'user' ? 'text-sm font-medium text-ink' : 'border-l border-rule pl-4 text-sm text-ink-muted'}>
                    {message.role === 'user' ? (
                      message.content
                    ) : (
                      <div className="space-y-2 [&_li]:ml-4 [&_ol]:list-decimal [&_ul]:list-disc">
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                send()
              }}
            >
              <Input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="How should I answer “Why this company?” in 100 words?"
                aria-label="Question"
              />
              <Button type="submit" disabled={!question.trim() || flow.busy === 'chat'}>
                {flow.busy === 'chat' ? 'Thinking…' : 'Ask'}
              </Button>
            </form>
          </>
        ) : (
          <AgentHint
            label="Ask your agent"
            prompt={`Help me with my application${flow.jobId ? ` for job #${flow.jobId}` : ` to ${flow.details?.company}`}: <your question>. Use my profile and the job description; don't invent experience.`}
          />
        )}
      </section>

      <div className="flex flex-wrap gap-2 border-t border-rule pt-4">
        <Button variant="primary" onClick={flow.markApplied} disabled={flow.busy === 'applied'}>
          {flow.busy === 'applied' ? 'Saving…' : 'Mark as applied'}
        </Button>
        <Button variant="quiet" onClick={() => flow.setStep('letter')}>
          Back to letter
        </Button>
      </div>
      <p className="text-xs text-ink-faint">
        Submit the application on the company's site yourself; this only records it. Jobs without a follow-up date get one
        two weeks out.
      </p>
    </div>
  )
}
