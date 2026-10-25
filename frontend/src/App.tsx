import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthModal } from './components/AuthModal';
import StudentOnboarding from './features/student/StudentOnboarding';
import PracticeSession from './features/student/PracticeSession';
import ConsentDecisionCenter from './features/student/ConsentDecisionCenter';
import TimedChapterTest from './features/student/TimedChapterTest';
import TeacherDashboard from './features/teacher/TeacherDashboard';
import heroImg from './assets/hero.png';

interface HealthData {
  status: string;
  environment: string;
  version: string;
  providers: Record<string, string>;
  agents: Record<string, boolean>;
}

const AppContent: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();

  const [dyslexicFont, setDyslexicFont] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [fontScale, setFontScale] = useState(1);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  // Auth modal state
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authDefaultMode, setAuthDefaultMode] = useState<'login' | 'register'>('login');
  const [authDefaultRole, setAuthDefaultRole] = useState<'student' | 'teacher'>('student');

  const [activeView, setActiveView] = useState<
    'home' | 'student_onboarding' | 'practice_session' | 'consent_center' | 'chapter_test' | 'teacher_dashboard'
  >('home');

  useEffect(() => {
    // Apply font settings to document
    if (dyslexicFont) {
      document.body.classList.add('font-dyslexic');
    } else {
      document.body.classList.remove('font-dyslexic');
    }

    if (highContrast) {
      document.body.classList.add('high-contrast');
    } else {
      document.body.classList.remove('high-contrast');
    }

    document.documentElement.style.setProperty('--font-scale', fontScale.toString());
  }, [dyslexicFont, highContrast, fontScale]);

  useEffect(() => {
    // Check backend health status
    fetch('/api/v1/health')
      .then((res) => {
        if (!res.ok) throw new Error('API offline');
        return res.json();
      })
      .then((data: HealthData) => {
        setHealth(data);
        setLoading(false);
      })
      .catch(() => {
        setHealth({
          status: 'ready (dev)',
          environment: 'development',
          version: '0.1.0',
          providers: { llm: 'fake', tts: 'fake', stt: 'fake', video: 'fake' },
          agents: {
            diagnostic: true,
            zpd_hint: true,
            content_gen: true,
            struggle_detection: true,
            consent_trust: true,
            teacher_copilot: true,
          },
        });
        setLoading(false);
      });
  }, []);

  const openAuth = (mode: 'login' | 'register', role: 'student' | 'teacher') => {
    setAuthDefaultMode(mode);
    setAuthDefaultRole(role);
    setIsAuthModalOpen(true);
  };

  return (
    <div>
      {/* Top Accessibility Bar */}
      <nav aria-label="Accessibility settings" className="a11y-toolbar">
        <div>
          <span>Accessibility Options:</span>
        </div>
        <div className="a11y-controls">
          <button
            type="button"
            className={`btn-a11y ${dyslexicFont ? 'active' : ''}`}
            onClick={() => setDyslexicFont(!dyslexicFont)}
            aria-pressed={dyslexicFont}
          >
            {dyslexicFont ? '✓ Dyslexia Font Active' : 'Dyslexia-Friendly Font'}
          </button>

          <button
            type="button"
            className={`btn-a11y ${highContrast ? 'active' : ''}`}
            onClick={() => setHighContrast(!highContrast)}
            aria-pressed={highContrast}
          >
            {highContrast ? '✓ High Contrast Active' : 'High Contrast'}
          </button>

          <button
            type="button"
            className="btn-a11y"
            onClick={() => setFontScale((prev) => Math.max(0.85, Number((prev - 0.1).toFixed(2))))}
            aria-label="Decrease text size"
          >
            A-
          </button>

          <button
            type="button"
            className="btn-a11y"
            onClick={() => setFontScale(1)}
            aria-label="Reset text size"
          >
            Reset Size
          </button>

          <button
            type="button"
            className="btn-a11y"
            onClick={() => setFontScale((prev) => Math.min(1.4, Number((prev + 0.1).toFixed(2))))}
            aria-label="Increase text size"
          >
            A+
          </button>
        </div>
      </nav>

      {/* Main Container */}
      <main className="container">
        {/* Navigation & Header Brand */}
        <header className="header-brand">
          <div
            className="brand-title"
            style={{ cursor: 'pointer' }}
            onClick={() => setActiveView('home')}
          >
            <span>AdaptAI</span>
            <span className="brand-badge">Phase III</span>
          </div>

          <div className="nav-actions">
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginRight: 'var(--space-2)' }}>
              Status:{' '}
              <strong style={{ color: 'var(--primary)' }}>
                {loading ? 'Checking...' : health?.status}
              </strong>
            </div>

            {isAuthenticated && user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span className="user-pill">
                  {user.role === 'teacher' ? '👩‍🏫 Teacher' : '🎓 Student'}: <strong>{user.display_name}</strong>
                </span>
                <button
                  type="button"
                  className="btn-a11y"
                  onClick={logout}
                  style={{ color: 'var(--color-danger-text)' }}
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => openAuth('login', 'student')}
                  style={{ padding: '6px 14px', fontSize: '0.875rem' }}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  className="button-primary"
                  onClick={() => openAuth('register', 'student')}
                  style={{ padding: '6px 14px', fontSize: '0.875rem' }}
                >
                  Register
                </button>
              </div>
            )}
          </div>
        </header>

        {/* View Routing */}
        {activeView === 'student_onboarding' ? (
          <StudentOnboarding onBackToHome={() => setActiveView('home')} />
        ) : activeView === 'practice_session' ? (
          <PracticeSession onBackToHome={() => setActiveView('home')} />
        ) : activeView === 'consent_center' ? (
          <ConsentDecisionCenter onBackToHome={() => setActiveView('home')} />
        ) : activeView === 'chapter_test' ? (
          <TimedChapterTest onBackToHome={() => setActiveView('home')} />
        ) : activeView === 'teacher_dashboard' ? (
          <TeacherDashboard onBackToHome={() => setActiveView('home')} />
        ) : isAuthenticated && user ? (
          /* ================================================================
             AUTHENTICATED ROLE DASHBOARD HUB (When Logged In)
             ================================================================ */
          <div className="dashboard-hub">
            <div className="dashboard-hero-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
                <div>
                  <span className="hero-badge">
                    {user.role === 'teacher' ? '👩‍🏫 Educator Workspace' : '🎓 Student Learning Workspace'}
                  </span>
                  <h1 style={{ fontSize: '2rem', fontWeight: 800, marginTop: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                    Welcome back, {user.display_name}!
                  </h1>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', maxWidth: '640px' }}>
                    {user.role === 'teacher'
                      ? 'Author disability-inclusive curricula, inspect first-attempt course star rankings, and generate AI daily practice problems and chapter tests.'
                      : 'Your personalized learning space with calm pacing, multimodal hints, and transparent consent-first adaptation.'}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  {user.age && <span className="btn-a11y">Age: {user.age}</span>}
                  {user.age_band && <span className="btn-a11y">Age Band: {user.age_band}</span>}
                  {user.disabilities && user.disabilities.length > 0 && (
                    <span className="brand-badge" style={{ padding: '6px 12px' }}>
                      Profile: {user.disabilities[0].label}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Role-Specific Action Grid */}
            {user.role === 'teacher' ? (
              /* TEACHER ACTIONS */
              <div>
                <h2 style={{ fontSize: '1.375rem', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
                  Educator Management Tools
                </h2>
                <div className="dashboard-action-grid">
                  <div className="dashboard-action-card">
                    <div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
                        📊 Course Analytics & Ratings
                      </h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', marginBottom: 'var(--space-6)' }}>
                        View live class engagement, struggle detection alerts, and official 5-star course quality ratings computed strictly on students' first attempts.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="button-primary"
                      onClick={() => setActiveView('teacher_dashboard')}
                    >
                      Open Educator Dashboard →
                    </button>
                  </div>

                  <div className="dashboard-action-card">
                    <div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
                        ➕ Author Course & AI Studio
                      </h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', marginBottom: 'var(--space-6)' }}>
                        Create new courses, add chapters, and use the AI co-pilot to generate aligned Daily Practice Problems (DPP) and chapter tests.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => setActiveView('teacher_dashboard')}
                    >
                      Launch Course Studio →
                    </button>
                  </div>

                  <div className="dashboard-action-card">
                    <div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
                        🧪 Student Experience Preview
                      </h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', marginBottom: 'var(--space-6)' }}>
                        Preview how your DPP questions, ZPD scaffolding, and timed chapter tests appear from a student's perspective.
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() => setActiveView('practice_session')}
                        style={{ flex: 1, padding: '8px' }}
                      >
                        Preview DPP
                      </button>
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() => setActiveView('chapter_test')}
                        style={{ flex: 1, padding: '8px' }}
                      >
                        Preview Test
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* STUDENT ACTIONS */
              <div>
                <h2 style={{ fontSize: '1.375rem', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
                  Your Learning Journey
                </h2>
                <div className="dashboard-action-grid">
                  <div className="dashboard-action-card">
                    <div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
                        🎯 Placement Diagnostic
                      </h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', marginBottom: 'var(--space-6)' }}>
                        Take or retake your adaptive placement test to calibrate your ZPD level and get personalized curriculum recommendations.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="button-primary"
                      onClick={() => setActiveView('student_onboarding')}
                    >
                      Launch Diagnostic →
                    </button>
                  </div>

                  <div className="dashboard-action-card">
                    <div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
                        📚 Interactive Practice & Hints
                      </h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', marginBottom: 'var(--space-6)' }}>
                        Solve Daily Practice Problems (DPP) with real-time text and audio scaffolding, calm pacing, and zero sensory overload.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="button-primary"
                      onClick={() => setActiveView('practice_session')}
                    >
                      Start Practice Session →
                    </button>
                  </div>

                  <div className="dashboard-action-card">
                    <div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
                        ⏱️ Timed Chapter Test
                      </h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', marginBottom: 'var(--space-6)' }}>
                        Complete chapter assessments. Attempt 1 is used for official teacher rating; subsequent attempts are for mastery learning.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => setActiveView('chapter_test')}
                    >
                      Take Chapter Test →
                    </button>
                  </div>

                  <div className="dashboard-action-card">
                    <div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
                        🛡️ Consent & Adaptation Center
                      </h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', marginBottom: 'var(--space-6)' }}>
                        Inspect, accept, or decline proposed learning accommodations in your transparent, immutable consent ledger.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => setActiveView('consent_center')}
                    >
                      Open Consent Ledger →
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ================================================================
             PUBLIC INFORMATIONAL LANDING PAGE (When NOT Logged In)
             ================================================================ */
          <>
            {/* 1. Hero Section */}
            <section className="hero-section" aria-label="Introduction">
              <div>
                <div className="hero-badge">
                  <span>✨</span> Neurodiversity-First Digital Learning Platform
                </div>
                <h1 style={{ fontSize: '2.375rem', fontWeight: 800, lineHeight: 1.25, marginBottom: 'var(--space-4)', color: 'var(--text-primary)' }}>
                  Personalized, AI-Powered Learning Designed for Every Learner's Needs
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1.125rem', lineHeight: 1.6, marginBottom: 'var(--space-6)', maxWidth: '640px' }}>
                  AdaptAI bridges the gap between static IEPs and dynamic digital classrooms. Engineered specifically for students with Autism Spectrum Disorder (ASD), ADHD, Dyslexia, and developmental learning differences.
                </p>

                <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', marginBottom: 'var(--space-6)' }}>
                  <button
                    type="button"
                    className="button-primary"
                    onClick={() => openAuth('register', 'student')}
                    style={{ padding: '12px 24px', fontSize: '1rem' }}
                  >
                    🎓 Student & Parent Sign Up →
                  </button>

                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => openAuth('login', 'teacher')}
                    style={{ padding: '12px 24px', fontSize: '1rem' }}
                  >
                    👩‍🏫 Educator Portal Sign In →
                  </button>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  <span className="btn-a11y">✓ Autism (ASD) Sensory Calm</span>
                  <span className="btn-a11y">✓ ADHD Adaptive Pacing</span>
                  <span className="btn-a11y">✓ Dyslexia Typography & Speech</span>
                  <span className="btn-a11y">✓ Immutable Consent Ledger</span>
                </div>
              </div>

              <div className="hero-visual">
                <img
                  src={heroImg}
                  alt="AdaptAI Adaptive Multi-Layered Learning Platform Illustration"
                  className="hero-img"
                />
              </div>
            </section>

            {/* 2. What is AdaptAI & Core Principles */}
            <section className="section-container">
              <div className="section-header">
                <span className="brand-badge">Our Mission</span>
                <h2 className="section-title">What is AdaptAI?</h2>
                <p className="section-subtitle">
                  Mainstream ed-tech creates rigid, one-size-fits-all digital environments that often cause cognitive overload for neurodivergent learners. AdaptAI is a two-sided platform that unites educator-authored curricula with real-time, disability-aware learning adaptations governed by three core principles:
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-6)' }}>
                <div className="card">
                  <div style={{ fontSize: '1.75rem', marginBottom: 'var(--space-2)' }}>🛡️</div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
                    1. Consent-First Adaptation
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', lineHeight: 1.6 }}>
                    No pedagogical shift, difficulty alteration, or modality change occurs without explicit student or parent approval. All decisions are immutably logged in a transparent Consent Ledger.
                  </p>
                </div>

                <div className="card">
                  <div style={{ fontSize: '1.75rem', marginBottom: 'var(--space-2)' }}>🪜</div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
                    2. ZPD-Based Scaffolding
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', lineHeight: 1.6 }}>
                    Grounded in Vygotsky's Zone of Proximal Development. Guidance gently moves from worked examples to partial conceptual hints to independent practice, preventing premature failure.
                  </p>
                </div>

                <div className="card">
                  <div style={{ fontSize: '1.75rem', marginBottom: 'var(--space-2)' }}>⚡</div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
                    3. Proactive Struggle Detection
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', lineHeight: 1.6 }}>
                    Telemetry monitors dwell latency, option hesitation, and answer flipping to predict struggle early. Calm micro-interventions are offered before frustration or sensory overload sets in.
                  </p>
                </div>
              </div>
            </section>

            {/* 3. How It Works (4-Step Workflow) */}
            <section className="section-container">
              <div className="section-header">
                <span className="brand-badge">Workflow</span>
                <h2 className="section-title">How AdaptAI Works</h2>
                <p className="section-subtitle">
                  From initial onboarding to master tests, AdaptAI guides learners and educators through a continuous, adaptive cycle.
                </p>
              </div>

              <div className="steps-grid">
                <div className="step-card">
                  <div className="step-number">1</div>
                  <h3>Learning Profile & Diagnostic</h3>
                  <p>
                    Students declare their primary learning profile (ASD, ADHD, Dyslexia) and complete an age-appropriate diagnostic to determine optimal placement.
                  </p>
                </div>

                <div className="step-card">
                  <div className="step-number">2</div>
                  <h3>Daily Practice (DPP) with AI Hints</h3>
                  <p>
                    Students practice daily problems with disability-aware hints available as simplified text or spoken audio narration to avoid reading fatigue.
                  </p>
                </div>

                <div className="step-card">
                  <div className="step-number">3</div>
                  <h3>Server-Timed Chapter Tests</h3>
                  <p>
                    Students take timed tests. Attempt 1 is used for official teacher evaluation; subsequent attempts are encouraged for mastery learning.
                  </p>
                </div>

                <div className="step-card">
                  <div className="step-number">4</div>
                  <h3>Consent & Teacher Analytics</h3>
                  <p>
                    Proposed accommodations are reviewed by the learner, while educators inspect class mastery analytics and first-attempt star rankings.
                  </p>
                </div>
              </div>
            </section>

            {/* 4. For Whom? (Dedicated Portals) */}
            <section className="section-container">
              <div className="section-header">
                <span className="brand-badge">Tailored Support</span>
                <h2 className="section-title">Who is AdaptAI Built For?</h2>
                <p className="section-subtitle">
                  A dual-sided ecosystem engineered for specially-abled learners and dedicated educators.
                </p>
              </div>

              <div className="audience-grid">
                {/* Students & Parents */}
                <div className="audience-card student-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                    <span style={{ fontSize: '1.5rem' }}>🎓</span>
                    <h3>For Students & Parents</h3>
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', marginBottom: 'var(--space-6)' }}>
                    A stress-free digital study environment with accommodations customized to how your brain learns best.
                  </p>

                  <div className="audience-item">
                    <span className="audience-icon">🧩</span>
                    <div>
                      <strong>Autism Spectrum (ASD):</strong> Predictable UI patterns, sensory-gentle palettes, and proactive calm breaks.
                    </div>
                  </div>

                  <div className="audience-item">
                    <span className="audience-icon">⚡</span>
                    <div>
                      <strong>ADHD:</strong> Structured chunking, micro-milestones, and gentle focus nudges without distracting banners.
                    </div>
                  </div>

                  <div className="audience-item">
                    <span className="audience-icon">📖</span>
                    <div>
                      <strong>Dyslexia:</strong> High-legibility Lexend typography, letter-spacing adjustments, and spoken audio hints.
                    </div>
                  </div>

                  <div className="audience-item">
                    <span className="audience-icon">🛡️</span>
                    <div>
                      <strong>Consent Control:</strong> Students and parents have complete oversight over all AI adaptations.
                    </div>
                  </div>
                </div>

                {/* Teachers & Educators */}
                <div className="audience-card teacher-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                    <span style={{ fontSize: '1.5rem' }}>👩‍🏫</span>
                    <h3>For Teachers & Educators</h3>
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', marginBottom: 'var(--space-6)' }}>
                    Empowering teachers with scalable course authoring, generative AI assistance, and transparent learning analytics.
                  </p>

                  <div className="audience-item">
                    <span className="audience-icon">📚</span>
                    <div>
                      <strong>Curriculum Studio:</strong> Author structured courses by subject and age bands (7–10, 11–15, 15–20).
                    </div>
                  </div>

                  <div className="audience-item">
                    <span className="audience-icon">✨</span>
                    <div>
                      <strong>AI Co-Pilot Generator:</strong> Automatically generate aligned DPPs and chapter tests from concept prompts.
                    </div>
                  </div>

                  <div className="audience-item">
                    <span className="audience-icon">★</span>
                    <div>
                      <strong>First-Attempt 5-Star Ratings:</strong> Course quality ratings computed strictly on students' first test attempts.
                    </div>
                  </div>

                  <div className="audience-item">
                    <span className="audience-icon">📊</span>
                    <div>
                      <strong>Cognitive Struggle Alerts:</strong> Identify which students are struggling with specific concepts in real time.
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* 5. Dual Portal Access & Login Section */}
            <section className="auth-access-section" aria-label="Portal Login & Access">
              <div style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto' }}>
                <span className="brand-badge">Get Started</span>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                  Ready to Experience AdaptAI?
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>
                  Choose your portal below to sign in or create an account in seconds.
                </p>
              </div>

              <div className="auth-access-grid">
                {/* Student Login Card */}
                <div className="auth-access-card">
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>🎓 Student & Parent Portal</h3>
                      <span className="brand-badge">Learners</span>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', marginBottom: 'var(--space-6)' }}>
                      Access your placement diagnostic, daily practice problems, spoken audio hints, and consent ledger.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <button
                      type="button"
                      className="button-primary"
                      onClick={() => openAuth('login', 'student')}
                      style={{ flex: 1, padding: '10px' }}
                    >
                      Sign In →
                    </button>
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => openAuth('register', 'student')}
                      style={{ flex: 1, padding: '10px' }}
                    >
                      New Student? Register
                    </button>
                  </div>
                </div>

                {/* Teacher Login Card */}
                <div className="auth-access-card">
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>👩‍🏫 Educator Studio</h3>
                      <span className="brand-badge" style={{ background: '#e0e7ff', color: '#4338ca' }}>
                        Teachers
                      </span>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', marginBottom: 'var(--space-6)' }}>
                      Manage curriculum courses, generate AI daily practice problems, and inspect class mastery analytics.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <button
                      type="button"
                      className="button-primary"
                      onClick={() => openAuth('login', 'teacher')}
                      style={{ flex: 1, padding: '10px', backgroundColor: '#4f46e5' }}
                    >
                      Teacher Sign In →
                    </button>
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => openAuth('register', 'teacher')}
                      style={{ flex: 1, padding: '10px' }}
                    >
                      New Educator? Register
                    </button>
                  </div>
                </div>
              </div>

              {/* Demo / Guest Preview Access */}
              <div style={{ marginTop: 'var(--space-8)', textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                <span>Testing without an account? </span>
                <button
                  type="button"
                  onClick={() => setActiveView('practice_session')}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Preview Practice Mode
                </button>
                <span> · </span>
                <button
                  type="button"
                  onClick={() => setActiveView('teacher_dashboard')}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Preview Teacher Analytics
                </button>
              </div>
            </section>

            {/* 6. Architectural Guarantees & Active Providers */}
            <section className="card" style={{ marginTop: 'var(--space-8)' }}>
              <h3 style={{ fontSize: '1.125rem', marginBottom: 'var(--space-4)', color: 'var(--text-primary)' }}>
                Architectural Guarantees & Active Provider Seams
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', fontSize: '0.875rem' }}>
                <div>
                  <strong>LLM Provider:</strong> {health?.providers?.llm || 'fake'}
                </div>
                <div>
                  <strong>Speech Modality (TTS/STT):</strong> {health?.providers?.tts || 'fake'} / {health?.providers?.stt || 'fake'}
                </div>
                <div>
                  <strong>Video Store:</strong> {health?.providers?.video || 'fake'}
                </div>
                <div>
                  <strong>Priority Engine Order:</strong> Safety &gt; Consent &gt; Pedagogy &gt; Nudges
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      {/* Global Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        defaultMode={authDefaultMode}
        defaultRole={authDefaultRole}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
