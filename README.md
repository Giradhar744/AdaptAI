# AdaptAI — AI-Powered Educational Platform for Diverse & Specially-Abled Learners

[![Python](https://img.shields.io/badge/Python-3.11%20%7C%203.12%20%7C%203.13-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19.x-61dafb.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6.svg)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-336791.svg)](https://www.postgresql.org/)
[![Tests](https://img.shields.io/badge/Tests-100%25%20Verified-brightgreen.svg)](tests/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**AdaptAI** is an inclusive, accessible educational platform built to provide a calm, friendly, and adaptive learning environment for all students, with specialized sensory and pedagogical accommodations for neurodivergent learners including **ADHD, Autism Spectrum Disorder (ASD), and Dyslexia**.

AdaptAI pairs genuine teacher-authored curricula with low-latency AI assistance: real-time spoken audio hints, simplified text clues, 3-choice practice problems, server-timed chapter tests with first-attempt grade integrity, and transparent learner consent—all designed with sensory clarity and zero cognitive overload.

---

## 🌟 Core Pillars & Philosophy

1. **Batches Determined by Performance, Not Age:**
   Students are never held back or compartmentalized by chronological age. Instead, learners earn their track through an adaptive **Enrollment Test**, placing them into **Batch Alpha**, **Batch Beta**, or **Batch Gamma**.
2. **Upward-Inclusive Course Discovery:**
   Learners always have upward mobility. A student in Batch Beta can view and enroll in all Batch Beta courses as well as all higher-tier Batch Gamma courses.
3. **Student Autonomy & Consent:**
   Taking the test never forcibly enrolls a student. Learners receive a personalized course recommendation and can either enroll immediately or browse available courses and self-enroll at their own pace. All assistive accommodations require explicit student or parent approval.
4. **Multimodal Audio & Text Hints:**
   Practice hints are delivered both as simplified text and as natural spoken voice (via Web Speech API / TTS) to minimize reading fatigue and support students with dyslexia and ADHD.
5. **Fair Teacher Ratings (First-Attempt Rule):**
   Students enjoy unlimited practice retakes for mastery learning, but course star ratings (1 to 5 stars) and teacher class analytics are computed strictly from students' **first test attempts**, preventing rating distortion.
6. **Direct, High-Performance Architecture:**
   Zero multi-agent orchestration overhead or complex framework lock-in. A direct service layer and direct AI provider integration deliver sub-second responses with maximum reliability.

---

## 📐 System Architecture

AdaptAI uses a streamlined, decoupled client-service architecture:

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Accessible Frontend Client (React 19 + TypeScript + Vite)     │
│    • Student Dashboard: Explore Courses, My Courses, Profile    │
│    • Registration & Auto-Redirect to Adaptive Enrollment Test    │
│    • Course Study Room: Video Player, 3-Choice DPPs, Tests      │
│    • Teacher Studio: Course Authoring & AI DPP/Test Studio      │
│    • Accessibility: Lexend Dyslexic Font, High Contrast, Zoom,  │
│      Web Speech API Voice Synthesis & Mindful Teal Theme        │
└──────────────────────────────┬──────────────────────────────────┘
                               │ REST / JSON (Proxied via Vite)
┌──────────────────────────────▼──────────────────────────────────┐
│ 2. API Gateway & Security (FastAPI + PyJWT + Bcrypt)            │
│    • Single Account Model: Student/Parent shared authentication │
│    • Role-based access control (Student vs Teacher guardrails)  │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│ 3. Core Business Services (Modular Async Python)                │
│    ├─ Diagnostic & Enrollment Service: Automated test evaluation│
│    │  and Batch (Alpha/Beta/Gamma) assignment                   │
│    ├─ Practice Service: 3-tier ZPD scaffolded hints (Text/Audio)│
│    ├─ Content Authoring Service: Curriculum, chapters & topics  │
│    ├─ Test Service: Server-timed tests & First-Attempt isolation│
│    ├─ Struggle Detection: Dwell time & hesitation heuristics    │
│    └─ Consent Ledger Service: Immutable audit trail             │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│ 4. Direct AI Provider Seam (Zero Framework Overhead)           │
│    • Direct API Integration: Groq / NVIDIA / OpenAI / Gemini    │
│    • Structured JSON schema responses with sub-second latency   │
│    • Offline/CI fallback to high-fidelity deterministic Mock     │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│ 5. Persistence Layer (PostgreSQL / Supabase + SQLAlchemy Async) │
│    • Async connection pooling with SQLite in-memory fallback   │
│    • Append-only accommodation ledger & student progress history│
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Key User Workflows

### 🎓 Student Learning Journey

1. **Registration & Test Redirection:**
   - The student registers with their display name, age, and declared learning preference (e.g., ADHD, Dyslexia, ASD, or General).
   - Rather than dropping into a blank dashboard, a friendly **Redirection Screen** appears with a 3-second countdown and rotating loader, explaining that every student takes the Enrollment Test to determine their learning batch.
2. **Adaptive Enrollment Test:**
   - A calm, 10-question assessment covering English, Science, Basic Reasoning, Maths, and Hindi.
   - Stress-free: no timer pressure, clear wording, and accessible fonts.
3. **Batch Placement & Course Recommendation:**
   - **Score < 50%:** Placed in **Batch Alpha** (Foundational learning track).
   - **Score 50% – 75%:** Placed in **Batch Beta** (Intermediate learning track).
   - **Score > 75%:** Placed in **Batch Gamma** (Advanced learning track).
   - Recommends a tailored course matching their earned batch.
4. **Autonomous Enrollment Decision:**
   - **`✓ Enrol in Suggested Course →`**: Enrolls immediately and opens the study room.
   - **`Explore Courses →`**: Skips immediate enrollment and opens the dashboard with the earned batch active. The suggested course is highlighted with a *"⭐ Best Match"* badge, and the student can self-enroll in that course or any other batch-eligible course whenever they want.
5. **Interactive Course Study Room:**
   - Watch bite-sized teacher video lectures and mark lessons complete.
   - Solve 3-choice Daily Practice Problems (DPP) with instant plain-language explanations.
   - Click for scaffolded clues and real-time **spoken audio hints** narrated directly in the browser.
   - Take server-timed chapter tests with unlimited practice retakes for mastery.

---

### 👩‍🏫 Teacher & Educator Studio

1. **Curriculum Authoring:**
   - Create structured courses with custom subjects, descriptions, and fees (or free access).
   - Add chapters, syllabus topics, and video lessons with integrated streaming references.
2. **AI Practice & Test Generator:**
   - Generate aligned Daily Practice Problems (DPP) and chapter tests with exactly 3 answer choices (A, B, C) directly from teacher topic notes.
   - Instant generation powered directly by high-performance LLMs without latency-heavy agent chains.
3. **Question Review & CRUD:**
   - Review AI-generated questions in real time: edit question prompts, adjust correct answers, delete questions, or manually add custom questions before publishing.
4. **Student Analytics & First-Attempt Ratings:**
   - View genuine student progress and test averages.
   - Identify learners experiencing hesitation or needing extra support.
   - Track transparent 5-star course quality ratings derived strictly from students' initial test attempts.

---

## ♿ Accessibility Features (WCAG 2.2 AA)

- **Mindful Teal Palette:** Calming, non-overstimulating color palette with high contrast and zero visual glare.
- **Dyslexia-Friendly Font Toggle:** One-click toggle switching to high-legibility `Lexend` / dyslexia typography.
- **High-Contrast Theme:** Dark high-contrast mode designed for visual comfort.
- **Dynamic Text Scaling:** `A-`, `Reset`, and `A+` buttons controlling font scale dynamically across all views.
- **Speech Audio Playback:** Text-to-Speech audio clues for practice questions and hints to assist auditory learners.
- **Consent Decision Center:** An immutable, append-only log allowing students and parents to review, approve, or decline any AI adaptation at any time.

---

## 🚀 Quick Start Guide

### Prerequisites
- **Python:** 3.11, 3.12, or 3.13
- **Node.js:** v18.0.0 or higher
- **PostgreSQL:** Cloud Supabase, Neon, or local PostgreSQL (*SQLite fallback supported*)

---

### 1. Clone the Repository
```bash
git clone https://github.com/Giradhar744/AdaptAI.git
cd AdaptAI
```

---

### 2. Backend Setup
1. **Navigate to the backend directory:**
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
   Create a `.env` file in the project root (reference `.env.example`):
   ```env
   DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
   DATABASE_SYNC_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
   SECRET_KEY=your-jwt-secret-key
   
   # AI Provider: 'groq', 'nvidia', 'openai', 'gemini', 'openrouter', or 'fake'
   LLM_PROVIDER=nvidia
   NVIDIA_API_KEY=your-api-key
   NVIDIA_MODEL=nvidia/nemotron-3.5-super-vl-120b-a12b
   ```
5. **Start the Backend Server:**
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   - API Documentation: [http://localhost:8000/docs](http://localhost:8000/docs)
   - Health Check: [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)

---

### 3. Frontend Setup
1. **Open a new terminal and navigate to the frontend directory:**
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

### Run End-to-End Acceptance Flow
```bash
python backend/scripts/e2e_acceptance.py
```
Validates the entire 12-step teacher and student journey from course authoring and AI generation to enrollment test, practice audio hints, and first-attempt rating analytics (**100% pass rate**).

### Run Test Suite
```bash
python -m pytest backend/tests/ -v
```

### Build Frontend
```bash
cd frontend && npm run build
```
Validates clean TypeScript compilation and packages the optimized production bundle.

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
