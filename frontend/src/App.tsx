import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthModal } from './components/AuthModal';
import { LoadingScreen } from './components/LoadingScreen';
import StudentOnboarding from './features/student/StudentOnboarding';
import PracticeSession from './features/student/PracticeSession';
import TimedChapterTest from './features/student/TimedChapterTest';
import StudentDashboard from './features/student/StudentDashboard';
import CourseStudyRoom from './features/student/CourseStudyRoom';
import { StudentProfilePage } from './features/student/StudentProfilePage';
import TeacherDashboard from './features/teacher/TeacherDashboard';
import { TeacherCoursesManager } from './features/teacher/TeacherCoursesManager';
import { CourseAuthoringModal } from './features/teacher/CourseAuthoringModal';
import heroImg from './assets/hero_learning.jpg';
import brandLogo from './assets/brand_logo.png';
import heroStudentImg from './assets/hero_student.png';

export type AppView =
  | 'home'
  | 'profile'
  | 'student_onboarding'
  | 'practice_session'
  | 'chapter_test'
  | 'teacher_dashboard'
  | 'course_room';

const VALID_VIEWS: AppView[] = [
  'home',
  'profile',
  'student_onboarding',
  'practice_session',
  'chapter_test',
  'teacher_dashboard',
  'course_room',
];

