# Cortex AI Lab

Enterprise AI Learning Lab — a portfolio project for learning AI engineering by building real enterprise AI features end-to-end.

## Structure

- `frontend/` — Next.js (App Router) + TypeScript + Material UI
- `backend/` — FastAPI + SQLAlchemy + PostgreSQL
- `docs/` — project plan and feature guides

## Running locally

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```
