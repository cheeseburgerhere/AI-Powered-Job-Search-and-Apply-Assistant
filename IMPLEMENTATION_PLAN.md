# AI Job Assistant — Implementation Plan

## Overview

A personal AI-powered job application tool with 5 modules:

1. **Resume & Tone Ingestion** — Parse resume, build structured profile, capture writing voice
2. **Cover Letter Generator** — AI-tailored cover letters from JD + profile
3. **Application Tracker** — Kanban-style pipeline with follow-up nudges
4. **Job Discovery** — API-powered job search with AI fit scoring
5. **Auto-Filler Extension** — Browser extension to fill application forms

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | React 18 + TypeScript + Vite | Fast dev, type safety |
| UI Components | shadcn/ui + Tailwind CSS | Clean, minimal, customizable |
| State Management | Zustand | Lightweight, no boilerplate |
| Backend | FastAPI (Python) | Async, great for AI orchestration |
| AI Layer | Claude API (Anthropic SDK) | Cover letters, fit scoring, parsing |
| Database | SQLite + SQLAlchemy | Zero config, single user, portable |
| Job APIs | JSearch (RapidAPI) + Adzuna | Free tiers, good coverage |
| Browser Extension | Chrome Extension (Manifest V3) | Form auto-fill |

> **Why SQLite over Supabase?** Single user, no auth needed, zero infrastructure, portable, and dead simple. If you ever want to migrate to Postgres/Supabase later, SQLAlchemy makes that a one-line change.

---

## Project Structure

```
ai-job-assistant/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI entry point
│   │   ├── config.py                # Settings, API keys (env vars)
│   │   ├── database.py              # SQLite + SQLAlchemy setup
│   │   ├── models/
│   │   │   ├── profile.py           # Resume/profile DB model
│   │   │   ├── job.py               # Job listing DB model
│   │   │   ├── cover_letter.py      # Cover letter DB model
│   │   │   └── tracker.py           # Tracker event DB model
│   │   ├── schemas/
│   │   │   ├── profile.py           # Pydantic request/response schemas
│   │   │   ├── job.py
│   │   │   ├── cover_letter.py
│   │   │   └── tracker.py
│   │   ├── routers/
│   │   │   ├── profile.py           # /api/profile endpoints
│   │   │   ├── jobs.py              # /api/jobs endpoints
│   │   │   ├── cover_letters.py     # /api/cover-letters endpoints
│   │   │   └── tracker.py           # /api/tracker endpoints
│   │   ├── services/
│   │   │   ├── ai_service.py        # Claude API wrapper (all prompts)
│   │   │   ├── resume_parser.py     # PDF/text → structured profile
│   │   │   ├── job_search.py        # JSearch + Adzuna API clients
│   │   │   ├── fit_scorer.py        # AI fit scoring logic
│   │   │   ├── cover_letter_gen.py  # Cover letter generation + refinement
│   │   │   └── nudge_service.py     # Follow-up reminder checker
│   │   └── prompts/
│   │       ├── resume_parse.py      # Prompt templates for resume parsing
│   │       ├── fit_score.py         # Prompt templates for scoring
│   │       └── cover_letter.py      # Prompt templates for cover letters
│   ├── requirements.txt
│   ├── .env.example
│   └── alembic/                     # DB migrations (optional, nice to have)
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── api/
│   │   │   └── client.ts            # Axios/fetch wrapper
│   │   ├── stores/
│   │   │   ├── profileStore.ts
│   │   │   ├── jobStore.ts
│   │   │   ├── coverLetterStore.ts
│   │   │   └── trackerStore.ts
│   │   ├── pages/
│   │   │   ├── Onboarding.tsx        # Resume upload + preferences
│   │   │   ├── Dashboard.tsx         # Overview / home
│   │   │   ├── JobFeed.tsx           # Ranked job listings
│   │   │   ├── CoverLetterEditor.tsx # Generate + edit cover letters
│   │   │   └── Tracker.tsx           # Kanban board
│   │   ├── components/
│   │   │   ├── ResumeUploader.tsx
│   │   │   ├── JobCard.tsx
│   │   │   ├── FitScoreBadge.tsx
│   │   │   ├── CoverLetterPreview.tsx
│   │   │   ├── KanbanBoard.tsx
│   │   │   ├── KanbanColumn.tsx
│   │   │   ├── NudgeAlert.tsx
│   │   │   └── Layout.tsx
│   │   └── lib/
│   │       └── utils.ts
│   ├── index.html
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── package.json
│
├── extension/                        # Chrome Extension (Phase 5)
│   ├── manifest.json
│   ├── background.js
│   ├── content/
│   │   ├── formDetector.js           # Detect form fields on page
│   │   ├── fieldMapper.js            # Map profile fields → form fields
│   │   └── autoFiller.js             # Fill logic
│   ├── popup/
│   │   ├── popup.html
│   │   └── popup.js
│   └── icons/
│
└── README.md
```

