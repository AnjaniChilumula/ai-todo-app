# AI Todo App v2 — Accounts, Sessions, Authorization and UI

**Author:** Anjani Chilumula · **Status:** Draft, awaiting review · **Builds on:** [v1 plan](PLAN.md) (M0–M9, done)

## 1. Goal

Turn the single-person app into a multi-user app: people create an account (email + password, or Google), stay signed
in with secure server-side sessions, and only ever see their own tasks. An admin can manage accounts. Along the way the
UI gets dark mode, search and sort, undo, and date groups.

## 2. Scope

### Accounts and sign-in
- **Sign up** with name, email and password; **sign in** with email + password or **Sign in with Google**
- Passwords hashed with **Argon2** (never stored or logged in plain text)
- Same account either way: signing in with Google using the email of an existing account links the two
  (only when Google says the email is verified)

### Sessions
- **Server-side sessions**: a random token in an **HttpOnly** cookie; the database stores only a hash of it
- Stay signed in for **14 days of inactivity** (each visit extends it), **30 days at most**
- **Sign out** ends the session immediately
- **Settings → Sessions** lists your signed-in devices ("Chrome on Windows · active 5 min ago · this device") with
  **Sign out** per device and **Sign out everywhere else**
- Changing your password signs out every other device

### Authorization
- Every task belongs to a user; **you can only see, change, delete or AI-process your own tasks**
  (someone else's task id returns `404`, so its existence isn't revealed)
- Two roles: **user** and **admin**
- **Admin page**: list accounts (name, email, role, status, task count, last active), **disable / enable** accounts
  (disabling signs them out everywhere), **make / remove admin**. Admins see task *counts*, never task contents.
- An admin can't disable or demote themselves, so there is always at least one admin
- The first admin is created from the command line: `python -m app.cli make-admin you@example.com`

### UI improvements
- **App shell**: top bar with the app name, search box, and an avatar menu (Settings, Admin for admins, Sign out)
- **Dark mode**: Light / Dark / Match system, remembered per device
- **Search** in task titles and notes, and **sort** by due date, priority or newest
- **Undo**: deleting a task (or clearing completed) shows "Task deleted · Undo" for 8 seconds; tasks are soft-deleted
  on the server so Undo always works, even after a reload within the window
- **Date groups**: Overdue · Today · Upcoming (next 7 days) · Later · No date, with completed tasks folded at the end
- **Settings page**: profile name, change (or set) password, sessions, appearance

### Live demo (GitHub Pages)
The demo still has no backend, so it can't have accounts. It runs as a single **Guest** with browser storage, shows a
"Demo: no accounts" note, and keeps every UI improvement (dark mode, search, sort, undo, groups).

### Out of scope (for now)
Email verification and "forgot password" emails (need an email service), two-factor auth, other OAuth providers,
hosting the backend online, sharing tasks between users.

## 3. Key decisions

| Topic | Decision | Why |
|---|---|---|
| Sessions | Server-side, token in HttpOnly cookie | Instant sign-out and device list; JavaScript can't read the cookie, so XSS can't steal it |
| Cookie flags | `HttpOnly`, `SameSite=Lax`, `Secure` outside localhost, `Path=/` | Lax stops other sites sending the cookie on POST/PATCH/DELETE |
| CSRF | SameSite=Lax **plus** an `Origin` check on every non-GET request | Defence in depth; no CSRF tokens needed because API calls are same-origin JSON |
| Token storage | Store `sha256(token)`, never the token itself | A leaked database can't be used to hijack sessions |
| Password hashing | `pwdlib` with Argon2 (what the FastAPI docs recommend) | Modern, memory-hard, salted |
| Password rules | 8–128 characters, not equal to the email; no forced symbols | Follows current NIST guidance: length beats complexity rules |
| Login protection | 5 failed attempts per email + IP → 15-minute lock; same error for wrong email or password | Slows guessing and doesn't reveal which emails have accounts |
| Google sign-in | OpenID Connect authorization-code flow with PKCE, state and nonce, via **Authlib** | A maintained library handles the security-critical parts (ID-token signature, issuer, audience, expiry) |
| Database changes | **Alembic** migrations from now on (replacing `create_all`) | Upgrades an existing `todos.db` safely instead of deleting it |
| Existing tasks | A migration adds `owner_id`; `python -m app.cli claim-tasks you@example.com` moves current tasks to your account | Your v1 tasks aren't lost |
| Deleting | Soft delete (`deleted_at`) + restore; deleted tasks are purged after 30 days | Makes Undo reliable |
| Routing | React Router (`/login`, `/signup`, `/`, `/settings`, `/admin`) | Real URLs, back button works; Pages gets a `404.html` copy so deep links load |
| Theme | CSS variables with `data-theme` on `<html>`, preference in `localStorage` | No flash of the wrong theme; works in the demo too |

## 4. Data model changes

**User** (new)

| Field | Type | Notes |
|---|---|---|
| `id` | int | primary key |
| `email` | str | unique, stored lower-case |
| `name` | str | 1–80 chars |
| `password_hash` | str \| null | null for Google-only accounts (they can set one later) |
| `google_sub` | str \| null | Google's stable user id, unique |
| `role` | `user` \| `admin` | default `user` |
| `is_active` | bool | admins can disable accounts |
| `created_at`, `last_login_at` | datetime | |

**Session** (new)

| Field | Type | Notes |
|---|---|---|
| `id` | str | `sha256` of the cookie token |
| `user_id` | int | |
| `created_at`, `last_seen_at`, `expires_at` | datetime | `last_seen_at` is updated at most once a minute |
| `user_agent` | str | shown as "Chrome on Windows" |

