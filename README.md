# AdaptAI — AI-Powered Educational Platform for Specially-Abled Students

[![Python](https://img.shields.io/badge/Python-3.11%20%7C%203.12%20%7C%203.13-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18.x-61dafb.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6.svg)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-336791.svg)](https://www.postgresql.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

AdaptAI is a full-stack, two-sided educational web platform specifically engineered for neurodivergent and specially-abled K-12 learners (Autism Spectrum Disorder, ADHD, Dyslexia, and other learning differences).

Traditional ed-tech platforms present rigid, sensory-unfriendly digital learning environments. AdaptAI combines teacher-authored curricula with a multi-agent AI system operating through an MCP (Model Context Protocol) routing layer to deliver real-time, disability-aware learning adaptations.

---

## 🌟 Core Pillars & Principles

1. **Consent-First Adaptation:** Pedagogical interventions, difficulty pacing shifts, and modality adjustments (e.g., audio narration, simplified language, dyslexia-friendly typography) are **proposed** to the student/parent, recorded in an immutable consent ledger, and activated only upon consent.
2. **ZPD-Based Scaffolding:** Zone of Proximal Development scaffolding progresses from worked examples to conceptual hints to independent practice, preventing premature failure.
3. **Proactive Struggle Detection:** Behavioral signals (dwell time, answer flipping, hint velocity) trigger proactive micro-interventions before frustration or sensory overload sets in.
4. **Fair Teacher Evaluation:** Course star ratings and mastery metrics are computed strictly from students' **first attempts** on chapter tests, ensuring fairness while allowing students unlimited re-attempts for learning.

---

## 📐 System Architecture

AdaptAI is organized into five decoupled layers:

```
┌────────────────────────────────────────────────────────┐
│ 1. Frontend (React 18 + TypeScript + Vite + Tailwind)  │
│    Student Portal  │  Teacher Portal  │ Accessibility  │
└──────────────────────────┬─────────────────────────────┘
                           │ REST / JSON (Vite Proxy)
┌──────────────────────────▼─────────────────────────────┐
│ 2. API Gateway & Auth (FastAPI + PyJWT + Native Bcrypt)│
│    RBAC: Student, Parent, Teacher, Administrator       │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ 3. Multi-Agent MCP Router (Task Orchestration)         │
│  ├─ Diagnostic Placement Agent                         │
│  ├─ ZPD Hint Generation Agent                          │
│  ├─ Content Generation Agent (DPPs & Chapter Tests)    │
│  ├─ Struggle & Frustration Detection Agent             │
│  ├─ Consent & Trust Adaptation Agent                   │
│  └─ Teacher Co-pilot & Rating Analytics Agent          │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ 4. Pluggable Provider Abstractions                     │
│    LLM (Fake / OpenAI / Claude / Gemini)               │
│    Speech (Browser Web Speech API / ElevenLabs)        │
│    Video (Local storage / S3 bucket)                   │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ 5. Persistence (PostgreSQL + SQLAlchemy 2.0 Async)     │
│    Supabase / Neon / Render / Local PostgreSQL         │
└────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start Guide

Follow these steps to get AdaptAI running locally on your machine.

### Prerequisites

- **Python:** 3.11, 3.12, or 3.13
- **Node.js:** v18.0.0 or higher (with `npm`)
- **Git**
- **Database:** A PostgreSQL instance (Free cloud Supabase, Neon, Render, or a local PostgreSQL instance). *SQLite fallback is also supported.*

---

### 1. Clone the Repository

```bash
git clone https://github.com/<your-username>/AdaptAI.git
cd AdaptAI
```

---

### 2. Backend Setup

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Create and activate a virtual environment:**
   - **Windows (PowerShell):**
     ```powershell
     python -m venv venv
     .\venv\Scripts\Activate.ps1
     ```
   - **macOS / Linux:**
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure Environment Variables:**
   Copy the example configuration file in the root directory:
   - **Windows:** `copy .env.example .env` (or from backend: `copy ..\.env.example ..\.env`)
   - **macOS/Linux:** `cp .env.example .env` (or from backend: `cp ../.env.example ../.env`)

   Open `.env` in your text editor and set your `DATABASE_URL` and `DATABASE_SYNC_URL`.

   > **Using Cloud Supabase (Free Tier):**
   > Use the Session Pooler connection string (`port 5432`) with IPv4 support:
   > ```env
   > DATABASE_URL=postgresql://postgres.<project_ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
   > DATABASE_SYNC_URL=postgresql://postgres.<project_ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
   > ```
   > *Note: If your database password contains special characters like `@`, percent-encode them (e.g. `@` becomes `%40`).*
   >
   > **Using Local SQLite (Quick zero-config testing):**
   > ```env
   > DATABASE_URL=sqlite+aiosqlite:///./adaptai.db
   > DATABASE_SYNC_URL=sqlite:///./adaptai.db
   > ```

5. **Initialize and Seed the Database:**
   Run the seed script to create all 30 tables and populate reference data (disability types, age bands, scaffold levels, and priority orders):
   ```bash
   python scripts/seed.py
   ```

6. **Start the Backend Server:**
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   - Interactive OpenAPI documentation will be live at: [http://localhost:8000/docs](http://localhost:8000/docs)
   - Health check endpoint: [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)

---

### 3. Frontend Setup

1. **Open a new terminal and navigate to the frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install Node dependencies:**
   ```bash
   npm install
   ```

3. **Start the Vite development server:**
   ```bash
   npm run dev
   ```

4. **Launch the Application:**
   Open your browser and navigate to:
   👉 **[http://localhost:5173](http://localhost:5173)**

The frontend automatically proxies `/api` calls to `http://127.0.0.1:8000`.

---

## 🧪 Testing & Evaluation

### 1. Run Automated Unit & Integration Tests

From the `backend/` directory:
```bash
python -m pytest -v
```
Runs 36 comprehensive tests covering authentication, RBAC, diagnostic placement, DPP generation, struggle detection, consent ledger, timed tests, and the evaluation harness.

### 2. Run End-to-End Acceptance Flow

Execute the multi-actor acceptance flow validating the entire student-teacher journey:
```bash
python scripts/e2e_acceptance.py
```
Validates:
- Teacher course creation & chapter setup
- Student signup with declared disability profile
- Diagnostic assessment & course placement
- DPP practice with ZPD hints
- Chapter test completion with first-attempt star rating calculation

### 3. Run Evaluation Harness & Ablation Baselines

To benchmark AdaptAI against non-adaptive baselines (static DPPs, reactive hints, non-consent adaptations):
```bash
python eval/run_evaluation.py
```

---

## 📂 Repository Structure

```
AdaptAI/
├── .env.example              # Environment configuration template
├── .gitignore                 # GitHub ignore rules (ignores local secrets, agent caches, virtualenvs)
├── render.yaml                # 1-click cloud deployment blueprint
├── README.md                  # Project documentation
│
├── backend/                   # FastAPI Backend
│   ├── app/
│   │   ├── agents/            # 6 specialized pedagogical agents
│   │   ├── api/v1/            # REST API route handlers
│   │   ├── core/              # Config, security (JWT/bcrypt), dependencies
│   │   ├── db/                # SQLAlchemy async models, session, seed data
│   │   ├── llm/               # Pluggable LLM provider abstraction (Fake, OpenAI, etc.)
│   │   ├── mcp/               # Model Context Protocol routing layer
│   │   ├── services/          # Business logic & pedagogical rules
│   │   └── main.py            # FastAPI entry point & lifespan handler
│   ├── scripts/
│   │   ├── seed.py            # Database schema & reference data seeder
│   │   └── e2e_acceptance.py  # End-to-end multi-actor validation script
│   ├── tests/                 # Pytest test suite (36 tests)
│   └── requirements.txt       # Python dependencies
│
├── frontend/                  # React 18 + TypeScript + Vite Frontend
│   ├── src/
│   │   ├── components/        # Reusable UI & accessibility components
│   │   ├── context/           # Auth and accessibility state contexts
│   │   ├── pages/             # Student & Teacher portal views
│   │   ├── services/          # Axios API client integrations
│   │   └── App.tsx            # Main application router
│   ├── package.json           # Frontend dependencies & scripts
│   └── vite.config.ts         # Vite configuration with /api backend proxy
│
├── eval/                      # Evaluation harness & ablation benchmarking
│   ├── baselines/             # Ablation models (non-adaptive, reactive, non-consent)
│   ├── metrics/               # Mastery, frustration, and adherence metrics
│   ├── reports/               # Evaluation summary outputs
│   └── run_evaluation.py      # Benchmark runner script
│
└── docs/                      # Architectural decision records & schemas
```

---

## 👥 Contributors

- **Giradhar Gopal Kumar** (23319)
- **Keshav Dhiman** (23330)
- **Ujjwal Kulshrestha** (23363)

**Academic Supervisor:** Dr. Nishtha Hooda  
*School of Computing, Indian Institute of Information Technology (IIIT) Una*

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