---

## Data Model

### Profile

```
profile
├── id                    (int, PK)
├── full_name             (str)
├── email                 (str)
├── phone                 (str)
├── location              (str)
├── summary               (text)         # AI-generated professional summary
├── raw_resume_text       (text)         # Original uploaded text
├── resume_file_path      (str, nullable)# Path to uploaded PDF
├── skills                (JSON)         # ["Python", "React", ...]
├── experiences           (JSON)         # [{company, title, dates, bullets}, ...]
├── education             (JSON)         # [{school, degree, dates}, ...]
├── certifications        (JSON)         # [{name, issuer, date}, ...]
├── writing_samples       (JSON)         # [str, ...] for tone analysis
├── voice_profile         (text)         # AI-analyzed writing style description
├── preferences           (JSON)         # {roles, locations, remote, salary, industries}
├── created_at            (datetime)
└── updated_at            (datetime)
```

### Job

```
job
├── id                    (int, PK)
├── external_id           (str, nullable) # ID from job API
├── source                (str)           # "jsearch", "adzuna", "manual"
├── title                 (str)
├── company               (str)
├── location              (str)
├── remote_type           (str)           # "remote", "hybrid", "onsite"
├── salary_min            (int, nullable)
├── salary_max            (int, nullable)
├── description           (text)          # Full JD text
├── url                   (str, nullable) # Link to original posting
├── fit_score             (float, nullable) # 1-10
├── fit_reasoning         (text, nullable)  # AI explanation
├── status                (str)           # "discovered", "interested", "applied",
│                                         # "follow_up", "interview", "offer", "rejected"
├── date_saved            (datetime)
├── date_applied          (datetime, nullable)
├── next_follow_up        (datetime, nullable)
├── notes                 (text, nullable)
├── created_at            (datetime)
└── updated_at            (datetime)
```

### CoverLetter

```
cover_letter
├── id                    (int, PK)
├── job_id                (int, FK → job.id)
├── version               (int)           # 1, 2, 3... for iteration
├── content               (text)          # The letter itself
├── feedback              (text, nullable)# User feedback that triggered this version
├── status                (str)           # "draft", "ready"
├── created_at            (datetime)
└── updated_at            (datetime)
```

### TrackerEvent

```
tracker_event
├── id                    (int, PK)
├── job_id                (int, FK → job.id)
├── from_status           (str)
├── to_status             (str)
├── note                  (text, nullable)
├── created_at            (datetime)      # Automatic timestamp
```

---

## API Endpoints

### Profile

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/profile` | Get current profile |
| POST | `/api/profile/upload-resume` | Upload resume (PDF/text), AI parses it |
| PUT | `/api/profile` | Update profile fields manually |
| POST | `/api/profile/writing-sample` | Add a writing sample for tone analysis |
| POST | `/api/profile/analyze-voice` | Trigger AI voice profile generation |
| PUT | `/api/profile/preferences` | Update job preferences |

### Jobs

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/jobs/search` | Search jobs via APIs, score & return ranked |
| GET | `/api/jobs` | List saved jobs (filterable by status) |
| POST | `/api/jobs` | Manually add a job (paste JD) |
| GET | `/api/jobs/{id}` | Get job details |
| PUT | `/api/jobs/{id}` | Update job (status, notes, follow-up date) |
| DELETE | `/api/jobs/{id}` | Remove a job |
| POST | `/api/jobs/{id}/score` | Re-score a specific job against profile |
| GET | `/api/jobs/nudges` | Get jobs needing follow-up |

