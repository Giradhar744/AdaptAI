import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthModal } from './components/AuthModal';
import StudentOnboarding from './features/student/StudentOnboarding';
import PracticeSession from './features/student/PracticeSession';
import ConsentDecisionCenter from './features/student/ConsentDecisionCenter';
import TimedChapterTest from './features/student/TimedChapterTest';
import StudentDashboard from './features/student/StudentDashboard';
import CourseStudyRoom from './features/student/CourseStudyRoom';
import TeacherDashboard from './features/teacher/TeacherDashboard';
import { TeacherCoursesManager } from './features/teacher/TeacherCoursesManager';
import { CourseAuthoringModal } from './features/teacher/CourseAuthoringModal';
import heroImg from './assets/hero.png';

interface HealthData {
  status: string;
  environment: string;
  version: string;
  providers: Record<string, string>;
  agents: Record<string, boolean>;
}

export type AppView =
  | 'home'
  | 'student_onboarding'
  | 'practice_session'
  | 'consent_center'
  | 'chapter_test'
  | 'teacher_dashboard'
  | 'course_room';

const VALID_VIEWS: AppView[] = [
  'home',
  'student_onboarding',
  'practice_session',
  'consent_center',
  'chapter_test',
  'teacher_dashboard',
  'course_room',
];

