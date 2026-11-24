# AdaptAI — Project Specification & Technical Knowledge Base

> **Target Audience:** Core Developers, AI Assistants, and Technical Evaluators  
> **Repository Root:** `AdaptAI/`  
> **Architecture Version:** Direct Service & High-Performance AI Architecture (Streamlined, No MCP / No Multi-Agent Overhead)  
> **License:** MIT  

---

## 1. Executive Summary & Core Mission

**AdaptAI** is an inclusive, accessible educational web platform designed to provide a calm, friendly, and adaptive learning environment for all students, with specialized sensory and pedagogical accommodations for neurodivergent learners including **Autism Spectrum Disorder (ASD), Attention-Deficit/Hyperactivity Disorder (ADHD), and Dyslexia**.

Traditional learning platforms are often sensory-unfriendly, rigid in pacing, and punitive in evaluation metrics. AdaptAI addresses these challenges through:
1. **Teacher-Authored Structured Curricula** coupled with fast, direct AI generation of Daily Practice Problems (DPP) and chapter tests with exactly 3 answer options (A, B, C).
2. **Performance-Driven Learning Batches:** Learners earn their batch (**Batch Alpha**, **Batch Beta**, or **Batch Gamma**) via an adaptive **Enrollment Test**, completely detached from chronological age limits.
3. **Upward-Inclusive Course Discovery:** Students have full upward visibility, allowing learners to access and join courses of their assigned batch and all higher batches.
4. **Student Autonomy & Non-Automatic Enrollment:** Taking the Enrollment Test provides personalized recommendations, but never forces automatic enrollment. Students retain full agency to enroll immediately or explore available courses and self-enroll at their own pace.
5. **Streamlined, Direct Architecture:** Zero multi-agent task router or MCP orchestration overhead. Core domain logic is encapsulated in modular async FastAPI services paired directly with high-performance LLM provider APIs (Groq, NVIDIA Nemotron, OpenAI, Gemini) for sub-second structured JSON responses.
6. **Multimodal Sensory Accommodations:** Real-time text clues and spoken voice narration (Web Speech API / TTS), dyslexia-friendly typography (`Lexend`), high-contrast mode, and dynamic text scaling.
7. **Fair Teacher Ratings via the Strict First-Attempt Rule:** Students enjoy unlimited practice retakes for mastery learning, while course quality ratings (1–5 stars) and educator analytics are computed strictly from students' initial test attempts.

---

## 2. Core Architectural Principles & Invariants

When reading, modifying, or extending this codebase, developers and agents **must** uphold the following invariants:

### 2.1 The Performance-Driven Batch Invariant
- **No Chronological Age Locking:** Students are never constrained by chronological age. A 10-year-old performing well earns Batch Beta or Batch Gamma.
- **Batch Evaluation Thresholds:**
  $$\text{Score} < 50\% \implies \textbf{Batch Alpha} \quad (\text{Foundational concepts})$$
  $$50\% \le \text{Score} \le 75\% \implies \textbf{Batch Beta} \quad (\text{Intermediate concepts})$$
  $$\text{Score} > 75\% \implies \textbf{Batch Gamma} \quad (\text{Advanced concepts})$$
- **Upward-Inclusive Visibility:** In the course catalog, a student in Batch Beta can view and enroll in all Batch Beta courses as well as all higher-tier Batch Gamma courses. Students without an active test have open visibility across all courses.

### 2.2 Student Autonomy & Non-Forced Enrollment
- Submitting the Enrollment Test evaluates the score, updates the student's earned batch, and recommends a tailored course.
- **The backend does NOT automatically insert an `Enrolment` row on test completion.**
- The student is presented with clear options:
  - **`✓ Enrol in Suggested Course →`**: Enrolls immediately and transitions to the learning room.
  - **`Explore Courses →`**: Skips immediate enrollment and opens the dashboard with the earned batch active. The student can self-enroll in the recommended course or any other batch-eligible course later.

