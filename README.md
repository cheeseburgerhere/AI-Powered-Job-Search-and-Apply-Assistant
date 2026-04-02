# AI Job Assistant (Desktop Edition)

Your personal command center for the modern job hunt. Upload your resume, search across multiple job boards, get AI-tailored cover letters, and track every application — all from one convenient desktop app.

---

## What It Does

The job search grind is brutal. You're juggling 15 browser tabs, copy-pasting the same info into every form, and losing track of what you applied to last Tuesday. This app fixes that and runs directly on your machine without requiring messy terminal setups or Docker.

- **Resume Intelligence** — Upload your PDF resume and the AI parses it, learns your skills, your experience, even your writing voice.
- **Multi-Source Job Search** — Search across JSearch, Adzuna, and Brave simultaneously, or scrape directly from Greenhouse, Lever, and Ashby job boards.
- **AI Cover Letters** — Generate tailored cover letters that actually sound like you, not a robot. Download them as polished PDFs.
- **Quick Apply** — Get a step-by-step apply plan for any job, with pre-filled talking points pulled from your profile.
- **Kanban Tracker** — Drag-and-drop your applications through stages: Saved → Applied → Interview → Offer (or Rejected, we don't judge).
- **Desktop First** — Bundled as a standalone executable. The frontend is powered by Electron, and the backend is seamlessly compiled via PyInstaller.

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

- **Python 3.11+**
- **Node.js 18+**
- **At least one AI API key** (Anthropic, Gemini, Qwen, or OpenRouter)

### Building the Desktop Application

**1. Clone the repo & switch to the exe branch**

```bash
git clone -b exe-for-windows https://github.com/your-username/ai-job-assistant.git
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

# Or use OpenRouter via Qwen
# AI_PROVIDER=qwen
# QWEN_API_BASE=https://openrouter.ai/api/v1
# QWEN_API_KEY=sk-or-v1-your-key-here
# AI_MODEL_GENERAL=anthropic/claude-3.5-sonnet
# AI_MODEL_FAST=google/gemini-2.5-flash
```

**3. Build the App**

Run the build script. This will compile the Python backend into an executable and bundle it alongside the React frontend using Electron:

```bash
# On Linux / macOS
chmod +x build_desktop.sh
./build_desktop.sh
```

**4. Run the App**

The final executable will be generated in `frontend/release/`. Double-click it to start the AI Job Assistant exactly like any standard desktop app!

*(Note: See `DESKTOP_APP_GUIDE.md` for specific platform tweaks, like cross-compiling for Windows from Linux).*

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
│   ├── app/                 # FastAPI code
│   ├── ai-job-backend.spec  # PyInstaller build config
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

## Developers

If you want to run the application in a hot-reload web development mode without compiling the desktop application, you can still use standard Node and Uvicorn:

```bash
./dev.sh
```


## License

This project is open source. See the repository for license details.

---

Built because applying to jobs shouldn't feel like a full-time job.