### Cover Letters

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/cover-letters/generate` | Generate cover letter for a job |
| GET | `/api/cover-letters?job_id=X` | Get all versions for a job |
| GET | `/api/cover-letters/{id}` | Get specific cover letter |
| POST | `/api/cover-letters/{id}/refine` | Refine with feedback (creates new version) |
| PUT | `/api/cover-letters/{id}/status` | Mark as draft/ready |

### Tracker

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tracker/board` | Get all jobs grouped by status (kanban view) |
| GET | `/api/tracker/events?job_id=X` | Get status history for a job |
| GET | `/api/tracker/stats` | Summary stats (applied, interviews, etc.) |

---

## AI Prompting Strategy

### 1. Resume Parsing Prompt

```
System: You are a resume parser. Extract structured data from the following resume text.
Return a JSON object with: full_name, email, phone, location, summary, skills (array),
experiences (array of {company, title, start_date, end_date, bullets: []}),
education (array of {school, degree, field, start_date, end_date}),
certifications (array of {name, issuer, date}).
Be precise. Do not fabricate information not present in the resume.

User: <resume_text>
```

### 2. Voice Analysis Prompt

```
System: Analyze the following writing samples from a job applicant.
Describe their writing style in 3-5 sentences covering: tone (formal/casual/confident),
sentence structure preferences, vocabulary level, personality that comes through.
This description will be used to generate cover letters that match their voice.

User: <writing_samples>
```

### 3. Fit Scoring Prompt

```
System: You are a job fit analyst. Given a candidate's profile and a job description,
score the fit from 1-10 and explain your reasoning.

Return JSON: {
  "score": <1-10>,
  "top_reasons": ["reason1", "reason2", "reason3"],
  "gaps": ["gap1", "gap2"],
  "summary": "<2-3 sentence fit summary>"
}

Be honest — a 7+ should mean strong alignment on most requirements.
A 4 or below means significant mismatches.

User:
CANDIDATE PROFILE:
<structured_profile>

JOB DESCRIPTION:
<jd_text>
```

### 4. Cover Letter Generation Prompt

```
System: Write a cover letter for this candidate applying to this role.

Rules:
- Match the candidate's writing voice: <voice_profile>
- Address specific requirements from the JD
- Map candidate's experiences to the role's needs with concrete examples
- Keep it under 400 words
- Don't be generic — reference the company and role specifically
- Sound human, not like AI wrote it
- Don't start with "I am writing to express my interest"

User:
CANDIDATE PROFILE:
<structured_profile>

JOB DESCRIPTION:
<jd_text>

COMPANY: <company_name>
ROLE: <role_title>
```

### 5. Cover Letter Refinement Prompt

```
System: Refine this cover letter based on the user's feedback.
Maintain the same voice and structure unless told otherwise.
Only change what the feedback asks for.

User:
CURRENT LETTER:
<current_letter>

FEEDBACK:
<user_feedback>
```

---

## Build Phases

---

### Phase 1: Foundation + Resume Ingestion (Week 1-2)

**Goal:** Project scaffolding, database, profile ingestion, and a working onboarding page.

#### Backend Tasks

| # | Task | Details |
|---|------|---------|
| 1.1 | Project setup | Init FastAPI project, virtual env, install deps (fastapi, uvicorn, sqlalchemy, anthropic, python-multipart, pdfplumber) |
| 1.2 | Config & env | `.env` with `ANTHROPIC_API_KEY`, `DATABASE_URL`. Pydantic `Settings` class |
| 1.3 | Database setup | SQLite + SQLAlchemy. Create `Profile` model. `database.py` with engine, session, create_all |
| 1.4 | Resume parser service | `resume_parser.py` — Accept PDF (use `pdfplumber` to extract text) or raw text. Call Claude to parse into structured JSON. Return parsed profile |
| 1.5 | Profile router | `POST /api/profile/upload-resume` — accepts file or text, parses, stores. `GET /api/profile` — returns profile. `PUT /api/profile` — manual edits |
| 1.6 | Writing sample & voice | `POST /api/profile/writing-sample` — store samples. `POST /api/profile/analyze-voice` — send samples to Claude, store voice profile description |
| 1.7 | Preferences endpoint | `PUT /api/profile/preferences` — store role/location/remote/salary/industry prefs as JSON |