const AppContent: React.FC = () => {
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  const [dyslexicFont, setDyslexicFont] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [fontScale, setFontScale] = useState(1);

  // Active study context
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [activeDppId, setActiveDppId] = useState<string | null>(null);
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [activeChapterTitle, setActiveChapterTitle] = useState<string | null>(null);
  const [activeCourseTitle, setActiveCourseTitle] = useState<string | null>(null);
  const [activeTestId, setActiveTestId] = useState<string | null>(null);
  const [isTeacherAuthoringOpen, setIsTeacherAuthoringOpen] = useState(false);
  const [teacherRefreshTrigger, setTeacherRefreshTrigger] = useState(0);
  const [authoringAgeBand, setAuthoringAgeBand] = useState<string>('11-15');
  const [teacherTargetAgeBand, setTeacherTargetAgeBand] = useState<string | undefined>(undefined);

  // Auth modal state
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authDefaultMode, setAuthDefaultMode] = useState<'login' | 'register'>('login');
  const [authDefaultRole, setAuthDefaultRole] = useState<'student' | 'teacher'>('student');
  const [pendingAutoStartTest, setPendingAutoStartTest] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);

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

  const handleOpenProfile = () => {
    navigateTo('profile');
  };

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


  const openAuth = (mode: 'login' | 'register', role: 'student' | 'teacher') => {
    setAuthDefaultMode(mode);
    setAuthDefaultRole(role);
    setIsAuthModalOpen(true);
  };

  return (
    <div>
      {/* Unified Top Header Strip covering all top space */}
      <header className="site-header">
        <div className="container header-inner">
          {/* Left: Brand Logo & Hub Badge */}
          <div
            className="brand-title"
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
            onClick={() => navigateTo('home')}
          >
            <img
              src={brandLogo}
              alt="AdaptAI Logo"
              style={{
                height: '32px',
                width: 'auto',
                objectFit: 'contain',
                display: 'block',
              }}
            />
            <span style={{ fontSize: '1.625rem', fontWeight: 800, color: '#1e1b4b', letterSpacing: '-0.02em', lineHeight: 1 }}>
              AdaptAI
            </span>
            <span className="brand-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#e6f7f2', color: '#0f766e', fontWeight: 600, padding: '4px 12px', borderRadius: '9999px', fontSize: '0.8125rem' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
              Learning Hub
            </span>
          </div>

          {/* Right: Stacked Accessibility Tabs directly above Profile Section */}
          <div className="header-right-stacked">
            {/* Row 1: Dyslexia Font, High Contrast, A-, Reset Size, A+ */}
            <nav aria-label="Accessibility options" className="header-a11y-row">
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
            </nav>

            {/* Row 2: Notification Bell + My Profile Pill */}
            <div className="header-user-row">
              {isAuthenticated && user ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {/* Notification Icon Button with Dropdown */}
                  <div ref={notifRef} style={{ position: 'relative' }}>
                    <button
                      type="button"
                      onClick={() => setShowNotifications((prev) => !prev)}
                      aria-label="View notifications"
                      title="Notifications"
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        background: showNotifications ? '#f1f5f9' : 'var(--bg-surface-elevated, #ffffff)',
                        border: '1.5px solid var(--border-subtle, #e2e8f0)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: '1.125rem',
                        color: 'var(--text-secondary, #475569)',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                        transition: 'all 0.15s ease',
                        position: 'relative',
                      }}
                    >
                      <span>🔔</span>
                      <span
                        style={{
                          position: 'absolute',
                          top: '7px',
                          right: '7px',
                          width: '7px',
                          height: '7px',
                          borderRadius: '50%',
                          background: '#ef4444',
                          border: '1.5px solid #ffffff',
                        }}
                      />
                    </button>

                    {/* Notification Dropdown Popover */}
                    {showNotifications && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 'calc(100% + 8px)',
                          right: 0,
                          width: '290px',
                          background: 'var(--bg-surface-elevated, #ffffff)',
                          border: '1px solid var(--border-subtle, #e2e8f0)',
                          borderRadius: '14px',
                          boxShadow: '0 12px 28px rgba(0, 0, 0, 0.12)',
                          padding: '16px',
                          zIndex: 1000,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                          <strong style={{ fontSize: '0.9375rem', color: 'var(--text-primary)' }}>Notifications</strong>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: '#f1f5f9', padding: '2px 8px', borderRadius: '9999px' }}>
                            0 unread
                          </span>
                        </div>
                        <div style={{ textAlign: 'center', padding: '12px 8px' }}>
                          <div style={{ fontSize: '1.75rem', marginBottom: '6px' }}>🎉</div>
                          <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            You're all caught up!
                          </p>
                          <p style={{ margin: '4px 0 0 0', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                            Course updates and notifications will appear here.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleOpenProfile}
                    className="user-profile-btn"
                    title="Click to view full profile & settings"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '4px 14px 4px 6px',
                      borderRadius: '9999px',
                      background: 'var(--bg-surface-elevated, #ffffff)',
                      border: '1.5px solid var(--border-subtle, #e2e8f0)',
                      cursor: 'pointer',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: '#4338ca',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.9375rem',
                        fontWeight: 800,
                        boxShadow: '0 2px 4px rgba(67, 56, 202, 0.25)',
                      }}
                    >
                      {user.display_name ? user.display_name.charAt(0).toUpperCase() : '👤'}
                    </div>
                    <div style={{ textAlign: 'left', lineHeight: 1.2 }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {user.display_name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {user.role === 'teacher' ? '👩‍🏫 Teacher Studio' : '🎓 My Profile'}
                      </div>
                    </div>
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
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="container" style={{ paddingTop: 'var(--space-4)' }}>

        {/* Breadcrumb navigation for sub-views */}
        {activeView !== 'home' && (
          <nav
            aria-label="Breadcrumb navigation"
            style={{
              margin: 'var(--space-2) 0',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
            }}
          >
            <span>Dashboard</span>
            <span aria-hidden="true">/</span>
            <span
              style={{
                textTransform: 'capitalize',
                fontWeight: 600,
              }}
            >
              {activeView.replace(/_/g, ' ')}
            </span>
          </nav>
        )}

        {/* View Routing */}
        {isLoading && !user ? (
          <div style={{ padding: 'var(--space-8) var(--space-4)' }}>
            <LoadingScreen
              preset="authLogin"
              title="Connecting to AdaptAI Space..."
              subtitle="Restoring your session securely and configuring sensory accommodations..."
              variant="card"
            />
          </div>
        ) : activeView === 'profile' ? (
          <StudentProfilePage
            onBack={() => navigateTo('home')}
            onLogout={handleLogout}
          />
        ) : activeView === 'student_onboarding' ? (
          <StudentOnboarding
            onBackToHome={() => {
              setPendingAutoStartTest(false);
              handleBack();
            }}
            autoStart={pendingAutoStartTest}
          />
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
            {user.role === 'teacher' ? (
              <div className="dashboard-hero-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
                  <div>
                    <span className="hero-badge">
                      👩‍🏫 Teacher Workspace
                    </span>
                    <h1 style={{ fontSize: '2rem', fontWeight: 800, marginTop: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                      Welcome back, {user.display_name}!
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', maxWidth: '640px', margin: 0 }}>
                      Create courses, view student test progress, and use AI to generate practice questions and chapter tests.
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                    {user.age && <span className="btn-a11y">Age: {user.age}</span>}
                    {user.age_band && <span className="btn-a11y">Age Group: {user.age_band}</span>}
                  </div>
                </div>
              </div>
            ) : (
              <div className="student-hero-banner">
                <div className="student-hero-content">
                  <h1 className="student-hero-title">
                    Welcome back, <span className="student-hero-name-highlight">{user.display_name}!</span>
                  </h1>
                  <p className="student-hero-subtext">
                    Your friendly learning space with calm pacing, helpful speech hints, and courses picked just for you.
                  </p>
                  <button
                    type="button"
                    className="student-hero-cta"
                    onClick={() => {
                      const el = document.getElementById('courses-section');
                      if (el) {
                        el.scrollIntoView({ behavior: 'smooth' });
                      }
                    }}
                  >
                    Explore Courses →
                  </button>
                </div>
                <div className="student-hero-illustration">
                  <img
                    src={heroStudentImg}
                    alt="Student with headphones learning on laptop"
                    className="student-hero-img"
                  />
                </div>
              </div>
            )}

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
                  refreshTrigger={teacherRefreshTrigger}
                  targetAgeBand={teacherTargetAgeBand}
                  onLaunchPractice={(dppId, chapterId, chapterTitle, courseTitle) => {
                    setActiveDppId(dppId || null);
                    setActiveChapterId(chapterId || null);
                    setActiveChapterTitle(chapterTitle || null);
                    setActiveCourseTitle(courseTitle || null);
                    navigateTo('practice_session');
                  }}
                  onOpenCreateCourse={(defaultAgeBand) => {
                    if (defaultAgeBand) setAuthoringAgeBand(defaultAgeBand);
                    setIsTeacherAuthoringOpen(true);
                  }}
                  onOpenAnalytics={(courseId) => {
                    setActiveCourseId(courseId);
                    navigateTo('teacher_dashboard');
                  }}
                />

                {/* Course Authoring Modal */}
                <CourseAuthoringModal
                  isOpen={isTeacherAuthoringOpen}
                  initialAgeBandCode={authoringAgeBand}
                  onClose={() => {
                    setIsTeacherAuthoringOpen(false);
                    setTeacherRefreshTrigger((prev) => prev + 1);
                  }}
                  onCourseCreated={(newCourseId, createdAgeBand) => {
                    setActiveCourseId(newCourseId);
                    if (createdAgeBand) {
                      setTeacherTargetAgeBand(createdAgeBand);
                    }
                    setTeacherRefreshTrigger((prev) => prev + 1);
                  }}
                />
              </div>
            ) : (
              /* STUDENT DASHBOARD: Explore Courses & My Courses */
              <StudentDashboard
                onEnterCourse={(courseId) => {
                  setActiveCourseId(courseId);
                  navigateTo('course_room');
                }}
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
                  alt="AdaptAI - Inclusive AI-Powered Learning with Audio Hints, Interactive Lessons, and Alpha Beta Gamma Tracks"
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
                  <h3>Quick Enrollment Test</h3>
                  <p>
                    Take a fun, 5-question enrollment check so we can recommend courses and lessons suited to your exact level.
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
                      Access your enrollment test, enrolled courses, daily practice with spoken hints, and profile.
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
      {isAuthModalOpen && (
        <AuthModal
          key={`${authDefaultMode}-${authDefaultRole}`}
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          defaultMode={authDefaultMode}
          defaultRole={authDefaultRole}
          onSuccess={(role, wasRegistration) => {
            if (role === 'student' && wasRegistration) {
              setPendingAutoStartTest(true);
              navigateTo('student_onboarding');
            } else {
              navigateTo('home');
            }
          }}
        />
      )}
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