**Todo** (changed): adds `owner_id` (required for new tasks) and `deleted_at` (null unless soft-deleted).

## 5. API changes

### New: accounts and sessions

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/auth/config` | Which sign-in methods are on (`{"password": true, "google": false}`) |
| POST | `/api/auth/signup` | `{name, email, password}` → creates the account and signs in |
| POST | `/api/auth/login` | `{email, password}` → sets the session cookie |
| POST | `/api/auth/logout` | Ends this session and clears the cookie |
| GET | `/api/auth/me` | The signed-in user, or `401` |
| GET | `/api/auth/google/start` | Redirects to Google |
| GET | `/api/auth/google/callback` | Google redirects back here; signs in and redirects to `/` |
| PATCH | `/api/account` | Change your name |
| POST | `/api/account/password` | `{current_password, new_password}`; signs out other devices |
| GET | `/api/account/sessions` | Your sessions, with `current: true` on this one |
| DELETE | `/api/account/sessions/{id}` | Sign out one device |
| DELETE | `/api/account/sessions?others=true` | Sign out everywhere else |

### New: admin (admin role only, else `403`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/admin/users` | Accounts with task counts and last activity |
| PATCH | `/api/admin/users/{id}` | `{is_active}` and/or `{role}` |

### Changed
- Every `/api/todos` and `/api/ai/*` endpoint now **requires a session** (`401` without one) and only touches the
  signed-in user's tasks
- `DELETE /api/todos/{id}` and `DELETE /api/todos?completed=true` soft-delete and return the deleted ids
- New `POST /api/todos/restore` with `{ids: [...]}` brings them back (Undo)

## 6. Frontend changes

```
frontend/src/
  auth/        AuthProvider (current user, sign in/out), RequireAuth and RequireAdmin route guards
  pages/       LoginPage, SignupPage, TasksPage (today's App), SettingsPage, AdminPage
  components/  TopBar, UserMenu, Toasts, TaskGroups, SearchBox, SortMenu, ThemeSwitch, SessionList, ...
  theme/       light + dark tokens, useTheme
```

- On startup the app calls `/api/auth/me`. Signed out → `/login`; any `401` later also returns to `/login`.
- Non-admins never see the Admin link, and `/admin` redirects them home (the server enforces it regardless).

## 7. Google sign-in setup (you do this once)

1. In Google Cloud Console, create an OAuth client of type **Web application**.
2. Authorized redirect URI: `http://localhost:5173/api/auth/google/callback` (it goes through the Vite proxy, so the
   cookie is set for the app's own address).
3. Put `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `backend/.env` and restart.
4. Without them the app works normally and simply hides the Google button.

## 8. Milestones

| # | Branch | Delivers | ~Commits |
|---|---|---|---|
| M10 | `m10-v2-plan` | This plan + v2 wireframes | 3 |
| M11 | `m11-migrations` | Alembic set up, baseline migration of the v1 schema, startup runs migrations | 4 |
| M12 | `m12-accounts` | User + Session models, Argon2, signup / login / logout / me, cookies, Origin check, login lockout | 7 |
| M13 | `m13-ownership` | `owner_id` on tasks, every todo + AI endpoint scoped to the user, `claim-tasks` and `make-admin` commands | 6 |
| M14 | `m14-account-admin` | Profile + password change, session list / revoke, admin users endpoints | 6 |
| M15 | `m15-google` | Sign in with Google (Authlib OIDC), account linking, `/api/auth/config` | 5 |
| M16 | `m16-auth-ui` | React Router, AuthProvider, sign-in and sign-up pages, Google button, route guards, top bar + user menu | 7 |
| M17 | `m17-settings-admin-ui` | Settings (profile, password, sessions, appearance) and Admin pages | 6 |
| M18 | `m18-theme-undo` | Dark mode; soft delete + restore API; undo toasts | 6 |
| M19 | `m19-search-groups` | Search, sort, Today / Upcoming groups | 5 |
| M20 | `m20-v2-polish` | Guest demo mode, Pages deep-link fallback, accessibility pass, README v2 | 5 |

**About 11 PRs and 60 commits**, same flow as v1: one branch per milestone, CI on every PR, merged with a merge commit
and a descriptive message once checks pass.

### Tests to add
- **Backend:** signup / login / logout, cookie flags, expiry and sliding renewal, lockout, Origin check,
  cross-user access (`404`), admin-only routes (`403`), self-demotion blocked, Google callback with a mocked provider
  (state mismatch, unverified email, linking), migrations run on an empty and on a v1 database
- **Frontend:** route guards, sign-in / sign-up forms and errors, user menu, settings and admin pages, theme switch,
  search / sort, groups, undo toasts

## 9. Risks and notes

| Item | Note |
|---|---|
| Google credentials | Only you can create them; until then the Google button is hidden and everything else works |
| Rate limiting is in memory | Fine for one server process; a hosted, multi-process setup would need Redis |
| OneDrive sync | `todos.db` changes often; consider excluding `backend/` from sync |
| Node.js 20.3 | Still works (Vite 6); Node 22 LTS recommended |
| Figma quota | View seat ≈ 20 calls/month; v2 wireframes use about 5 |

## 10. Open questions for the reviewer

1. Is **14 days idle / 30 days maximum** right for how long sign-in lasts?
2. Should a brand-new account start **empty**, or with a couple of example tasks ("Try Smart Add")?
3. **Undo window of 8 seconds** OK?