#### Frontend Tasks

| # | Task | Details |
|---|------|---------|
| 1.8 | Project setup | `npm create vite@latest` with React+TS. Install tailwind, shadcn/ui, zustand, axios, react-router-dom |
| 1.9 | Layout component | Sidebar nav (Onboarding, Jobs, Cover Letters, Tracker). Top bar. Content area |
| 1.10 | Onboarding page | File upload (PDF) or textarea for resume paste. "Parse Resume" button → calls API. Shows parsed result for review/edit. Preferences form (role types, locations, remote toggle, salary range, industries). Writing sample textarea with "Add Sample" button. "Analyze My Voice" button. Success state showing profile summary |
| 1.11 | API client | Axios instance with base URL, typed request/response helpers |
| 1.12 | Profile store | Zustand store: profile data, loading states, actions (uploadResume, updateProfile, etc.) |

#### Deliverable

- Upload a resume → see it parsed into structured fields
- Edit parsed profile
- Set job preferences
- Add writing samples and generate a voice profile
- Everything persisted in SQLite

---

### Phase 2: Cover Letter Generator (Week 3-4)

**Goal:** Generate, iterate, and manage cover letters. This is the highest-value feature.

#### Backend Tasks

| # | Task | Details |
|---|------|---------|
| 2.1 | Job & CoverLetter models | Add `Job` and `CoverLetter` SQLAlchemy models |
| 2.2 | Manual job add endpoint | `POST /api/jobs` — paste a JD + URL + company + title. Stores the job with status "interested" |
| 2.3 | Cover letter generation | `POST /api/cover-letters/generate` — takes `job_id`. Loads profile + voice + JD. Calls Claude with cover letter prompt. Saves as version 1, status "draft" |
| 2.4 | Cover letter refinement | `POST /api/cover-letters/{id}/refine` — takes feedback text. Loads current letter + feedback. Calls Claude with refinement prompt. Saves as new version |
| 2.5 | Cover letter CRUD | `GET /api/cover-letters?job_id=X`, `GET /api/cover-letters/{id}`, `PUT /api/cover-letters/{id}/status` |
| 2.6 | Fit scoring (basic) | `POST /api/jobs/{id}/score` — given a manually added job, score fit against profile |

#### Frontend Tasks

| # | Task | Details |
|---|------|---------|
| 2.7 | "Add Job" form | Simple form: paste JD, enter company, title, URL. Calls POST /api/jobs. Option to auto-score fit |
| 2.8 | Cover Letter Editor page | Two-panel layout: left = JD summary + key requirements extracted, right = generated cover letter. "Generate" button (with loading state — Claude takes a few seconds). Version history dropdown. Feedback textarea + "Refine" button. "Mark as Ready" button. Copy to clipboard button |
| 2.9 | Cover letter store | Zustand store: cover letters by job, versions, generate/refine actions |
| 2.10 | Job detail view | Show job info, fit score badge (color-coded 1-10), linked cover letters |

#### Deliverable

- Paste a job description → get a tailored cover letter in your voice
- Iterate with feedback ("make it shorter", "emphasize Python more")
- See version history
- Copy the final letter to clipboard

---

### Phase 3: Application Tracker (Week 5-6)

**Goal:** Kanban board to track all applications with automatic follow-up nudges.

#### Backend Tasks

| # | Task | Details |
|---|------|---------|
| 3.1 | TrackerEvent model | Add `TrackerEvent` model. Auto-create event when job status changes |
| 3.2 | Status update endpoint | `PUT /api/jobs/{id}` — when status changes, create a `TrackerEvent`. Update `date_applied` when moving to "applied". Calculate `next_follow_up` (default: +14 days from applied) |
| 3.3 | Board endpoint | `GET /api/tracker/board` — return jobs grouped by status |
| 3.4 | Nudge endpoint | `GET /api/jobs/nudges` — return jobs where `status = "applied"` and `next_follow_up <= today` |
| 3.5 | Stats endpoint | `GET /api/tracker/stats` — counts by status, avg time in each stage |
| 3.6 | Event history | `GET /api/tracker/events?job_id=X` — timeline of status changes |

#### Frontend Tasks

