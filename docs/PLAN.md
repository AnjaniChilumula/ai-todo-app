# AI Todo App — Project Plan

**Author:** Claude (junior engineer) · **Reviewer:** Anjani Chilumula · **Status:** Draft, awaiting review

## 1. Goal

Build a small but realistic todo app to learn **Python + FastAPI**, **React**, and **AI integration**, and to practise a
reviewer-driven GitHub workflow: small milestones, many focused commits, one pull request per milestone.

## 2. Scope

### Core features (MVP)
- Add, view, edit, complete and delete tasks
- Each task has: title, optional notes, optional due date, priority (low / medium / high), completed flag
- Filter tabs: **All / Active / Completed**, an "N tasks left" counter, and **Clear completed**
- Data saved in a local SQLite database, so it survives restarts

### AI features
- **Smart Add** — type a sentence like *"call mom tomorrow 6pm, high priority"*. The AI turns it into
  title = "Call mom", due = tomorrow 18:00, priority = high. You see a **preview** and confirm before anything is saved.
- **Break it down** — on any task, click ✨ to get 3–6 suggested subtasks. You tick the ones you want, then add them.
- **AI is optional** — with no API key the app still works; AI buttons are disabled with a short explanation.
  The AI never writes to the database on its own: every AI suggestion needs a click from you.