const AppContent: React.FC = () => {
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  const [dyslexicFont, setDyslexicFont] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [fontScale, setFontScale] = useState(1);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  // Active study context
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [activeDppId, setActiveDppId] = useState<string | null>(null);
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [activeChapterTitle, setActiveChapterTitle] = useState<string | null>(null);
  const [activeCourseTitle, setActiveCourseTitle] = useState<string | null>(null);
  const [activeTestId, setActiveTestId] = useState<string | null>(null);
  const [isTeacherAuthoringOpen, setIsTeacherAuthoringOpen] = useState(false);

  // Auth modal state
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authDefaultMode, setAuthDefaultMode] = useState<'login' | 'register'>('login');
  const [authDefaultRole, setAuthDefaultRole] = useState<'student' | 'teacher'>('student');

  const getInitialView = (): AppView => {
    const hash = window.location.hash.replace(/^#\/?/, '').trim();
    if (VALID_VIEWS.includes(hash as AppView)) {
      return hash as AppView;
    }
    const saved = sessionStorage.getItem('adaptai_active_view');
    if (saved && VALID_VIEWS.includes(saved as AppView)) {
      return saved as AppView;
    }
    return 'home';
  };

  const [activeView, setActiveView] = useState<AppView>(getInitialView);

  // Sync state when browser Back or Forward button is clicked
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#\/?/, '').trim();
      const nextView: AppView = VALID_VIEWS.includes(hash as AppView) ? (hash as AppView) : 'home';
      setActiveView(nextView);
      sessionStorage.setItem('adaptai_active_view', nextView);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateTo = (view: AppView, replace = false) => {
    sessionStorage.setItem('adaptai_active_view', view);
    setActiveView(view);
    const targetHash = view === 'home' ? '' : `#${view}`;
    const currentHash = window.location.hash;
    if (currentHash !== targetHash && (currentHash !== '' || targetHash !== '')) {
      if (replace) {
        window.location.replace(targetHash || window.location.pathname);
      } else {
        window.location.hash = targetHash;
      }
    }
  };

  const handleBack = () => {
    if (window.history.length > 1 && window.location.hash && window.location.hash !== '#home' && window.location.hash !== '#') {
      window.history.back();
    } else {
      navigateTo('home');
    }
  };

  const handleLogout = () => {
    logout();
    navigateTo('home', true);
  };

  useEffect(() => {
    // Apply accessibility settings to document body
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
          providers: { llm: 'fast', tts: 'browser-speech', stt: 'browser-stt', video: 'direct' },
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
      <nav aria-label="Accessibility options" className="a11y-toolbar">
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
            onClick={() => navigateTo('home')}
          >
            <span>AdaptAI</span>
            <span className="brand-badge">Learning Hub</span>
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
                  onClick={handleLogout}
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

        {/* Breadcrumb & Quick Back Navigation for sub-views */}
        {activeView !== 'home' && (
          <nav
            aria-label="Breadcrumb navigation"
            style={{
              marginBottom: 'var(--space-4)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
            }}
          >
            <button
              type="button"
              className="btn-a11y"
              onClick={handleBack}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              <span aria-hidden="true">←</span> Back to Dashboard
            </button>
            <span style={{ color: 'var(--text-secondary)' }}>/</span>
            <span
              style={{
                fontSize: '0.875rem',
                color: 'var(--text-secondary)',
                textTransform: 'capitalize',
              }}
            >
              {activeView.replace(/_/g, ' ')}
            </span>
          </nav>
        )}

        {/* View Routing */}
        {isLoading && !user ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-12) var(--space-4)' }}>
            <div className="brand-badge" style={{ display: 'inline-block', marginBottom: 'var(--space-3)' }}>
              Restoring Session...
            </div>
            <p style={{ color: 'var(--text-secondary)' }}>
              Connecting securely to your AdaptAI learning space...
            </p>
          </div>
        ) : activeView === 'student_onboarding' ? (
          <StudentOnboarding onBackToHome={handleBack} />
        ) : activeView === 'practice_session' ? (
          <PracticeSession
            dppId={activeDppId || undefined}
            chapterId={activeChapterId || undefined}
            chapterTitle={activeChapterTitle || undefined}
            courseTitle={activeCourseTitle || undefined}
            studentId={user?.student_id || undefined}
            disabilityType={user?.disabilities?.[0]?.code || 'dyslexia'}
            onBackToHome={handleBack}
          />
        ) : activeView === 'consent_center' ? (
          <ConsentDecisionCenter onBackToHome={handleBack} />
        ) : activeView === 'chapter_test' ? (
          <TimedChapterTest
            testId={activeTestId || undefined}
            chapterTitle={activeChapterTitle || undefined}
            courseTitle={activeCourseTitle || undefined}
            studentId={user?.student_id || undefined}
            onBackToHome={handleBack}
          />
        ) : activeView === 'course_room' && activeCourseId ? (
          <CourseStudyRoom
            courseId={activeCourseId}
            onBackToCourses={() => navigateTo('home')}
            onLaunchPractice={(dppId, chapterId, chapterTitle, courseTitle) => {
              setActiveDppId(dppId || null);
              setActiveChapterId(chapterId || null);
              setActiveChapterTitle(chapterTitle || null);
              setActiveCourseTitle(courseTitle || null);
              navigateTo('practice_session');
            }}
            onLaunchTest={(testId, chapterTitle, courseTitle) => {
              setActiveTestId(testId || null);
              setActiveChapterTitle(chapterTitle || null);
              setActiveCourseTitle(courseTitle || null);
              navigateTo('chapter_test');
            }}
          />
        ) : activeView === 'teacher_dashboard' ? (
          <TeacherDashboard courseId={activeCourseId || undefined} onBackToHome={handleBack} />
        ) : isAuthenticated && user ? (
          /* ================================================================
             AUTHENTICATED ROLE DASHBOARD HUB (When Logged In)
             ================================================================ */
          <div className="dashboard-hub">
            <div className="dashboard-hero-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
                <div>
                  <span className="hero-badge">
                    {user.role === 'teacher' ? '👩‍🏫 Teacher Workspace' : '🎓 Student Learning Workspace'}
                  </span>
                  <h1 style={{ fontSize: '2rem', fontWeight: 800, marginTop: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                    Welcome back, {user.display_name}!
                  </h1>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', maxWidth: '640px' }}>
                    {user.role === 'teacher'
                      ? 'Create courses, view student test progress, and use AI to generate practice questions and chapter tests.'
                      : 'Your friendly learning space with calm pacing, helpful speech hints, and courses picked just for you.'}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  {user.age && <span className="btn-a11y">Age: {user.age}</span>}
                  {user.age_band && <span className="btn-a11y">Age Group: {user.age_band}</span>}
                  {user.disabilities && user.disabilities.length > 0 && (
                    <span className="brand-badge" style={{ padding: '6px 12px' }}>
                      Learning Style: {user.disabilities[0].label}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Role-Specific Views */}
            {user.role === 'teacher' ? (
              /* TEACHER DASHBOARD HUB */
              <div>
                <h2 style={{ fontSize: '1.375rem', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
                  Teaching & Course Management Tools
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                  <div className="dashboard-action-card">
                    <div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
                        📊 Student Analytics & Course Ratings
                      </h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', marginBottom: 'var(--space-6)' }}>
                        See student scores, identify anyone needing extra support, and view 5-star course quality ratings based on students' first test attempts.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="button-primary"
                      onClick={() => navigateTo('teacher_dashboard')}
                    >
                      Open Teacher Dashboard →
                    </button>
                  </div>

                  <div className="dashboard-action-card">
                    <div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
                        ➕ Create Course & AI Studio
                      </h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', marginBottom: 'var(--space-6)' }}>
                        Create structured courses with chapters and lesson videos. Use the AI generator to create aligned 4-choice practice questions and chapter tests.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => setIsTeacherAuthoringOpen(true)}
                    >
                      Create New Course →
                    </button>
                  </div>
                </div>

                {/* All Courses & Subject Management Section */}
                <TeacherCoursesManager
                  onLaunchPractice={(dppId, chapterId, chapterTitle, courseTitle) => {
                    setActiveDppId(dppId || null);
                    setActiveChapterId(chapterId || null);
                    setActiveChapterTitle(chapterTitle || null);
                    setActiveCourseTitle(courseTitle || null);
                    navigateTo('practice_session');
                  }}
                  onOpenCreateCourse={() => setIsTeacherAuthoringOpen(true)}
                  onOpenAnalytics={(courseId) => {
                    setActiveCourseId(courseId);
                    navigateTo('teacher_dashboard');
                  }}
                />

                {/* Course Authoring Modal */}
                <CourseAuthoringModal
                  isOpen={isTeacherAuthoringOpen}
                  onClose={() => setIsTeacherAuthoringOpen(false)}
                  onCourseCreated={(newCourseId) => {
                    setActiveCourseId(newCourseId);
                    setIsTeacherAuthoringOpen(false);
                  }}
                />
              </div>
            ) : (
              /* STUDENT DASHBOARD: Explore Courses, My Courses, My Profile */
              <StudentDashboard
                onEnterCourse={(courseId) => {
                  setActiveCourseId(courseId);
                  navigateTo('course_room');
                }}
                onLaunchDiagnostic={() => navigateTo('student_onboarding')}
                onOpenConsentCenter={() => navigateTo('consent_center')}
              />
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
                  <span>✨</span> Thoughtful AI-Powered Learning for Every Learner
                </div>
                <h1 style={{ fontSize: '2.375rem', fontWeight: 800, lineHeight: 1.25, marginBottom: 'var(--space-4)', color: 'var(--text-primary)' }}>
                  Personalized, AI-Powered Learning Designed for Every Learner's Needs
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1.125rem', lineHeight: 1.6, marginBottom: 'var(--space-6)', maxWidth: '640px' }}>
                  AdaptAI gives students a calm, friendly place to learn with courses created by real teachers. Specially designed for learners with Dyslexia, ADHD, Autism, and unique learning paces.
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
                    👩‍🏫 Teacher Sign In →
                  </button>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  <span className="btn-a11y">✓ Calm, Sensory-Friendly Colors</span>
                  <span className="btn-a11y">✓ Spoken Audio & Text Hints</span>
                  <span className="btn-a11y">✓ Dyslexia-Friendly Fonts</span>
                  <span className="btn-a11y">✓ Clear Privacy & Control</span>
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
                <h2 className="section-title">What Makes AdaptAI Different?</h2>
                <p className="section-subtitle">
                  Traditional learning websites can feel overwhelming and fast-paced. AdaptAI provides calm pacing, clear choices, and helpful hints designed to help every learner succeed:
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-6)' }}>
                <div className="card">
                  <div style={{ fontSize: '1.75rem', marginBottom: 'var(--space-2)' }}>🛡️</div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
                    1. You Are Always in Control
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', lineHeight: 1.6 }}>
                    No sudden surprises. We never change your learning pace, font, or hints without your clear approval. You and your parents can review every accommodation anytime.
                  </p>
                </div>

                <div className="card">
                  <div style={{ fontSize: '1.75rem', marginBottom: 'var(--space-2)' }}>🪜</div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
                    2. Step-by-Step Learning
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', lineHeight: 1.6 }}>
                    Instead of feeling stuck on difficult problems, the app gives you gentle hints—first simple clues, then worked examples, so you build real confidence.
                  </p>
                </div>

                <div className="card">
                  <div style={{ fontSize: '1.75rem', marginBottom: 'var(--space-2)' }}>⚡</div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
                    3. Helpful Hints in Audio & Text
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', lineHeight: 1.6 }}>
                    Listen to hints read aloud with natural speech, or read simplified bullet points. Designed to prevent reading fatigue and help you focus on learning.
                  </p>
                </div>
              </div>
            </section>

            {/* 3. How It Works (4-Step Workflow) */}
            <section className="section-container">
              <div className="section-header">
                <span className="brand-badge">Easy Workflow</span>
                <h2 className="section-title">How AdaptAI Works</h2>
                <p className="section-subtitle">
                  Simple, straightforward steps from finding a course to mastering new skills.
                </p>
              </div>

              <div className="steps-grid">
                <div className="step-card">
                  <div className="step-number">1</div>
                  <h3>Quick Placement Test</h3>
                  <p>
                    Take a fun, 5-question placement check so we can recommend courses and lessons suited to your exact level.
                  </p>
                </div>

                <div className="step-card">
                  <div className="step-number">2</div>
                  <h3>Watch Video Lessons</h3>
                  <p>
                    Watch bite-sized lesson videos recorded by teachers and mark each lesson done when you are ready.
                  </p>
                </div>

                <div className="step-card">
                  <div className="step-number">3</div>
                  <h3>Daily Practice with Audio Hints</h3>
                  <p>
                    Solve 3-choice practice questions with instant spoken audio clues and clear explanations whenever you need assistance.
                  </p>
                </div>

                <div className="step-card">
                  <div className="step-number">4</div>
                  <h3>Show Your Mastery</h3>
                  <p>
                    Take chapter tests to celebrate how much you've learned. Retake practice anytime to improve your score!
                  </p>
                </div>
              </div>
            </section>

            {/* 4. For Whom? */}
            <section className="section-container">
              <div className="section-header">
                <span className="brand-badge">Made For You</span>
                <h2 className="section-title">Built for Learners and Teachers</h2>
                <p className="section-subtitle">
                  A dual space designed for specially-abled students and dedicated educators.
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
                    A stress-free study space with accommodations that match how your brain learns best.
                  </p>

                  <div className="audience-item">
                    <span className="audience-icon">🧩</span>
                    <div>
                      <strong>Autism (ASD):</strong> Calming colors, predictable screens, and relaxing focus breaks.
                    </div>
                  </div>

                  <div className="audience-item">
                    <span className="audience-icon">⚡</span>
                    <div>
                      <strong>ADHD:</strong> Short lessons, clear steps, and gentle encouragement without distracting popups.
                    </div>
                  </div>

                  <div className="audience-item">
                    <span className="audience-icon">📖</span>
                    <div>
                      <strong>Dyslexia:</strong> High-legibility dyslexia fonts, generous line spacing, and spoken audio hints.
                    </div>
                  </div>

                  <div className="audience-item">
                    <span className="audience-icon">🛡️</span>
                    <div>
                      <strong>Clear Privacy:</strong> Full control over all learning aids and settings.
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
                    Empowering teachers with easy course creation, AI-assisted practice problems, and clear student progress.
                  </p>

                  <div className="audience-item">
                    <span className="audience-icon">📚</span>
                    <div>
                      <strong>Course Studio:</strong> Create structured courses organized by age groups (7–10, 11–15, 15–20).
                    </div>
                  </div>

                  <div className="audience-item">
                    <span className="audience-icon">✨</span>
                    <div>
                      <strong>AI Question Generator:</strong> Automatically create 3-choice practice questions and tests from concept notes.
                    </div>
                  </div>

                  <div className="audience-item">
                    <span className="audience-icon">★</span>
                    <div>
                      <strong>5-Star Course Ratings:</strong> Transparent ratings based fairly on students' first test attempts.
                    </div>
                  </div>

                  <div className="audience-item">
                    <span className="audience-icon">📊</span>
                    <div>
                      <strong>Student Support Alerts:</strong> Quickly see which students might need a little extra one-on-one help.
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
                  Ready to Start Learning?
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>
                  Choose your portal below to sign in or create your account in seconds.
                </p>
              </div>

              <div className="auth-access-grid">
                {/* Student Login Card */}
                <div className="auth-access-card">
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>🎓 Student & Parent Portal</h3>
                      <span className="brand-badge">Students</span>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', marginBottom: 'var(--space-6)' }}>
                      Access your placement test, enrolled courses, daily practice with spoken hints, and profile.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <button
                      type="button"
                      className="button-primary"
                      onClick={() => openAuth('login', 'student')}
                      style={{ flex: 1, padding: '10px' }}
                    >
                      Student Sign In →
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
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>👩‍🏫 Teacher Workspace</h3>
                      <span className="brand-badge" style={{ background: '#e0e7ff', color: '#4338ca' }}>
                        Teachers
                      </span>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', marginBottom: 'var(--space-6)' }}>
                      Manage your courses, generate AI daily practice problems, and see how your students are doing.
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
                      New Teacher? Register
                    </button>
                  </div>
                </div>
              </div>

              {/* Demo / Guest Preview Access */}
              <div style={{ marginTop: 'var(--space-8)', textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                <span>Testing without an account? </span>
                <button
                  type="button"
                  onClick={() => navigateTo('practice_session')}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Preview Practice Mode
                </button>
                <span> · </span>
                <button
                  type="button"
                  onClick={() => navigateTo('teacher_dashboard')}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Preview Teacher Analytics
                </button>
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
