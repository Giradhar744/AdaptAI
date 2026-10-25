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
        ) : (
          <>
            {/* Redesigned Hero Section with hero.png */}
            <section className="hero-section" aria-label="Introduction">
              <div>
                <div className="hero-badge">
                  <span>✨</span> Neurodiversity-First Educational Platform
                </div>
                <h1 style={{ fontSize: '2.25rem', fontWeight: 800, lineHeight: 1.25, marginBottom: 'var(--space-4)', color: 'var(--text-primary)' }}>
                  Accessible, Adaptive Learning Tailored to Every Student's Unique Needs
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1.0625rem', lineHeight: 1.6, marginBottom: 'var(--space-6)', maxWidth: '640px' }}>
                  Engineered specifically for learners with Autism Spectrum Disorder (ASD), ADHD, Dyslexia, and developmental learning differences. Featuring consent-first adaptation, calm ZPD scaffolding, and real-time educator analytics.
                </p>

                <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', marginBottom: 'var(--space-6)' }}>
                  <button
                    type="button"
                    className="button-primary"
                    onClick={() => {
                      if (!isAuthenticated) openAuth('login', 'student');
                      else setActiveView('student_onboarding');
                    }}
                    style={{ padding: '12px 24px', fontSize: '1rem' }}
                  >
                    🎓 Enter Student Portal →
                  </button>

                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => {
                      if (!isAuthenticated) openAuth('login', 'teacher');
                      else setActiveView('teacher_dashboard');
                    }}
                    style={{ padding: '12px 24px', fontSize: '1rem' }}
                  >
                    👩‍🏫 Teacher & Educator Studio →
                  </button>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  <span className="btn-a11y">✓ Autism (ASD) Gentle Sensory</span>
                  <span className="btn-a11y">✓ ADHD Calm Pacing</span>
                  <span className="btn-a11y">✓ Dyslexia-Friendly Typography</span>
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

            {/* Portal Entry Cards */}
            <section className="portal-grid" aria-label="Portal Navigation">
              {/* Student Card */}
              <article className="portal-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                  <h2>Student & Parent Learning Portal</h2>
                  <span className="brand-badge">Learners</span>
                </div>
                <p>
                  Complete a guided onboarding diagnostic, explore age-appropriate courses, practice with
                  calm hints, and attempt timed chapter tests with mastery re-attempt protection.
                </p>
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="button-primary"
                    id="btn-student-portal"
                    onClick={() => setActiveView('student_onboarding')}
                  >
                    Onboarding Diagnostic →
                  </button>
                  <button
                    type="button"
                    className="button-secondary"
                    id="btn-practice-portal"
                    onClick={() => setActiveView('practice_session')}
                  >
                    Interactive Practice & Hints →
                  </button>
                  <button
                    type="button"
                    className="button-secondary"
                    id="btn-test-portal"
                    onClick={() => setActiveView('chapter_test')}
                  >
                    Timed Chapter Test →
                  </button>
                  <button
                    type="button"
                    className="button-secondary"
                    id="btn-consent-portal"
                    onClick={() => setActiveView('consent_center')}
                  >
                    Consent & Adaptation Center →
                  </button>
                </div>
              </article>

              {/* Teacher Card */}
              <article className="portal-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                  <h2>Teacher & Educator Portal</h2>
                  <span className="brand-badge" style={{ background: '#e0e7ff', color: '#4338ca' }}>
                    Educators
                  </span>
                </div>
                <p>
                  Author structured subject courses, add curriculum chapters, generate Daily Practice Problems (DPP)
                  with AI co-pilot, and inspect first-attempt star ratings and class mastery analytics.
                </p>
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="button-primary"
                    id="btn-teacher-portal"
                    onClick={() => setActiveView('teacher_dashboard')}
                  >
                    Enter Teacher Dashboard →
                  </button>
                  {!isAuthenticated && (
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => openAuth('login', 'teacher')}
                    >
                      Teacher Sign In →
                    </button>
                  )}
                </div>
              </article>
            </section>

            {/* Platform Architectural Seams Overview */}
            <section className="card" style={{ marginTop: 'var(--space-8)' }}>
              <h3 style={{ fontSize: '1.125rem', marginBottom: 'var(--space-4)', color: 'var(--text-primary)' }}>
                Architectural Guarantees & Active Providers
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
                  <strong>Priority Order:</strong> Safety &gt; Consent &gt; Pedagogy &gt; Nudges
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
