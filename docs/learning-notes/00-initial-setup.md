# Initial Setup

This is everything we did before starting the first real feature (AI Chat Assistant). It's the "empty skeleton" that every future feature gets built on top of.

---

## Step 1: Look at what already existed

Before building anything, we listed the files that already existed in the project folder. We found some planning docs (`Plan.md`, `What I want.md`, etc.) and a `.claude` folder with instructions, but no actual frontend or backend code yet.

**Why:** Never start building blind — always check what's already there first.

---

## Step 2: Decide: one repo, or many?

**Question:** should the frontend and backend live in separate git repos, or one repo together?

**Decision: one repo (a "monorepo")** with two folders inside it: `frontend/` and `backend/`.

**Why:** This is a solo learning project, not a big team with separate release schedules. One repo means one commit per feature (frontend + backend + docs together), which matches "build one feature completely before moving on."

---

## Step 3: Create the GitHub repo

The user created an empty repo on GitHub called `cortex-ai-lab` and cloned it locally:

```bash
git clone https://github.com/ashoktechvedika/cortex-ai-lab.git
```

This became the root of the whole project.

---

## Step 4: Move the planning docs into the repo

We moved `CLAUDE.md`, `docs/`, and `.claude/` (which were sitting outside the git repo) into `cortex-ai-lab/`, so the instructions and plan live with the code, not next to it.

---

## Step 5: Scaffold the frontend

We used Next.js's official generator to create the frontend app:

```bash
npx create-next-app@latest frontend --ts --app --src-dir --import-alias "@/*" --no-tailwind --eslint --use-npm --disable-git --empty
```

What each flag means:
- `--ts` → TypeScript
- `--app` → use the modern "App Router" (folders = routes)
- `--src-dir` → put code inside `src/` instead of the project root
- `--no-tailwind` → we're using Material UI instead, so skip Tailwind CSS
- `--empty` → skip the demo starter page, start blank

**Note:** this installed Next.js 16 and React 19 — very new versions. Next.js even drops a warning file (`AGENTS.md`) saying the framework has breaking changes since it was last documented. We had to double check a few things against the real installed docs instead of assuming.

---

## Step 6: Install the rest of the frontend stack

```bash
npm install @mui/material @emotion/react @emotion/styled @mui/icons-material @tanstack/react-query zustand
npm install @mui/material-nextjs
```

- **Material UI (`@mui/material`)** — our component library (buttons, cards, layout, etc.), so we don't hand-write CSS for every button.
- **React Query (`@tanstack/react-query`)** — a library for fetching and caching data from the backend. Not used yet, but installed so it's ready for when features need it.
- **Zustand** — a small state management library for data that needs to be shared across components. Also not used yet.
- **`@mui/material-nextjs`** — a small helper package that makes Material UI's styles render correctly with Next.js's App Router (without it, styles can flicker or load in the wrong order).

---

## Step 7: Build the left-nav "app shell"

We built the skeleton every feature page will live inside:

- `src/lib/nav-items.ts` — one list, in one place, of every feature (label, URL, icon, description). Both the sidebar and the dashboard read from this same list, so adding a 14th feature later means editing one file, not two.
- `src/lib/theme.ts` — the Material UI theme (colors, border radius).
- `src/components/providers.tsx` — wraps the whole app in the theme + React Query, so every page can use them.
- `src/components/app-shell.tsx` — the actual sidebar (drawer) + top bar, using Material UI's `Drawer`, `AppBar`, and `List` components.
- `src/components/feature-placeholder.tsx` — a reusable "this isn't built yet" card, so every unbuilt feature page looks the same.
- One `page.tsx` per feature folder (`chat/`, `documents/`, `rag/`, ...), each just rendering the placeholder for now.

---

## Step 8: Fix Material UI v9 "breaking changes"

We installed the newest Material UI (v9), and it removed some shortcuts that used to work in older versions:

```tsx
// This used to work in older MUI, now it's a type error:
<Stack alignItems="center" mb={2}>

// Now you must put spacing/alignment props inside `sx`:
<Stack sx={{ alignItems: "center", mb: 2 }}>
```

We also hit a subtler bug: a page written as a "Server Component" (the Next.js default) tried to pass a component reference (`component={Link}`) into a Material UI component that runs on the client. React can't send a raw function across that boundary. Fix: add `"use client"` to the top of that page file, which tells Next.js "render this entirely in the browser."

**Why this matters:** we caught both of these by actually running `npm run build` and reading the real error, not by guessing. Always build/run before saying something is done.

---

## Step 9: Scaffold the backend

We hand-built a standard FastAPI folder structure (no generator for this one):

```
backend/
└── app/
    ├── main.py          → creates the FastAPI app, wires everything together
    ├── core/config.py   → all settings (DB URL, API keys, etc.) in one place
    ├── api/routes/      → one file per feature's API endpoints
    ├── db/session.py    → database connection setup
    ├── models/          → SQLAlchemy classes = one class per DB table
    └── schemas/         → Pydantic classes = shape of API requests/responses
```

Why `models/` and `schemas/` are different folders: a database table and an API response don't always look the same (e.g. you'd store a password hash in the DB but never return it from the API). Keeping them separate means changing one doesn't accidentally change the other.

---

## Step 10: Add basic observability

The user asked to be able to see what's happening in the backend and database while we build. We added:

```python
# In main.py — logs every request:
@app.middleware("http")
async def log_requests(request: Request, call_next):
    ...
    logger.info("%s %s -> %s (%.1fms)", request.method, request.url.path, response.status_code, duration_ms)
```

```python
# In db/session.py — logs every SQL query once we start using the database:
engine = create_engine(settings.database_url, echo=settings.environment == "development")
```

---

## Step 11: Verify everything actually runs

We started both servers and hit them with real requests instead of assuming the code was correct:

```bash
npm run build   # frontend compiles and all 13 feature pages prerender
npm run dev     # frontend serves real HTML on localhost:3000
uvicorn app.main:app --port 8000   # backend starts
curl http://localhost:8000/api/health   # -> {"status":"ok"}
```

---

## Step 12: First commit

```bash
git add -A
git commit -m "Scaffold Cortex AI Lab monorepo skeleton"
```

Not pushed to GitHub yet — that's a deliberate pause point, since pushing affects the shared/remote copy.