### 2.3 The First-Attempt Rule (Teacher Fairness & Student Mastery)
- In chapter tests, students are encouraged to re-attempt assessments indefinitely to achieve mastery.
- **Course ratings (`CourseRating`), teacher dashboard analytics, and class mastery averages are calculated strictly from attempts where `is_first_attempt == True` (`attempt_number == 1`).**
- Subsequent attempts update student progress tracking but never corrupt teacher star ratings or analytics.

### 2.4 The Consent-First Invariant
- **No Unconsented Pedagogical Interventions:** Adaptations (e.g., worked examples, extra hint depth) are proposed, never forcibly injected into a session without student or parent approval.
- **Append-Only Consent Ledger:** The `consent_ledger` table (`backend/app/db/models/adaptation.py`) is strictly append-only. `UPDATE` and `DELETE` operations are strictly forbidden. State changes write a new row referencing `supersedes_id`.

### 2.5 Decoupled Provider Seams
- All AI, Speech, and Media operations use provider abstractions:
  - `LLMProvider` (`backend/app/llm/base.py`)
  - `TTSProvider` and `STTProvider` (`backend/app/speech/base.py`)
  - `VideoStore` (`backend/app/video/base.py`)
- High-fidelity **deterministic fake providers** (`FakeLLMProvider`, `FakeTTSProvider`, `FakeVideoStore`) allow zero-cost offline development, CI/CD testing, and test suite execution without external API keys.

---

## 3. Technology Stack

| Layer | Technologies & Libraries | Key Responsibilities |
| :--- | :--- | :--- |
| **Frontend** | React 19, TypeScript 5, Vite, Vanilla CSS Design System | Accessible UI (WCAG 2.2 AA), Lexend Dyslexia font toggle, high-contrast theme, dynamic zoom controls, Web Speech API voice synthesis, student and teacher workspaces. |
| **API Gateway** | FastAPI 0.115+, Pydantic v2, Python 3.11–3.13 | High-throughput REST API, JWT authentication (OAuth2 Password Bearer), native bcrypt hashing, role guardrails, CORS middleware. |
| **Core Services** | Modular Async Python Domain Services | `diagnostic_service.py`, `practice_service.py`, `test_service.py`, `teacher_service.py`, `auth_service.py`. Direct business logic without framework bloat. |
| **AI Layer** | Direct Provider Seam (`LLMFactory`) | Native API integration with NVIDIA Nemotron, Groq, OpenAI, Google Gemini, and OpenRouter. Structured JSON schema validation and sub-second generation. |
| **Persistence** | PostgreSQL 15+ (asyncpg), SQLite fallback (aiosqlite), SQLAlchemy 2.0 Async, Alembic | Async connection pooling, seed data loader, UUID primary keys, UTC timestamp mixins, append-only ledger tables. |
| **Audio & Speech** | Browser Web Speech API (`speechSynthesis`) + Server TTS Fallback | Real-time voice narration of practice hints and questions for students with dyslexia or auditory learning preferences. |
| **Telemetry & ML**| Rolling-window signal tracker & heuristic struggle detection | Latency, hesitation, option flip & error pattern extraction; transparent rule-weighted struggle scoring. |

---

## 4. System Architecture & Workflows

### 4.1 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ Accessible Frontend Client (React 19 + TypeScript + Vite)       │
│ • Student Dashboard: Explore Courses, My Courses, Profile       │
│ • Registration Redirection Modal & Adaptive Enrollment Test     │
│ • Course Study Room: Video Player, 3-Choice Practice DPP, Tests │
│ • Teacher Studio: Curriculum Authoring & AI Generation Studio   │
│ • Accessibility Bar: Dyslexia Font, High Contrast, Dynamic Zoom│
└──────────────────────────────┬──────────────────────────────────┘
                               │ REST / JSON (Proxied via Vite)
