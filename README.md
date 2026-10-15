# CrewIQ — Workforce Intelligence

**Tagline:** Intelligent Workforce. Smarter Teams. Better Outcomes.

Hackathon MVP for smart employee–project matching, team building, workload balancing, skill gap analysis, workforce dashboard, and deadline risk assessment. All intelligence runs in **Python (FastAPI)** with a **React + Vite** frontend and **SQLite** persistence.

> Prototype — no authentication. Scoring uses explainable rules, not a trained ML model.

## Demo scenario

1. Start backend and frontend (below).
2. Open **Overview** — KPIs and charts load from `/api/dashboard`.
3. Open **Projects** → **AI Analytics Platform**.
4. View ranked matches and risk on the project detail page.
5. **Smart Team Builder** → select AI Analytics Platform → Generate team (size 4).
6. **Skill Gap Analysis** → same project → training suggestions for gaps.
7. **Workload Balancer** → recommend/confirm reallocation for an overloaded assignee.
8. **Deadline Risk** → review scores and mitigation steps.

## Windows setup (PowerShell)

### Backend (terminal 1)

```powershell
cd "D:\crew IQ\backend"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Frontend (terminal 2)

```powershell
cd "D:\crew IQ\frontend"
Copy-Item .env.example .env
npm install
npm run dev
```

Open http://localhost:5173

### Tests

```powershell
cd "D:\crew IQ\backend"
.\.venv\Scripts\Activate.ps1
pytest -q
```

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/dashboard` | KPIs, charts, activity |
| GET | `/api/config` | Weights and thresholds (Settings) |
| GET/POST/PUT/DELETE | `/api/employees` | Employee CRUD |
| GET/POST/PUT/DELETE | `/api/projects` | Project CRUD |
| POST | `/api/matching/analyze` | Rank employees for project |
| POST | `/api/team-builder/recommend` | Greedy team recommendation |
| GET | `/api/workload/analysis` | Utilization dashboard data |
| POST | `/api/workload/reallocation/recommend` | Suggest move |
| POST | `/api/workload/reallocation/confirm` | Persist reassignment |
| GET | `/api/skill-gaps/{project_id}` | Coverage matrix + training |
| GET | `/api/risks` | All project risks |
| GET | `/api/risks/{project_id}` | Single project risk |
| GET | `/api/activities` | Recent activity log |

Interactive docs: http://127.0.0.1:8000/docs

## Data model notes

- **Availability** — percent of time an employee can work.
- **Utilization / workload** — primarily sum of active `assignments.assigned_workload`; falls back to `employees.workload_percentage` when no assignments exist.
- Seed runs once (`app_meta.seed_complete`); restart does not duplicate rows.

## Project structure

```
backend/          FastAPI, SQLAlchemy, algorithms, pytest
frontend/         React, Vite, Tailwind, Recharts
```