| # | Task | Details |
|---|------|---------|
| 3.7 | Kanban Board | Columns: Interested → Applied → Follow-up → Interview → Offer / Rejected. Drag-and-drop between columns (use `@dnd-kit/core`). Each card shows: company, title, fit score, date, days since last update |
| 3.8 | Job card expanded view | Click card → side panel with full details: JD, cover letter link, status timeline, notes field, follow-up date picker |
| 3.9 | Nudge alerts | Dashboard banner or badge: "3 applications need follow-up". Click to see them. Option to snooze (push follow-up date by 7 days) |
| 3.10 | Dashboard page | Summary stats: total applications, interviews this month, response rate. Nudge alerts. Recent activity feed |
| 3.11 | Tracker store | Zustand store: board data, drag handlers, nudge data |

#### Deliverable

- Drag jobs through pipeline stages
- See timeline of status changes per job
- Get alerted when it's time to follow up
- Dashboard with summary stats

---

### Phase 4: Job Discovery (Week 7-9)

**Goal:** Automated job search with AI fit scoring and a ranked feed.

#### Backend Tasks

| # | Task | Details |
|---|------|---------|
| 4.1 | JSearch API client | `job_search.py` — call RapidAPI JSearch endpoint. Map response to `Job` schema. Handle pagination. Rate limiting |
| 4.2 | Adzuna API client | Same module — Adzuna API integration as secondary source. Normalize both to same format |
| 4.3 | Search endpoint | `POST /api/jobs/search` — takes optional overrides (query, location, remote). Uses profile preferences as defaults. Calls both APIs. Deduplicates by title+company |
| 4.4 | Batch fit scoring | For each discovered job, call Claude to score fit. Use async/batch to manage rate limits. Cache scores (don't re-score same JD) |
| 4.5 | Ranked results | Sort by fit score descending. Return top N with score + reasoning. Option to save interesting ones (status → "interested") |
| 4.6 | Search history | Optional: store search params and results so you can re-check |

#### Frontend Tasks

| # | Task | Details |
|---|------|---------|
| 4.7 | Job Feed page | Search bar with filters (role, location, remote toggle, salary range). Results as cards: title, company, location, salary, fit score badge, "why it matches" snippet. "Save" button → adds to tracker as "interested". Pagination or infinite scroll |
| 4.8 | Fit score detail | Click fit score → popover showing top 3 match reasons + gaps |
| 4.9 | Search preferences | Pre-fill from profile preferences. Save last search. "Search again" with same params |
| 4.10 | Job store | Zustand store: search results, filters, save actions, pagination |

#### Deliverable

- Set preferences → get a ranked feed of matching jobs
- See why each job matches (or doesn't)
- Save interesting ones → they appear in tracker
- Generate cover letters for saved jobs in one click

---

### Phase 5: Browser Extension — Auto-Filler (Week 10-13)

**Goal:** Chrome extension that auto-fills job application forms using your stored profile.

> This is the most complex module. It deserves its own focused sprint.

#### Architecture

```
Extension Architecture:
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  Popup UI   │────▶│  Background  │────▶│ FastAPI       │
│ (start fill)│     │  Service     │     │ /api/profile  │
└─────────────┘     │  Worker      │     └──────────────┘
                    └──────┬───────┘
                           │ sends profile data
                    ┌──────▼───────┐
                    │  Content     │
                    │  Script      │
                    │  ┌─────────┐ │
                    │  │ Detect  │ │  ← Finds form fields
                    │  │ Fields  │ │
                    │  ├─────────┤ │
                    │  │  Map    │ │  ← Maps profile → fields
                    │  │ Fields  │ │
                    │  ├─────────┤ │
                    │  │  Fill   │ │  ← Fills & validates
                    │  │ Form    │ │
                    │  └─────────┘ │
                    └──────────────┘
```

#### Tasks

| # | Task | Details |
|---|------|---------|
| 5.1 | Manifest V3 setup | `manifest.json` with permissions: `activeTab`, `storage`. Content script injection for common job sites |
| 5.2 | Profile fetch | Background worker fetches profile from FastAPI on popup open. Caches locally in `chrome.storage.local` |
| 5.3 | Form field detector | Content script that scans the DOM for form inputs. Identifies fields by: label text, `name`/`id` attributes, `placeholder` text, `aria-label`, surrounding text. Builds a map: `[{element, fieldType, confidence}]` |
| 5.4 | Field mapping engine | Maps detected fields to profile data. Use a fuzzy matching dictionary: `"first name" / "fname" / "given name" → profile.first_name`. Handle common patterns: work history sections (repeating groups), education sections, dropdowns (select elements), radio buttons (gender, veteran status, etc.), date fields (various formats) |
| 5.5 | Auto-fill logic | For each mapped field: set `value`, dispatch `input`/`change`/`blur` events (React/Angular apps need synthetic events). Handle multi-step forms (detect "next" buttons). Handle file upload fields (resume PDF) |
| 5.6 | Popup UI | Simple popup: "Fill This Form" button. Shows what it detected: "Found 12 fields, mapped 10". Preview what will be filled. "Fill All" or field-by-field fill. Status indicators (filled/skipped/needs review) |
| 5.7 | Site-specific adapters | Custom handlers for common ATS platforms: Workday, Greenhouse, Lever, Taleo, iCIMS. These override generic detection with known DOM structures |
| 5.8 | Confidence & review | Color-code filled fields: green (high confidence), yellow (medium — verify), red (couldn't fill). Highlight fields the user needs to manually complete |
| 5.9 | Testing & hardening | Test on 10+ real application forms. Handle edge cases: dynamic forms, iframe-embedded forms, shadow DOM |

#### Deliverable

- Click extension icon on any job application page
- It detects and fills form fields from your profile
- Shows confidence levels so you know what to double-check
- Works especially well on Workday, Greenhouse, Lever

---

## Cross-Cutting Concerns

### Error Handling

- Claude API failures: retry once with exponential backoff, then return graceful error
- Job API failures: return partial results from whichever source succeeded
- Frontend: toast notifications for errors, optimistic updates for status changes

### Performance

- Claude calls are the bottleneck (~2-5s each). Show loading states
- Batch fit scoring: process in parallel with `asyncio.gather`, cap at 5 concurrent
- Cache fit scores — don't re-score the same JD+profile combo
- Frontend: virtualized lists for job feed if >100 results

### Data Safety

- SQLite DB file should be in a gitignored location or user data dir
- `.env` with API keys — never committed
- Resume data stays local at all times
- No telemetry, no external data sharing

---

## Environment & Dev Setup

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install fastapi uvicorn sqlalchemy anthropic pdfplumber python-multipart aiohttp
cp .env.example .env   # Add your ANTHROPIC_API_KEY, JSEARCH_API_KEY, ADZUNA_APP_ID, ADZUNA_API_KEY
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev   # Runs on port 5173
```

### Extension

```
1. Go to chrome://extensions
2. Enable Developer Mode
3. Click "Load unpacked" → select extension/ folder
```

---

## Milestones & Success Criteria

| Phase | Milestone | You Know It Works When... |
|-------|-----------|--------------------------|
| 1 | Profile Ready | Upload PDF → see parsed name, skills, experiences correctly |
| 2 | First Cover Letter | Paste a real JD → get a letter you'd actually consider sending |
| 3 | Tracker Live | Drag a job from "Applied" to "Interview" and see the timeline update |
| 4 | Job Feed Works | Search "senior developer remote" → get 20+ scored results |
| 5 | Auto-Fill Works | Open a Workday application → click fill → 80%+ fields populated correctly |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Claude API cost | Medium | Cache aggressively. Use `haiku` for fit scoring, `sonnet` for cover letters |
| Job API rate limits | Low | JSearch free tier = 500 req/month. Adzuna = 250/day. Cache results. Search intentionally, not speculatively |
| Cover letter quality | High | Iterate on prompts extensively. Voice profile is key — invest in good writing samples |
| Extension breaks on site updates | Medium | Generic detection as fallback. Site-specific adapters are optional enhancements |
| Scope creep | High | Stick to the phase order. Each phase is independently useful. Ship and use each before starting the next |

---

## What to Build First (Today)

Start with **Phase 1, Task 1.1**: scaffold the backend and frontend projects, get a FastAPI hello-world running, get Vite + React rendering. Then move to the database and resume upload. You'll have something tangible by end of day 1.