┌──────────────────────────────▼──────────────────────────────────┐
│ API Gateway & Security (FastAPI + PyJWT + Native Bcrypt)        │
│ • Single Account Model: Student/Parent shared entity            │
│ • Role Guardrails: Student vs Teacher permission enforcement    │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│ Core Domain Services (Modular Async Python)                     │
│ ├─ Diagnostic & Enrollment Service: Automated test evaluation,   │
│ │  batch assignment (Batch Alpha/Beta/Gamma), recommendations   │
│ ├─ Practice Service: 3-tier ZPD scaffolded hints (Text & Audio) │
│ ├─ Content Authoring Service: Courses, chapters, topics, videos │
│ ├─ Test Service: Server-timed chapter tests & First-Attempt rule│
│ ├─ Struggle Detection: Dwell time & hesitation heuristics       │
│ └─ Consent Ledger Service: Immutable audit trail                │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│ Direct AI Provider Seam (Zero Framework Overhead)              │
│ • Direct API Integration: Groq / NVIDIA / OpenAI / Gemini       │
│ • Structured JSON responses with sub-second generation latency  │
│ • Offline deterministic Mock Provider for zero-cost testing     │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│ Persistence Layer (PostgreSQL / Supabase + SQLAlchemy 2.0 Async)│
│ • Async connection pooling with SQLite in-memory fallback       │
│ • 30 Relational tables, seed data loader, UTC timestamps        │
└─────────────────────────────────────────────────────────────────┘
```

---

### 4.2 Detailed User Journeys

#### A. Student Onboarding & Enrollment Flow
1. **Registration:** Student enters display name, age, declared learning preference (e.g. ADHD, Dyslexia, ASD, or General), email, and password.
2. **Redirection Screen:** The dashboard is not shown immediately. Instead, a celebratory redirect card appears with a 3-second countdown and rotating loader (`Redirecting you to test in 3s...`) and a direct button `Start Enrollment Test Now →`.
3. **Adaptive Enrollment Test:** Student completes 10 calm questions covering Science, Maths, English, Reasoning, and Hindi without timer pressure.
4. **Batch & Recommendation Evaluation:**
   - Score `< 50%` $\implies$ **Batch Alpha**
   - Score `50% – 75%` $\implies$ **Batch Beta**
   - Score `> 75%` $\implies$ **Batch Gamma**
   - Suggests a tailored course matching the assigned batch.
5. **Autonomous Choice:**
   - `✓ Enrol in Suggested Course →`: Enrolls immediately and opens the study room.
   - `Explore Courses →`: Navigates to dashboard with the earned batch active. The student can self-enroll into the recommended course or any other course from the catalog.

#### B. Course Study Room & Practice Flow
1. **Video Lessons:** Student watches bite-sized lecture videos and clicks `Mark Lesson Done`.
2. **Daily Practice Problems (DPP):** Aligned 3-choice questions (A, B, C).
3. **Multimodal Hints:** Student can request hints delivered as plain text or spoken voice narration via Web Speech API.
4. **Timed Chapter Tests:** Server-timed tests with strict first-attempt grading preservation and unlimited practice re-attempts.

#### C. Teacher Course Creation & AI Studio Flow
1. **Course Creation:** Create courses organized by subject and batch with fees or free access.
2. **Curriculum Hierarchy:** Add chapters, topics, and video lessons.
3. **Direct AI Generation:** Generate aligned 3-choice DPPs and chapter tests from topic notes in seconds.
4. **Question Review & CRUD:** Edit question prompts, change correct choices, delete, or create questions in real time.
5. **Student Analytics:** View genuine student scores, identify struggling learners, and inspect 5-star course ratings based on first attempts.

---

## 5. Database Architecture & Data Models

All models inherit from `Base`, `UUIDMixin` (36-character string UUID), and `TimestampMixin` (`created_at`, `updated_at` in UTC timezone). Located in `backend/app/db/models/`.

```
                  ┌─────────────────┐
                  │      User       │
                  └────────┬────────┘
             1:1   ┌───────┴───────┐   1:1
     ┌─────────────┤               ├─────────────┐
     ▼                             ▼             ▼ 1:M (Parent)
┌─────────┐                   ┌─────────┐   ┌─────────┐
│ Teacher │                   │ Student │◄──┤ Student │
└────┬────┘                   └────┬────┘   └─────────┘
     │ 1:M                         │
     ▼                             ├─► DisabilityProfile (1:M) ──► DisabilityType
