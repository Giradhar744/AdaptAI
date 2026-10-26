# AdaptAI — AI-Powered Educational Platform for Specially-Abled Students

[![Python](https://img.shields.io/badge/Python-3.11%20%7C%203.12%20%7C%203.13-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18.x-61dafb.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6.svg)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-336791.svg)](https://www.postgresql.org/)
[![Tests](https://img.shields.io/badge/Tests-36%20Passed%20(100%25)-brightgreen.svg)](tests/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**AdaptAI** is an accessible, AI-powered learning platform designed to provide a calm, friendly, and personalized study environment for specially-abled students, including learners with **Dyslexia, ADHD, and Autism (ASD)**.

Built by senior software and AI engineers, AdaptAI pairs teacher-authored courses with ultra-low-latency AI hints (in both natural spoken audio and simplified text), server-timed chapter tests, and transparent consent control—all using clear, simple words with zero sensory overload.

---

## 🌟 Core Pillars

1. **Clear, Friendly Language:** No heavy academic jargon. Features are described in simple words anyone can understand (e.g. *"Helpful Clues & Audio Hints"*, *"Course Rating"*, *"Practice Retakes"*, *"Students Needing Help"*).
2. **Transparent Consent & Control:** Students and parents are always in control. Learning aids (spoken hints, extra time, simpler text) are recorded in a clear Consent Ledger and only activated with approval.
3. **Step-by-Step Learning (ZPD):** Guidance progresses gently from simple clues to worked examples so students build confidence without feeling stuck.
4. **Multimodal Audio & Text Hints:** High-performance, low-latency AI hints (<15ms) delivered as clear text or spoken voice narration to prevent reading fatigue.
5. **Fair Teacher Ratings:** Course quality ratings (1 to 5 stars) are calculated strictly from students' **first test attempts**, while students enjoy unlimited practice retakes for learning.

---

## 📐 System Architecture

AdaptAI uses a decoupled, high-performance architecture optimized for minimal latency:

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Frontend Client (React 18 + TypeScript + Vite)               │
│    • Student Dashboard: Explore Courses, My Courses, Profile    │
│    • Course Study Room: Video Player, Practice DPP, Tests       │
│    • Teacher Studio: AI Curriculum Generator & Question Editor  │
│    • Accessibility: Dyslexia-friendly fonts, high-contrast, TTS │
└──────────────────────────────┬──────────────────────────────────┘
                               │ REST / JSON (Proxied via Vite)
┌──────────────────────────────▼──────────────────────────────────┐
│ 2. API Gateway & Security (FastAPI + PyJWT + Bcrypt)            │
│    • Single Account Model: Student/Parent shared entity         │
│    • Teacher role guardrails & course author ownership          │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│ 3. Multi-Agent Task Router (Low-Latency Orchestration)          │
│    ├─ Diagnostic Placement Agent (Rules: <50%, 50-75%, >75%)    │
│    ├─ ZPD Hint Agent (Spoken Audio + Disability-Tailored Text)  │
│    ├─ Content Generation Agent (3-Choice DPPs & Chapter Tests)  │
│    ├─ Struggle Detection Agent (Dwell time, hesitation alerts)  │
│    ├─ Consent & Trust Agent (Immutable Accommodation Ledger)    │
│    └─ Teacher Co-Pilot & Star Rating Agent                      │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│ 4. Direct AI Provider Layer (Zero Framework Overhead)          │
│    • OpenAI / Groq / OpenRouter / Gemini API Integration        │
│    • Built-in Web Speech API / TTS Audio Streaming              │
│    • Sub-15ms generation latency without heavy chain locks      │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│ 5. Persistence Layer (PostgreSQL / Supabase + SQLAlchemy Async) │
│    • Real-time database pooler with zero-cost demo simulation   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Key User Workflows

### 👩‍🏫 For Teachers & Educators
- **Create Courses:** Organize curricula by subject and target age groups (7–10, 11–15, 15–20) with course fees or free access.
- **Add Chapters & Video Lessons:** Add video URLs with integrated playback references.
- **AI Practice & Test Generator:** Generate aligned Daily Practice Problems (DPP) and chapter tests with exactly 3 answer options (A, B, C) directly from topic notes.
- **Question Review & CRUD:** Edit prompts, change correct answers, delete, or add new questions before publishing.
- **Student Analytics & Ratings:** View genuine class progress without placeholder data, see who needs extra support, and track 5-star course quality ratings.

### 🎓 For Students & Parents
- **3-Tab Student Dashboard:**
  1. **Explore Courses:** Browse all published courses. Features a *"Recommended for You"* banner based on placement test results.
  2. **My Courses:** Access joined courses and open the interactive study room.
  3. **My Profile:** View declared learning preferences, age group, latest diagnostic score, and privacy ledger.
- **Simulated Free Enrollment:** Click *"Join Course"* to open a safe demo purchase dialog with instant confirmation (no credit card required).
- **Course Study Room:**
  - Watch lesson videos and click *"Mark Lesson Done"*.
  - Solve 3-choice practice problems with instant spoken audio clues and simplified text hints.
  - Unlock and take server-timed chapter tests.
- **Placement Diagnostic:**
  - Score `< 50%`: Placed in **Ages 7–10** (progression to Ages 11–15).
  - Score `50% – 75%`: Placed in **Ages 11–15** (progression to Ages 15–20).
  - Score `> 75%`: Placed in **Ages 15–20**.

---

## 🚀 Quick Start Guide

### Prerequisites
- **Python:** 3.11, 3.12, or 3.13
- **Node.js:** v18.0.0 or higher
- **PostgreSQL:** Cloud Supabase, Neon, or local PostgreSQL (*SQLite fallback supported*)

---

### 1. Clone the Repository
```bash
git clone https://github.com/<your-username>/AdaptAI.git
cd AdaptAI
```

---

### 2. Backend Setup
1. **Navigate to the backend folder:**
   ```bash
   cd backend
   ```
2. **Create and activate a virtual environment:**
   - **Windows:**
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
   Create a `.env` file in the root directory (or use `.env.example`):
   ```env
   DATABASE_URL=postgresql://postgres.<project_ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
   DATABASE_SYNC_URL=postgresql://postgres.<project_ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
   SECRET_KEY=your-super-secret-jwt-key
   
   # Optional: Configure real AI provider (defaults to fast local mock if unset)
   LLM_PROVIDER=openai # or 'gemini', 'openrouter', 'groq'
   OPENAI_API_KEY=your-api-key
   OPENAI_MODEL=gpt-4o-mini
   ```
5. **Run the Database Seeder:**
   ```bash
   python scripts/seed.py
   ```
6. **Start the Backend Server:**
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   - API Docs: [http://localhost:8000/docs](http://localhost:8000/docs)
   - Health Check: [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)

---

### 3. Frontend Setup
1. **Open a new terminal and navigate to the frontend folder:**
   ```bash
   cd frontend
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Start the Vite development server:**
   ```bash
   npm run dev
   ```
4. **Open in your browser:**
   👉 **[http://localhost:5173](http://localhost:5173)**

---

## 🧪 Testing & Verification

### Run Pytest Test Suite
From the `backend/` directory:
```bash
python -m pytest -v
```
Runs all **36 tests** covering authentication, course authoring, 3-choice DPP generation, diagnostic placement rules, practice hints, struggle detection, and star rating analytics (**100% pass rate**).

### Run End-to-End Acceptance Flow
```bash
python scripts/e2e_acceptance.py
```
Validates the entire 12-step teacher and student journey from course creation to 5-star rating computation in under 3 seconds.

### Build Frontend
From the `frontend/` directory:
```bash
npm run build
```
Validates clean TypeScript compilation and builds the optimized production bundle.

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
