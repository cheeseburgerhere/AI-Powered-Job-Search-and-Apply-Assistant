# Docker Setup for Windows

This project is configured to run on Windows using Docker Desktop with WSL2.

## Prerequisites

1. **Docker Desktop for Windows** - [Download](https://www.docker.com/products/docker-desktop)
2. **WSL2 Backend** - Docker Desktop will prompt to enable this on installation

## Quick Start

### Step 1: Create `.env` file in project root

On your Windows machine, copy the template:

```
ai-job-assistant/
├── .env                    ← Create this in your Windows folder
├── .env.example            ← Copy from this
├── docker-compose.yml
├── backend/
└── frontend/
```

Best way: Copy `.env.example` to `.env` in the project root using Windows File Explorer or PowerShell, then edit with any text editor.

### Step 2: Start Docker

```powershell
cd ai-job-assistant
docker compose up --build
```

Docker automatically mounts the `.env` file from your Windows filesystem into the containers. No restart needed if you update `.env` later—services auto-reload.

### Access Your App

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000

## Container Lifecycle & Data Persistence

### Containers Stop When Terminal Closes

Press `Ctrl+C` to stop services. Containers are automatically removed, but **database data persists**:

```powershell
docker compose up
# ... containers running ...
# Press Ctrl+C to stop
# ✅ Containers removed, but data stays
```

### Start Again

```powershell
docker compose up
# ✅ New containers created, old data loaded automatically
```

### Manual Stop

```powershell
docker compose down
# Stops and removes containers, data persists
```

### Database Persistence

Database is stored in a named Docker volume (`backend_data`). It survives:
- Terminal closes
- `docker compose down`
- Container rebuilds

To **delete database** (fresh start):

```powershell
docker compose down -v
# -v flag removes named volumes
```

## Development Workflow

### Hot Reload

Both services include hot reload:

- **Backend**: Changes to `backend/app/` trigger auto-reload via `--reload` flag
- **Frontend**: Changes to `frontend/src/` trigger Vite hot module replacement

### Environment Variables

Create your `.env` file in the **project root on Windows** (same folder as `docker-compose.yml`):

```
ANTHROPIC_API_KEY=sk-ant-your-key
JSEARCH_API_KEY=your-key
ADZUNA_APP_ID=your-id
ADZUNA_API_KEY=your-key
BRAVE_API_KEY=your-key
```

Docker automatically mounts this file into both containers. Edit it anytime with Notepad or your favorite editor—services auto-reload, no container restart needed.

Variables are accessible in:
- **Backend**: `Settings()` in `config.py`
- **Frontend**: Vars prefixed with `VITE_` accessible as `import.meta.env.VITE_*`

### Database

SQLite database is stored in `backend/data/`. It persists between container restarts via volume mount.

## Troubleshooting

### Port Already in Use

If ports 5173 or 8000 are in use:

```powershell
# Check what's using the port (example: port 5173)
netstat -ano | findstr :5173

# Kill the process by PID
taskkill /PID <PID> /F

# Or change ports in docker-compose.yml:
# ports:
#   - "5174:5173"  # frontend on 5174
#   - "8001:8000"  # backend on 8001
```

### Networking Issues on Windows

If services can't reach each other:

1. Ensure Docker Desktop WSL2 integration is enabled
2. Check Windows Firewall allows Docker
3. Restart Docker Desktop: right-click tray icon → Restart

### Slow Performance

If file operations are slow (especially on frontend):

- This is normal on Windows with mounted volumes
- Compose already sets `CHOKIDAR_USEPOLLING=true` to mitigate this
- Consider using named volumes for better performance:

```yaml
volumes:
  backend_data:
  frontend_modules:
```

## Production Build

For production, there's a multi-stage build recipe available. Contact maintainer for `docker-compose.prod.yml` setup.

## Reference

- [Docker Docs](https://docs.docker.com)
- [Docker Compose Docs](https://docs.docker.com/compose/)
- [WSL2 Guide](https://docs.docker.com/desktop/wsl/)
