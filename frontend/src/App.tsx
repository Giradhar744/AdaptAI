import React, { useState, useEffect } from 'react';
import StudentOnboarding from './features/student/StudentOnboarding';
import PracticeSession from './features/student/PracticeSession';
import ConsentDecisionCenter from './features/student/ConsentDecisionCenter';
import TimedChapterTest from './features/student/TimedChapterTest';
import TeacherDashboard from './features/teacher/TeacherDashboard';

interface HealthData {
  status: string;
  environment: string;
  version: string;
  providers: Record<string, string>;
  agents: Record<string, boolean>;
}

export const App: React.FC = () => {
  const [dyslexicFont, setDyslexicFont] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [fontScale, setFontScale] = useState(1);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
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
        <header className="header-brand">
          <div
            className="brand-title"
            style={{ cursor: 'pointer' }}
            onClick={() => setActiveView('home')}
          >
            <span>AdaptAI</span>
            <span className="brand-badge">Phase III</span>
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            System Status:{' '}
            <strong style={{ color: 'var(--primary)' }}>
              {loading ? 'Checking...' : health?.status}
            </strong>
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
            <section style={{ marginTop: 'var(--space-8)' }}>
              <h1 style={{ fontSize: '1.875rem', fontWeight: 800, marginBottom: 'var(--space-2)' }}>
                Disability-Inclusive Educational Learning Platform
              </h1>
              <p style={{ color: 'var(--text-secondary)', maxWidth: '720px', fontSize: '1.0625rem' }}>
                A consent-first learning space tailored for neurodivergent and specially-abled students,
                featuring proactive ZPD scaffolding, multimodal hints, and educator analytics.
              </p>
            </section>

            {/* Portal Entry Cards */}
            <section className="portal-grid" aria-label="Portal Navigation">
              <article className="portal-card">
                <h2>Student & Parent Learning Portal</h2>
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

              <article className="portal-card">
                <h2>Teacher & Educator Portal</h2>
                <p>
                  Author structured subject courses, upload video lessons, generate Daily Practice Problems (DPP)
                  with AI co-pilot, and inspect first-attempt star ratings and class mastery analytics.
                </p>
                <button
                  type="button"
                  className="button-primary"
                  id="btn-teacher-portal"
                  onClick={() => setActiveView('teacher_dashboard')}
                >
                  Enter Teacher Dashboard →
                </button>
              </article>
            </section>

            {/* Platform Architectural Seams Overview */}
            <section className="card" style={{ marginTop: 'var(--space-8)' }}>
              <h3 style={{ fontSize: '1.125rem', marginBottom: 'var(--space-4)', color: 'var(--text-primary)' }}>
                Architectural Guarantees & Active Providers
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', fontSize: '0.875rem' }}>
                <div>
                  <strong>LLM Provider:</strong> {health?.providers.llm || 'fake'}
                </div>
                <div>
                  <strong>Speech Modality (TTS/STT):</strong> {health?.providers.tts || 'fake'} / {health?.providers.stt || 'fake'}
                </div>
                <div>
                  <strong>Video Store:</strong> {health?.providers.video || 'fake'}
                </div>
                <div>
                  <strong>Priority Order:</strong> Safety &gt; Consent &gt; Pedagogy &gt; Nudges
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
};

export default App;