### Live demo
- The React app is published to **GitHub Pages** in *demo mode*: tasks are saved in the visitor's own browser and
  AI features are off. The full app, with AI, runs on your own computer. See [section 9](#9-deployment-github-pages).

### Out of scope (for now)
Login / multiple users, hosting the backend online, recurring tasks, drag-and-drop ordering, mobile app.

## 3. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Backend | Python 3.11, **FastAPI**, Uvicorn | The framework you want to learn; automatic API docs at `/docs` |
| Database | **SQLModel** on SQLite | One library for DB models *and* request/response validation (built on SQLAlchemy + Pydantic) |
| AI | **Anthropic Python SDK**, Claude API | Structured outputs return validated JSON straight into a Pydantic model |
| Backend tests | pytest + FastAPI `TestClient`; AI calls mocked | Tests run without an API key or network |
| Backend lint | ruff | One fast tool for lint + formatting |
| Frontend | **React + Vite** (JavaScript) | The UI library you want to learn, with a fast dev server |
| Frontend tests | Vitest + React Testing Library | Same runner Vite projects use |
| Styling | Plain CSS (one stylesheet + CSS variables) | Nothing extra to learn; keeps diffs readable |
| CI | GitHub Actions | Runs tests and lint on every PR so reviews start green |

## 4. Architecture

```
 Browser                         Your computer
┌──────────────────┐   /api/*   ┌──────────────────────┐        ┌──────────────┐
│ React (Vite)     │ ─────────▶ │ FastAPI  :8000       │ ─────▶ │ SQLite file  │
│ localhost:5173   │ ◀───────── │  routers/todos.py    │        │ todos.db     │
└──────────────────┘    JSON    │  routers/ai.py ──────┼──────▶ Claude API
                                └──────────────────────┘  (API key lives only here, in backend/.env)
```

- Vite's dev server proxies `/api` to FastAPI, so the frontend never needs to know the backend port.
- The Anthropic API key is read from `backend/.env` (git-ignored). It never reaches the browser or the repo.
- The frontend talks to storage through one small interface with two implementations: **`ApiStore`** (calls FastAPI)
  and **`LocalStore`** (browser `localStorage`). A build setting picks one, which is how the same UI runs both
  locally with the backend and on GitHub Pages without it.

### Folder layout
```
ai-todo-app/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app, CORS, router registration
│   │   ├── config.py        # settings from environment / .env
│   │   ├── db.py            # engine + session dependency
│   │   ├── models.py        # SQLModel tables and schemas
│   │   ├── routers/todos.py # CRUD endpoints
│   │   ├── routers/ai.py    # AI endpoints
│   │   └── ai/client.py     # all Claude calls live here
│   ├── tests/
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api/             # fetch wrappers
│   │   ├── storage/         # ApiStore + LocalStore behind one interface
│   │   ├── components/      # TodoItem, TodoList, SmartAdd, BreakdownDialog, ...
│   │   └── App.jsx
│   └── package.json
├── docs/
│   ├── PLAN.md
│   └── wireframes/
└── .github/workflows/
    ├── ci.yml               # tests + lint on every PR
    └── deploy-pages.yml     # builds the demo and publishes it to GitHub Pages
```

## 5. Data model

**Todo**

| Field | Type | Notes |
|---|---|---|
| `id` | int | primary key |
| `title` | str | required, 1–200 chars |
| `notes` | str \| null | optional |
| `due_at` | datetime \| null | optional |
| `priority` | `low` \| `medium` \| `high` | default `medium` |
| `completed` | bool | default `false` |
| `parent_id` | int \| null | set when the task is a subtask from "Break it down" |
| `created_at`, `updated_at` | datetime | set by the server |

## 6. API design

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Liveness check; also reports whether AI is configured |
| GET | `/api/todos?status=all\|active\|completed` | List tasks |
| POST | `/api/todos` | Create a task |
| PATCH | `/api/todos/{id}` | Edit or complete a task |
| DELETE | `/api/todos/{id}` | Delete a task (and its subtasks) |
| DELETE | `/api/todos?completed=true` | Clear completed tasks |
| POST | `/api/ai/parse` | `{text, timezone}` → `{title, notes, due_at, priority}` (a suggestion, not saved) |
| POST | `/api/ai/breakdown` | `{todo_id}` → `{subtasks: [str]}` (suggestions, not saved) |

Errors use FastAPI's standard `{"detail": ...}` shape. AI endpoints return `503` when no API key is configured.

## 7. AI design

- **Model:** `claude-opus-5-5`, read from the `ANTHROPIC_MODEL` setting so it can be changed without code edits.
  Effort is set to `low`: these are short extraction tasks.
- **Structured outputs:** `client.messages.parse(..., output_format=ParsedTodo)` returns a validated Pydantic object,
  so we never hand-parse JSON from text.
- **Relative dates:** the prompt includes today's date and the browser's timezone, so "tomorrow 6pm" resolves correctly.
- **Refusal fallback:** the Claude API's server-side fallback option is turned on, so a declined request is retried
  on another model instead of failing. Responses are still checked for `stop_reason` before use.
- **Failure handling:** timeouts, rate limits and missing keys turn into a friendly message in the UI; the manual
  add form always works.
- **Cost:** Opus 5.5 is $4 / $20 per million input / output tokens. One Smart Add call is roughly 1,000 tokens in total,
  so on the order of **one cent or less per call**. `claude-haiku-5-5` is ~40× cheaper if you'd rather trade some
  quality for cost — your call.
- **Your API key:** you create it at console.anthropic.com and put it in `backend/.env` yourself. I won't handle it.

## 8. GitHub workflow

- **Repo:** `github.com/AnjaniChilumula/ai-todo-app` (public)
- **Bootstrap:** one initial commit on `main` (README, .gitignore, LICENSE) so PRs have a base.
- **Per milestone:** branch `mN-short-name` → 3–6 small commits → push → open a PR with *what / why / how to test /
  screenshots* → you review → I address comments as **new commits** (no force-pushes) → you merge.
- **Merge method:** "Create a merge commit", so every small commit stays in `main`'s history.
- **Commit style:** Conventional Commits — `feat:`, `fix:`, `test:`, `docs:`, `chore:`, `ci:`.
- **Secrets:** `.env` is git-ignored from the first commit; only `.env.example` (no real values) is committed.

## 9. Deployment (GitHub Pages)

GitHub Pages only serves static files, so it can host the React app but not FastAPI, the database or the AI calls.
The API key must also never be shipped to a public website. So the live site is a **demo**:

| | Local (full app) | GitHub Pages (demo) |
|---|---|---|
| URL | `http://localhost:5173` | `https://anjanichilumula.github.io/ai-todo-app/` |
| Tasks stored in | SQLite via FastAPI | The visitor's browser (`localStorage`) |
| AI features | On, when `ANTHROPIC_API_KEY` is set | Off, with the "AI is off" banner from wireframe 4 |

- **How it deploys:** a `deploy-pages.yml` GitHub Actions workflow builds the frontend with `VITE_STORAGE=local` and
  the `/ai-todo-app/` base path, then publishes it with the official Pages actions. It runs on every push to `main`,
  so merging a PR updates the live demo.
- **One-time setup:** the repository's Pages source is set to "GitHub Actions" in M6.
- **Later, optional:** hosting the backend (for example on Render) would turn the demo into the full app. That needs a
  hosted database and an account you create, so it is not part of this plan.

## 10. Milestones

| # | Branch | Delivers | ~Commits |
|---|---|---|---|
| M0 | `m0-docs` | This plan + wireframes in `docs/` | 5 |
| M1 | `m1-backend-skeleton` | FastAPI app, `/api/health`, settings, pytest, ruff, CI workflow | 5 |
| M2 | `m2-todos-api` | Todo model, SQLite, full CRUD endpoints + tests | 6 |
| M3 | `m3-frontend-skeleton` | Vite + React app, layout, API client, dev proxy, frontend CI | 5 |
| M4 | `m4-todo-list-ui` | List, add, complete, delete, empty state | 5 |
| M5 | `m5-edit-and-filters` | Inline edit, due date, priority, filters, counter, clear completed | 5 |
| M6 | `m6-pages-demo` | `LocalStore`, "AI is off" banner, Pages deploy workflow, **live demo URL** | 5 |
| M7 | `m7-ai-backend` | `/api/ai/parse` + `/api/ai/breakdown`, prompts, mocked tests | 5 |
| M8 | `m8-ai-frontend` | Smart Add preview + Break-it-down dialog | 5 |
| M9 | `m9-polish` | Loading/error states, accessibility, mobile layout, README with screenshots | 4 |

**About 10 PRs and 50 commits.** Each PR is small enough to review in 10–15 minutes.
The live demo appears after M6 and is updated by every later merge.

### Definition of done (every milestone)
- Tests and lint pass locally and in CI
- The app runs using the commands in the README
- The PR description says what changed, why, how to test it, and includes screenshots for UI changes

## 11. Prerequisites and risks

| Item | Status | Action |
|---|---|---|
| Python 3.11 | ✅ installed (3.11.5) | — |
| Node.js | ⚠️ 20.3.0 installed; current Vite needs 20.19+ | Upgrade to Node 22 LTS before M3 (`winget install OpenJS.NodeJS.LTS`) |
| GitHub CLI | ✅ signed in as AnjaniChilumula | — |
| Anthropic API key | ❌ not set | Needed only from M7; you add it to `backend/.env` |
| Project is inside OneDrive | ⚠️ `Documents` syncs to OneDrive | `node_modules/` and `.venv/` hold thousands of files; consider pausing sync for this folder or moving it out of OneDrive |
| Public repo | ⚠️ anyone can read it | `.env` git-ignored from commit 1; tests never need a real key |

## 11. Open questions for the reviewer

1. Is **JavaScript** OK for the React side, or do you want **TypeScript** from the start?
2. Keep **Claude Opus 5.5** for the AI features, or use the cheaper **Claude Haiku 5.5**?
3. Is **"Create a merge commit"** the merge method you'll use, so the small commits stay visible?
