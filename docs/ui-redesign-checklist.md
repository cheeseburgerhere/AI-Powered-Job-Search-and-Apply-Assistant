# UI redesign — functionality checklist

Every API call the UI made before the redesign, and the screen that owns it afterwards.
Tick each row in phase 6 after clicking through it in the running app, once with server AI
configured and once without. "AI" marks actions shown only when `/api/meta/capabilities`
reports `server_ai: true`.

Delete this file when the `redesign/ledger-ui` branch merges.

## Jobs (`jobStore`)

| Done | Call | New home | AI |
|---|---|---|---|
| [ ] | `GET /jobs` | Jobs list, Today, Letters job picker | |
| [ ] | `POST /jobs` | Jobs → "Add job" drawer; Apply save step | |
| [ ] | `PUT /jobs/:id` (status, notes, fields) | Jobs detail pane; Tracker moves | |
| [ ] | `DELETE /jobs/:id` | Jobs detail pane | |
| [ ] | `POST /jobs/:id/score` | Jobs detail pane | AI |
| [ ] | `POST /jobs/search` | Find (both tabs); `score_results` only when AI | partly |
| [ ] | `GET /jobs/nudges` | Today → follow-ups due | |
| [ ] | `GET /jobs/providers/health` | Find → inline source status | |

## Profile (`profileStore`)

| Done | Call | New home | AI |
|---|---|---|---|
| [ ] | `GET /profile` (+ `needs_parsing`) | Profile, Today review queue | |
| [ ] | `POST /profile/upload-resume` | Profile → Resume | |
| [ ] | `PUT /profile` | Profile → Edit details (new: the old page never used it) | |
| [ ] | `PUT /profile/preferences` | Profile → Preferences | |
| [ ] | `POST /profile/writing-sample` | Profile → Writing voice | |
| [ ] | `POST /profile/analyze-voice` | Profile → Writing voice | AI |
| [ ] | `GET /profile/resume/download` | Profile → Resume; Apply documents step | |

## Cover letters (`coverLetterStore` + QuickApply)

| Done | Call | New home | AI |
|---|---|---|---|
| [ ] | `GET /cover-letters` (`?job_id=`) | Letters; Jobs detail; Apply review | |
| [ ] | `POST /cover-letters/generate` | Letters; Apply generate step | AI |
| [ ] | `POST /cover-letters/:id/refine` | Letters; Apply review | AI |
| [ ] | `PUT /cover-letters/:id` | Letters → Save, only for your own latest draft | |
| [ ] | `PUT /cover-letters/:id/status` | Letters → Approve / Back to draft | |
| [ ] | `POST /cover-letters/:id/manual-version` | Letters → Save as vN (agent/server/older versions); Apply review | |
| [ ] | `GET /cover-letters/:id/download` | Letters; Apply documents step | |

## Apply flow (QuickApply)

| Done | Call | New home | AI |
|---|---|---|---|
| [ ] | `POST /apply/scrape/debug` | Apply → Posting, and Details → Read posting again | |
| [ ] | `POST /apply/generate-cover-letter` | Apply generate step (unsaved job) | AI |
| [ ] | `POST /apply/refine-cover-letter` | Apply review (unsaved job) | AI |
| [ ] | `POST /apply/cover-letter/pdf` | Apply documents step | |
| [ ] | `POST /apply/company-context` | Apply → Details → Read website | |
| [ ] | `POST /apply/chat` | Apply → "Ask anything" | AI |
| [ ] | `GET /jobs/:id` (prefill via `?jobId=`) | Apply entry from Jobs / Tracker | |

## Tracker (`trackerStore`)

| Done | Call | New home | AI |
|---|---|---|---|
| [ ] | `GET /tracker/board` | Tracker | |
| [ ] | `GET /tracker/stats` | Today pipeline line; Tracker header | |
| [ ] | `GET /tracker/events` (per job, or cross-job feed with `limit`) | Today → recent activity | |
| [ ] | `GET /tracker/rejected-bins` | Tracker → rejected bins | |

## Removed with the dead pages (backend routes kept)

- `POST /apply/plan/:id` (ApplyQueue)
- `/job-boards` CRUD and `/job-boards/:id/run` (JobBoardAgent)

## Legacy routes that must redirect

`/onboarding` → `/profile`, `/jobs/list` → `/jobs`, `/jobs/find` → `/find`,
`/jobs/find/api` → `/find?tab=api`, `/jobs/find/scrape` → `/find?tab=boards`,
`/cover-letters` → `/letters` (query strings preserved).

## Behaviour changes to keep in mind

- `GET /jobs/providers/health` runs live queries, so Find calls it only from "Test providers"
  instead of on every page load. Configured/unconfigured state comes from capabilities.
- Find adds a "Company boards" tab for direct Greenhouse/Lever/Ashby search by company slug,
  which the backend and MCP already supported but the old UI never exposed.
- Search results merge into the saved jobs list instead of replacing it in the store.
- Cover letters carry `source` (agent / server / manual / unknown). Editing someone else's
  version always saves a new manual version, so agent drafts stay in the history.
- Without server AI, Writing voice shows an agent prompt once samples exist. The agent reads them
  with `get_writing_samples` (contact details masked) and saves the result with `save_voice_profile`.
