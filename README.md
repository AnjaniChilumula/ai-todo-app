# AI Todo App

A small todo app with AI helpers, built to learn **Python + FastAPI**, **React** and **AI integration**.

It is being built in small, reviewed milestones: one pull request per milestone.

- **Smart Add:** type *"call mom tomorrow 6pm, high priority"* and the AI fills in the title, due date and priority for you to confirm.
- **Break it down:** get suggested subtasks for any task and pick the ones you want.

![Task list wireframe](docs/wireframes/1-task-list.png)

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

### Checks

```bash
cd backend
ruff check .            # lint
ruff format --check .   # formatting
pytest                  # tests
```

The same checks run on every pull request (see `.github/workflows/ci.yml`).

## Status

| Milestone | What | Status |
|---|---|---|
| M0 | Plan and wireframes | Done |
| M1 | Backend skeleton, settings, tests, CI | In review |
| M2–M5 | Todos API, then the React UI | Planned |
| M6 | Live demo on GitHub Pages | Planned |
| M7–M9 | AI features and polish | Planned |

The live demo will be at **https://anjanichilumula.github.io/ai-todo-app/** once M6 is merged.

## License

[MIT](LICENSE)
