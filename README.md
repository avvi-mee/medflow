# MedFlow — Hospital AI Blood Test Analysis System

> 6-agent AI pipeline that pre-analyzes blood tests before the patient walks into the room.
> Built for Indian hospitals (1:1500 doctor-to-patient ratio).

## Quick Start

### Backend
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# Edit .env — add GROQ_API_KEY
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
cp .env.local.example .env.local
# Edit .env.local — set NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

### Smoke test
```bash
# Seed demo patients (all risk levels)
curl -X POST localhost:8000/demo/seed

# Watch queue
curl localhost:8000/doctor/queue

# Full test (CRITICAL patient)
curl -X POST localhost:8000/patient/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Priya Sharma","age":35,"gender":"F","phone":"9876543210"}'

curl -X POST localhost:8000/test/submit \
  -H "Content-Type: application/json" \
  -d '{"patient_id":"MF-2024-XXXXXXXX","values":{"hemoglobin":7.2,"wbc":12000,"platelets":85000,"glucose":320,"hba1c":9.1}}'

# Stream live pipeline events
curl -N localhost:8000/pipeline/stream/{test_id}
```

## Architecture

```
Patient Kiosk (Next.js)  →  FastAPI Backend  →  6 AI Agents (async)
                                   ↓
                         SQLite (patient history)
                                   ↓
             Doctor Dashboard  ←  SSE stream  ←  Pipeline events
```

### Agent Pipeline
```
Phase 1 (parallel):   Lab Interpreter + Pattern Detector + History Comparator
Phase 2 (sequential): Risk Scorer → Report Writer
```

### Risk Levels
- 🟢 GREEN — Routine
- 🟡 YELLOW — Moderate concern
- 🔴 RED — Urgent consultation
- ⬛ BLACK — CRITICAL / life-threatening (pulsing UI)

## Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/patient/register` | Register patient |
| POST | `/test/submit` | Submit blood values → fire pipeline |
| GET | `/patient/{id}/report` | Full AI analysis |
| GET | `/patient/{id}/tag` | Queue tag + QR |
| GET | `/patient/{id}/whatsapp-text` | WhatsApp-formatted report |
| GET | `/doctor/queue` | Sorted queue (BLACK→RED→YELLOW→GREEN) |
| POST | `/doctor/override` | Override with required notes |
| GET | `/pipeline/stream/{id}` | SSE live events |
| GET | `/admin/audit` | Paginated audit log |
| POST | `/demo/seed` | Seed 5 demo patients |

## Deployment

### Backend → Railway
1. Push `backend/` to GitHub
2. New Railway project → Deploy from GitHub → root `/backend`
3. Env vars: `GROQ_API_KEY`, `GROQ_MODEL`, `GROQ_BASE_URL`, `CORS_ORIGINS`, `SECRET_KEY`, `DATABASE_URL`
4. Railway Volume at `/app/data/`, set `DATABASE_URL=sqlite:////app/data/medflow.db`

### Frontend → Vercel
1. Push `frontend/` to GitHub
2. Import to Vercel → root `/frontend`
3. Env var: `NEXT_PUBLIC_API_URL=https://your-app.railway.app`

## Safety
- Every response includes `"ai_disclaimer": "AI SUGGESTED — DOCTOR MUST VERIFY"`
- Non-dismissible disclaimer banner on all doctor views
- CRITICAL patients require typed "CONFIRM" acknowledgment
- All pipeline events, doctor actions, and overrides logged to `audit_log` table
- Override requires minimum 20-character notes

## Stack
- Python 3.11, FastAPI 0.111, SQLAlchemy 2.0, Pydantic v2
- OpenAI client → Groq API (`llama-3.1-70b-versatile`) — ~10x faster
- Next.js 14 (App Router), React 18, Tailwind CSS, TypeScript
- SQLite + SSE (no Redis)
