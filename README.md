# AI Job Assistant

Your personal command center for the modern job hunt. Upload your resume, search across multiple job boards, get AI-tailored cover letters, and track every application — all from one place.

---

## What It Does

The job search grind is brutal. You're juggling 15 browser tabs, copy-pasting the same info into every form, and losing track of what you applied to last Tuesday. This app fixes that.

- **Resume Intelligence** — Upload your PDF resume and the AI parses it, learns your skills, your experience, even your writing voice.
- **Multi-Source Job Search** — Search across JSearch, Adzuna, and Brave simultaneously, or scrape directly from Greenhouse, Lever, and Ashby job boards.
- **AI Cover Letters** — Generate tailored cover letters that actually sound like you, not a robot. Download them as polished PDFs.
- **Quick Apply** — Get a step-by-step apply plan for any job, with pre-filled talking points pulled from your profile.
- **Kanban Tracker** — Drag-and-drop your applications through stages: Saved → Applied → Interview → Offer (or Rejected, we don't judge).
- **Dashboard** — See where you stand at a glance: stats, recent activity, and what needs your attention.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, TypeScript, Vite, TailwindCSS v4, Zustand |
| **Backend** | Python 3.11, FastAPI, SQLAlchemy, SQLite |
| **AI Providers** | Anthropic (Claude), Google Gemini, Qwen (Alibaba), or any OpenAI-compatible API |
| **Job Search** | JSearch API, Adzuna API, Brave Search API |
| **Direct Scraping** | Greenhouse, Lever, Ashby ATS boards |
| **Infrastructure** | Docker Compose |

## Getting Started

### Prerequisites

- **Docker & Docker Compose** — [Install Docker Desktop](https://www.docker.com/products/docker-desktop)
- **At least one AI API key** (Anthropic, Gemini, or Qwen)
- **At least one job search API key** for search functionality (optional — scraping works without keys)

### Quick Start (Docker)

**1. Clone the repo**

```bash
git clone https://github.com/your-username/ai-job-assistant.git
cd ai-job-assistant
```

**2. Set up your environment**

```bash
cp .env.example .env
```

Open `.env` and fill in your API keys:

```env
# Pick your AI provider: anthropic, gemini, or qwen
AI_PROVIDER=anthropic

# Anthropic
ANTHROPIC_API_KEY=sk-ant-your-key-here

# Or use Gemini
# GEMINI_API_KEY=your-key-here

# Or use Qwen
# QWEN_API_KEY=your-key-here
# QWEN_API_BASE=https://dashscope-intl.aliyuncs.com/compatible-mode/v1

# Job search (optional)
JSEARCH_API_KEY=
ADZUNA_APP_ID=
ADZUNA_API_KEY=

# Brave Search API
BRAVE_API_KEY=your-key-here
```

**3. Launch**

```bash
docker-compose up -d --build
```

**4. Open the app**

Visit [http://localhost:5173](http://localhost:5173) in your browser.

> **Windows users:** You can also double-click `start.bat` — it handles everything automatically and opens your browser when ready.

### Local Development (without Docker)

If you prefer running things directly:

```bash
# One command does it all — sets up venvs, installs deps, starts both servers
./dev.sh
```

This starts:
- **Backend** at `http://localhost:8000`
- **Frontend** at `http://localhost:5173`

Press `Ctrl+C` to stop both. Run `./dev.sh stop` to kill any orphaned processes.

### MCP companion mode

The local MCP server lets Codex or Claude search and save jobs, analyze them with the harness model, update the tracker, and save cover-letter drafts into the same database used by the web UI. It does not call a second LLM or submit applications.

Create a project-local virtual environment (Conda is not used):

```powershell
python -m venv backend/.venv
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.txt
```

The checked-in `.codex/config.toml` and `.mcp.json` register both the job assistant and CodeGraph for Codex and Claude Code. Restart the harness after creating the virtual environment. If your harness does not load project MCP configuration, add the job server manually from the repository root:

```powershell
# Codex
codex mcp add job-assistant -- .\backend\.venv\Scripts\python.exe .\backend\mcp_server.py

# Claude Code
claude mcp add --scope project --transport stdio job-assistant -- .\backend\.venv\Scripts\python.exe .\backend\mcp_server.py
```

On macOS or Linux, replace `backend/.venv/Scripts/python.exe` with `backend/.venv/bin/python`. Restart the harness after adding the server, then verify it with `/mcp`.

Available tools cover profile context, job search and persistence, saved-job filtering, application context, job analysis, tracker updates, cover-letter versioning, and tracker summaries. Job descriptions are treated as untrusted data, contact details are excluded by default, and no deletion or application-submission tool is exposed.

Broad job search uses any configured JSearch, Adzuna, or Brave credentials. The key-free Greenhouse, Lever, and Ashby adapters require `company_slugs` so the agent knows which company boards to query.

CodeGraph's machine-local index is intentionally ignored by Git. Build or refresh it after cloning:

```powershell
npx --yes @colbymchenry/codegraph@1.6.0 index
```

#### Manual Setup

If you want more control:

```bash
# Backend
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # edit with your keys
uvicorn app.main:app --reload --port 8000

# Frontend (in a separate terminal)
cd frontend
npm install
npm run dev
```

## Project Structure

```
ai-job-assistant/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entry point
│   │   ├── config.py            # Settings & env vars
│   │   ├── database.py          # SQLAlchemy + SQLite setup
│   │   ├── models/              # Database models
│   │   ├── schemas/             # Pydantic request/response schemas
│   │   ├── routers/             # API endpoints
│   │   │   ├── profile.py       # Resume upload & profile management
│   │   │   ├── jobs.py          # Job CRUD operations
│   │   │   ├── job_boards.py    # Search & scrape orchestration
│   │   │   ├── cover_letters.py # AI cover letter generation
│   │   │   ├── tracker.py       # Kanban board state
│   │   │   └── apply.py         # Quick Apply planning
│   │   ├── services/            # Business logic
│   │   │   ├── ai_service.py    # LLM abstraction layer
│   │   │   ├── resume_parser.py # PDF resume extraction
│   │   │   ├── job_search.py    # Search orchestrator
│   │   │   ├── site_scrapers.py # BeautifulSoup scrapers
│   │   │   ├── pdf_generator.py # Cover letter PDF export
│   │   │   └── providers/       # JSearch, Adzuna, Brave, etc.
│   │   └── prompts/             # AI prompt templates
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.tsx              # Router & page layout
│   │   ├── api/client.ts        # Axios HTTP client
│   │   ├── pages/               # All application pages
│   │   │   ├── Dashboard.tsx    # Home overview
│   │   │   ├── Onboarding.tsx   # Resume upload & setup
│   │   │   ├── ApiSearch.tsx    # API-based job search
│   │   │   ├── ScrapeSearch.tsx # Direct board scraping
│   │   │   ├── QuickApply.tsx   # Guided application flow
│   │   │   ├── Tracker.tsx      # Kanban board
│   │   │   └── ...
│   │   └── stores/              # Zustand state management
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
├── dev.sh                       # One-command local dev setup (Linux/macOS)
├── dev.ps1                      # One-command local dev setup (Windows PowerShell)
├── start.bat                    # One-click Docker launch (Windows)
└── .env.example
```


### AI Providers

You only need **one** provider configured. Set `AI_PROVIDER` to your choice:

| Provider | Required Variables | Notes |
|----------|-------------------|-------|
| `anthropic` | `ANTHROPIC_API_KEY` | Claude models (default) |
| `gemini` | `GEMINI_API_KEY` | Google Gemini models |
| `qwen` | `QWEN_API_KEY`, `QWEN_API_BASE` | Alibaba Qwen / OpenRouter compatible |

### Job Search Providers

All optional. The more you add, the broader your search results:

| Provider | Required Variables | What it does |
|----------|-------------------|-------------|
| JSearch | `JSEARCH_API_KEY` | Aggregated job listings via RapidAPI |
| Adzuna | `ADZUNA_APP_ID`, `ADZUNA_API_KEY` | Adzuna job board API |
| Brave | `BRAVE_API_KEY` | Web search + AI-powered result parsing |
| Greenhouse / Lever / Ashby | *None* | Direct ATS board scraping (no API key needed) |

## License

This project is open source.

---

Built because applying to jobs shouldn't feel like a full-time job.
