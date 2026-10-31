# AI Todo App

A small todo app with AI helpers, built to learn **Python + FastAPI**, **React** and **AI integration**.

It is being built in small, reviewed milestones: one pull request per milestone.

- **Smart Add:** type *"call mom tomorrow 6pm, high priority"* and the AI fills in the title, due date and priority for you to confirm.
- **Break it down:** get suggested subtasks for any task and pick the ones you want.

![Task list wireframe](docs/wireframes/1-task-list.png)

## Live demo

**https://anjanichilumula.github.io/ai-todo-app/**

The demo runs entirely in your browser: tasks are saved in your browser's local storage and the AI features are off,
because GitHub Pages can't run the Python backend (and an API key must never be put in a public website).
To use AI, run the app locally (below). Every merge to `main` redeploys the demo
(`.github/workflows/deploy-pages.yml`); build it yourself with `npm run build:demo`.

## Docs

- [Project plan](docs/PLAN.md): scope, stack, architecture, API, AI design, milestones
- [Wireframes](docs/wireframes/README.md): the five approved screens

## Run the backend

Requires Python 3.11+.

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows (macOS/Linux: source .venv/bin/activate)
pip install -r requirements-dev.txt
copy .env.example .env          # optional: add your ANTHROPIC_API_KEY later (macOS/Linux: cp)
uvicorn app.main:app --reload
```

Then open http://localhost:8000/docs for the interactive API docs, or http://localhost:8000/api/health.
Tasks are stored in `backend/todos.db` (SQLite), created on first start.

### API

| Method | Path | What it does |
|---|---|---|
| GET | `/api/health` | `{"status": "ok", "ai_enabled": false}` |
| GET | `/api/todos?status=all\|active\|completed` | List tasks and subtasks |
| POST | `/api/todos` | Create a task: `{"title": "Call mom", "due_at": "2026-11-01T18:00:00+05:30", "priority": "high"}`. Add `"parent_id"` for a subtask |
| PATCH | `/api/todos/{id}` | Change some fields, e.g. `{"completed": true}` |
| DELETE | `/api/todos/{id}` | Delete a task and its subtasks |
| DELETE | `/api/todos?completed=true` | Clear completed tasks |

Dates are returned in UTC (ending in `Z`).

### Turn on the AI features

1. Create an API key at https://console.anthropic.com/ (API usage is billed by Anthropic).
2. In `backend/.env` (copied from `.env.example`), set `ANTHROPIC_API_KEY=...`. The file is git-ignored, so the key
   never reaches GitHub.
3. Restart the backend. `/api/health` now reports `"ai_enabled": true`.

The AI endpoints only *suggest*; nothing is saved until you confirm in the UI.

| Method | Path | What it does |
|---|---|---|
| POST | `/api/ai/parse` | `{"text": "call mom tomorrow 6pm, high priority", "timezone": "Asia/Kolkata"}` → suggested `title`, `due_at`, `priority`, `notes` |
| POST | `/api/ai/breakdown` | `{"todo_id": 1}` → `{"subtasks": [...]}`, skipping subtasks the task already has |

They use **Claude Opus 5.5** (`ANTHROPIC_MODEL` to change it) with structured outputs, so answers always match the
expected fields. All Claude calls live in `backend/app/ai/client.py`. Without a key they return `503` with setup
instructions. Tests never call the real API.

## Run the frontend

Requires Node.js 20+ (22 LTS recommended). Start the backend first, then in a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Vite forwards `/api/...` requests to the backend on port 8000.

## Checks

```bash
cd backend
ruff check .            # lint
ruff format --check .   # formatting
pytest                  # tests

cd frontend
npm run lint            # ESLint
npm test                # Vitest
npm run build           # production build
```

The same checks run on every pull request (see `.github/workflows/ci.yml`).

## Status

| Milestone | What | Status |
|---|---|---|
| M0 | Plan and wireframes | Done |
| M1 | Backend skeleton, settings, tests, CI | Done |
| M2 | Todos API (SQLite, CRUD) | Done |
| M3 | Frontend skeleton, tests, CI | Done |
| M4 | Task list: add, complete, delete, subtasks | Done |
| M5 | Editing, due dates, priority, filters | Done |
| M6 | Live demo on GitHub Pages | Done |
| M7 | AI endpoints: Smart Add parsing, subtask suggestions | In review |
| M8–M9 | AI in the UI, polish | Planned |

## License

[MIT](LICENSE)