┌─────────┐                        ├─► Enrolment (1:M) ──────────► Course
│ Course  │                        ├─► DPPSession (1:M) ─────────► DPP
└────┬────┘                        ├─► TestAttempt (1:M) ────────► ChapterTest
     ├─► Chapter (1:M)             ├─► BehaviourSignal (1:M)
     │     ├─► Topic ──► DPP       ├─► StruggleAssessment (1:M)
     │     ├─► Lecture             ├─► ConsentLedger (1:M, append-only)
     │     └─► ChapterTest         ├─► StudentPreference (1:M)
     └─► CourseRating (1:1 cache)  └─► TrustProfile (1:1)
```

### Key Entity Groups

1. **Identity (`identity.py`):**
   - `User`: Email, password hash, role (`student`, `teacher`, `parent`), active flag.
   - `Student`: Linked to `User`, optional `parent_user_id`, display name, age, `age_band_id` (representing the earned learning batch: Batch Alpha, Beta, or Gamma).
   - `Teacher`: Linked to `User`, display name, authored courses.
   - `DisabilityProfile`: Many-to-many relationship linking `Student` to declared `DisabilityType`.
2. **Curriculum Content (`content.py`):**
   - `Course`: Teacher ID, title, subject, age band reference, fee, description, published flag.
   - `Chapter`: Course ID, title, sequence order.
   - `Topic`: Chapter ID, title, syllabus notes (`content_text`).
   - `Lecture`: Chapter ID, title, `video_ref`, duration.
3. **Practice & Evaluation (`practice.py`):**
   - `DPP`: Daily Practice Problem container for a Topic.
   - `Question`: Universal 3-choice question model (`parent_type`: `dpp` | `chapter_test` | `diagnostic`, prompt, 3 MCQ options JSON, correct answer JSON, explanation, difficulty).
   - `ChapterTest`: Chapter ID, time limit (default 1200s / 20 min), status.
   - `TestAttempt`: Chapter test ID, student ID, `attempt_number`, `is_first_attempt` (boolean), started/submitted timestamps, score, max score.
   - `AttemptAnswer`: Answer details per question in a test attempt.
   - `DPPSession` & `DPPResponse`: Session-based student practice response logging with latency and hint usage.
4. **Diagnostic & Enrollment (`diagnostic.py`):**
   - `Diagnostic`: Enrollment test record, student ID, score, max score, percentage, recommended course ID.
   - `DiagnosticAnswer`: Individual question response with latency tracking.
5. **Progress & Adaptation (`progress.py`, `adaptation.py`):**
   - `Enrolment`: Student enrollment in a Course.
   - `ChapterProgress`: Checkpoints for lecture completion, DPP completion, and test unlock.
   - `ConsentLedger`: Append-only audit trail (`proposal_type`, `priority_class`, `status`, `decided_by`, `supersedes_id`).
   - `BehaviourSignal` & `StruggleAssessment`: Telemetry signals (dwell time, hesitation) and heuristic risk evaluations.
6. **Ratings (`rating.py`):**
   - `CourseRating`: Cached course quality rating (1.0 to 5.0 stars) calculated exclusively from first attempts (`is_first_attempt == True`).

---

## 6. Behavioral Telemetry & Struggle Detection

Located in `backend/app/ml/` and `frontend/src/instrumentation/`:

### 6.1 Telemetry Signals
The client tracker (`tracker.ts`) buffers and dispatches four granular telemetry signals:
1. `response_latency`: Time taken from question render to submission (`time_taken_ms`).
2. `input_hesitation`: Idle time before first interaction (`idle_time_ms`) and option changes (`option_changes`).
3. `error_pattern`: Consecutive incorrect submissions and repeat mistakes on similar concepts.
4. `hint_request`: Hint count, depth requested, and audio play frequency.

### 6.2 Struggle Heuristics
A transparent, explainable heuristic scoring engine:
$$\text{Score} = 0.45 \cdot \text{ErrorScore} + 0.35 \cdot \text{TimeScore} + 0.20 \cdot \text{EffortScore}$$
- **High Risk:** $\text{Score} \ge 0.70$, or consecutive errors $\ge 3$, or consecutive errors $\ge 2$ with latency ratio $\ge 2.0\times$.
- **Medium Risk:** $\text{Score} \ge 0.40$, or consecutive errors $\ge 2$, or latency ratio $\ge 1.8\times$.
- Emits human-readable **`contributing_factors`** (e.g. *"Response time is 2.2x higher than baseline"*, *"High hint reliance"*).

---

## 7. Frontend Architecture & Accessibility Standards

Located in `frontend/src/`:

### 7.1 Accessibility (WCAG 2.2 AA Conformance)
- **Mindful Teal Design System:** Calming, non-overstimulating color palette with high contrast and zero visual glare.
- **Dyslexia Font Support:** Global toggle applies `font-dyslexic` (`Lexend` / high-legibility sans-serif fallback).
- **High-Contrast Theme:** Dedicated dark/high-contrast palette avoiding vibration and halo effects.
- **Dynamic Font Scaling:** `A-`, `Reset`, and `A+` buttons controlling `--font-scale` dynamically.
- **Multimodal Audio Playback:** Integration with browser Web Speech API (`speechSynthesis`) for synthesized read-aloud support.
- **Simple Circular Loaders:** Clean rotating circle animations without distracting bounding boxes.

### 7.2 Key Component Views (`frontend/src/features/`)
1. **`StudentDashboard.tsx`:** 3-tab hub (Explore Courses, My Courses, My Profile) with batch badge, upward-inclusive course filters, simulated enrollment dialog, and consent ledger trigger.
2. **`StudentOnboarding.tsx`:** Multi-step wizard covering registration, adaptive Enrollment Test, batch placement evaluation, and autonomous course enrollment choice (`Enrol in Suggested Course` vs `Explore Courses`).
3. **`CourseStudyRoom.tsx`:** Comprehensive study environment with lecture video playback, topic progression, and direct launches for DPP practice and timed chapter tests.
4. **`PracticeSession.tsx`:** Interactive practice interface with 3-choice questions, live telemetry tracking, 3-tier ZPD hint modal, instant plain-language feedback, and spoken audio narration buttons.
5. **`TimedChapterTest.tsx`:** Timed evaluation interface with countdown timers, automatic submission upon expiration, first-attempt indicator, and post-submission score review.
6. **`TeacherDashboard.tsx` & `TeacherCoursesManager.tsx`:** Educator portal with course creation, AI content generation, class mastery analytics, struggling student alerts, and first-attempt star ratings.
7. **`AuthModal.tsx`:** Sign-in and registration dialog with post-registration redirection screen, rotating circle animation, and countdown timer to the Enrollment Test.
8. **`ConsentDecisionCenter.tsx`:** The student's adaptation control room displaying pending adaptation cards, trust profile stats, active preferences, and immutable audit history.

---

## 8. Comprehensive API Endpoint Reference

All endpoints are mounted under `/api/v1` in `backend/app/main.py`:

| Category | Method | Path | Auth / RBAC | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **System** | `GET` | `/health` | Public | System health check and active AI provider configuration. |
| **Auth** | `POST` | `/auth/register` | Public | Registers teacher or student user; returns JWT access token. |
| | `POST` | `/auth/login` | Public | Authenticates credentials; returns JWT access token. |
| | `GET` | `/auth/me` | Authenticated | Returns current user profile with role, batch, and linked IDs. |
| **Reference** | `GET` | `/reference/disability-types` | Public | Lists supported disability types and hint configurations. |
| | `GET` | `/reference/age-bands` | Public | Lists learning batches (Batch Alpha, Batch Beta, Batch Gamma). |
| | `GET` | `/reference/scaffold-levels` | Public | Lists the 3 ZPD scaffold levels. |
| **Courses** | `POST` | `/courses` | Teacher | Creates a new curriculum course. |
| | `GET` | `/courses` | Public | Lists published courses (filterable by batch and subject). |
| | `GET` | `/courses/{id}` | Public | Detailed course syllabus with chapters, topics, and video lectures. |
| | `POST` | `/courses/{id}/chapters` | Teacher | Adds a chapter to a course. |
| | `POST` | `/chapters/{id}/topics` | Teacher | Adds a topic with notes to a chapter. |
| | `POST` | `/chapters/{id}/lectures` | Teacher | Attaches a video lecture to a chapter. |
| | `POST` | `/courses/{id}/enrol` | Student | Enrolls student into a course. |
| **Content Gen**| `POST` | `/topics/{id}/generate-dpp` | Teacher | AI generates aligned 3-choice DPP questions from topic notes. |
| | `POST` | `/chapters/{id}/generate-test` | Teacher | AI generates aligned 3-choice chapter test questions. |
| **Diagnostic** | `POST` | `/students/{id}/diagnostic/start`| Student/Parent | Starts the 10-question adaptive Enrollment Test. |
| | `POST` | `/diagnostic/{id}/submit`| Student/Parent | Evaluates test answers, assigns batch, recommends course. |
| | `GET` | `/diagnostic/{id}/recommendation`| Student/Parent | Retrieves placement result and recommendation details. |
| | `GET` | `/students/{id}/diagnostic/latest`| Student/Parent | Retrieves the student's latest test score and assigned batch. |
| **Practice** | `POST` | `/dpps/{id}/sessions` | Student | Starts interactive practice session for a DPP. |
| | `POST` | `/dpps/{id}/sessions/{sid}/hint` | Student | Generates disability-aware ZPD hint with audio synthesis. |
| | `POST` | `/dpps/{id}/sessions/{sid}/respond`| Student | Submits answer for a DPP question with latency tracking. |
| | `GET` | `/dpps/{id}/sessions/{sid}/summary`| Student | Summarizes session accuracy, time, and hints used. |
| **Struggle** | `POST` | `/students/{id}/signals` | Student | Ingests high-frequency telemetry signals batch. |
| | `POST` | `/students/{id}/struggle/evaluate`| Student | Evaluates recent signals, records assessment & proposals. |
| **Consent** | `GET` | `/students/{id}/consent/pending` | Student/Parent | Fetches unreviewed proposals in plain-language format. |
| | `POST` | `/students/{id}/consent/decide` | Student/Parent | Records approval or decline in the append-only ledger. |
| | `GET` | `/students/{id}/consent/ledger` | Student/Parent | Retrieves immutable audit trail of adaptation proposals. |
| | `GET` | `/students/{id}/preferences` | Student/Parent | Returns active preferences for student. |
| | `PUT` | `/students/{id}/preferences` | Student/Parent | Overrides student preference (e.g. font, modality). |
| | `GET` | `/students/{id}/trust-profile` | Student/Parent | Returns student trust metrics (acceptance %, cooldowns). |
| **Tests** | `POST` | `/chapter-tests/{id}/attempts` | Student | Initiates timed test attempt (enforces first-attempt flag). |
| | `POST` | `/chapter-tests/{id}/attempts/{aid}/submit`| Student| Submits answers, grades test, updates progress. |
| | `GET` | `/chapter-tests/{id}/attempts/{aid}/results`| Student| Fetches graded attempt review with explanations. |
| **Analytics** | `GET` | `/courses/{id}/rating` | Public | Course star rating computed exclusively from first attempts. |
| | `GET` | `/courses/{id}/analytics` | Teacher | Educator analytics: mastery, re-attempts, friction clusters. |

---

## 9. Operational & Testing Guidelines

1. **Database Schema Integrity:**
   - Any schema modifications must update models in `backend/app/db/models/`, be registered in `__init__.py`, and updated in `seed_loader.py`.
2. **Preserving the First-Attempt Invariant:**
   - Never modify or bypass the `is_first_attempt == True` filter when computing `CourseRating` or teacher dashboard analytics.
3. **Preserving the Consent-First Invariant:**
   - Never update or delete rows in `consent_ledger`. All decisions write a new row referencing `supersedes_id`.
4. **Preserving Batch Autonomy:**
   - Never restore automatic course enrollment upon test submission. Students must retain the choice to enroll in the suggested course or explore other eligible courses independently.
5. **Offline & CI Resilience:**
   - All tests and core workflows must pass using `LLM_PROVIDER=fake`, `TTS_PROVIDER=fake`, and in-memory SQLite (`sqlite+aiosqlite:///:memory:`).
