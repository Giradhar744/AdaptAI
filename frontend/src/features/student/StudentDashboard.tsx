import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { CoursePurchaseModal } from './CoursePurchaseModal';

export interface CourseItem {
  id: string;
  teacher_id: string;
  teacher_name: string;
  title: string;
  subject: string;
  age_band_id: string;
  age_band_code: string;
  age_band_label: string;
  description?: string;
  fee: number;
  is_published: boolean;
  chapters_count: number;
  is_enrolled: boolean;
}

export interface DiagnosticLatestResult {
  score_percentage: number;
  assigned_age_band: string;
  progression_age_band: string;
  total_questions: number;
  correct_count: number;
  completed_at: string;
}

interface StudentDashboardProps {
  onEnterCourse: (courseId: string) => void;
  onLaunchDiagnostic: () => void;
  onOpenConsentCenter: () => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  onEnterCourse,
  onLaunchDiagnostic,
  onOpenConsentCenter,
}) => {
  const { user, token } = useAuth();
  const [activeTab, setActiveTab] = useState<'explore' | 'my_courses' | 'profile'>('explore');
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [diagnosticResult, setDiagnosticResult] = useState<DiagnosticLatestResult | null>(null);
  const [selectedCourseForEnroll, setSelectedCourseForEnroll] = useState<CourseItem | null>(null);
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');

  const fetchCourses = async () => {
    setLoadingCourses(true);
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/v1/courses', { headers });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setCourses(data);
        }
      }
    } catch {
      // Fallback sample courses if offline
      setCourses([
        {
          id: 'course-sample-1',
          teacher_id: 't-1',
          teacher_name: 'Dr. Sarah Jenkins',
          title: 'Natural Sciences: Living Cells & Energy',
          subject: 'Science',
          age_band_id: 'ab-2',
          age_band_code: '11-15',
          age_band_label: 'Ages 11–15',
          description: 'Explore the building blocks of life with calm visual diagrams and spoken audio hints.',
          fee: 0,
          is_published: true,
          chapters_count: 3,
          is_enrolled: true,
        },
        {
          id: 'course-sample-2',
          teacher_id: 't-2',
          teacher_name: 'Prof. Alan Turing',
          title: 'Foundations of Mathematics & Patterns',
          subject: 'Mathematics',
          age_band_id: 'ab-1',
          age_band_code: '7-10',
          age_band_label: 'Ages 7–10',
          description: 'Build intuition for numbers, shapes, and patterns at a calm, personalized pace.',
          fee: 29.0,
          is_published: true,
          chapters_count: 2,
          is_enrolled: false,
        },
      ]);
    } finally {
      setLoadingCourses(false);
    }
  };

  const fetchLatestDiagnostic = async () => {
    if (!token || !user?.student_id) return;
    try {
      const res = await fetch(`/api/v1/students/${user.student_id}/diagnostic/latest`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDiagnosticResult(data);
      }
    } catch {
      // Keep null or defaults
    }
  };

  useEffect(() => {
    fetchCourses();
    fetchLatestDiagnostic();
  }, [token, user?.student_id]);

  const enrolledCourses = courses.filter((c) => c.is_enrolled);

  // Recommended courses based on student's placement diagnostic or age band
  const recommendedBand = diagnosticResult?.assigned_age_band || user?.age_band || '11-15';

  const subjects = ['all', ...Array.from(new Set(courses.map((c) => c.subject)))];
  const filteredCourses = selectedSubjectFilter === 'all'
    ? courses
    : courses.filter((c) => c.subject === selectedSubjectFilter);

  return (
    <div>
      {/* 3 Main Tabs Navigation */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-2)',
          borderBottom: '2px solid var(--border-subtle)',
          marginBottom: 'var(--space-6)',
          overflowX: 'auto',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('explore')}
          style={{
            padding: '10px 18px',
            fontSize: '1rem',
            fontWeight: 700,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'explore' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'explore' ? 'var(--primary)' : 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>🔍</span> Explore Courses
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('my_courses')}
          style={{
            padding: '10px 18px',
            fontSize: '1rem',
            fontWeight: 700,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'my_courses' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'my_courses' ? 'var(--primary)' : 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>📚</span> My Courses ({enrolledCourses.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          style={{
            padding: '10px 18px',
            fontSize: '1rem',
            fontWeight: 700,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'profile' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'profile' ? 'var(--primary)' : 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>👤</span> My Profile
        </button>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: EXPLORE COURSES */}
      {/* ============================================================== */}
      {activeTab === 'explore' && (
        <div>
          {/* Diagnostic Placement Recommendation Card */}
          {diagnosticResult ? (
            <div
              className="card"
              style={{
                marginBottom: 'var(--space-6)',
                borderLeft: '6px solid var(--primary)',
                background: 'linear-gradient(135deg, rgba(13, 148, 136, 0.08) 0%, rgba(99, 102, 241, 0.08) 100%)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                <div>
                  <span className="brand-badge" style={{ background: '#0d9488', color: '#ffffff', marginBottom: 'var(--space-2)' }}>
                    ✨ Recommended For Your Level
                  </span>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 'var(--space-1) 0' }}>
                    Personalized based on your Placement Score ({diagnosticResult.score_percentage}%)
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0 }}>
                    We recommend courses suited for <strong>Ages {diagnosticResult.assigned_age_band}</strong>, with pathway into <strong>Ages {diagnosticResult.progression_age_band}</strong>.
                  </p>
                </div>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={onLaunchDiagnostic}
                  style={{ fontSize: '0.875rem', padding: '6px 14px' }}
                >
                  Retake Placement Test ↻
                </button>
              </div>
            </div>
          ) : (
            <div
              className="card"
              style={{
                marginBottom: 'var(--space-6)',
                borderLeft: '6px solid #6366f1',
                background: 'rgba(99, 102, 241, 0.06)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 'var(--space-3)',
              }}
            >
              <div>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: '0 0 var(--space-1) 0' }}>
                  🎯 Want Personalized Course Recommendations?
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0 }}>
                  Take a quick 5-question placement test so we can tailor courses and hints to your exact learning level.
                </p>
              </div>
              <button
                type="button"
                className="button-primary"
                onClick={onLaunchDiagnostic}
                style={{ padding: '8px 16px', fontSize: '0.875rem' }}
              >
                Start Placement Test →
              </button>
            </div>
          )}

          {/* Subject Filter Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            <div>
              <h2 style={{ fontSize: '1.375rem', fontWeight: 700, margin: 0 }}>All Available Courses</h2>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                {filteredCourses.length} {filteredCourses.length === 1 ? 'course' : 'courses'} found
              </span>
            </div>

            {subjects.length > 2 && (
              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                {subjects.map((subj) => (
                  <button
                    key={subj}
                    type="button"
                    onClick={() => setSelectedSubjectFilter(subj)}
                    className={selectedSubjectFilter === subj ? 'button-primary' : 'btn-a11y'}
                    style={{ padding: '4px 12px', fontSize: '0.8125rem', textTransform: 'capitalize' }}
                  >
                    {subj === 'all' ? 'All Subjects' : subj}
                  </button>
                ))}
              </div>
            )}
          </div>

          {loadingCourses ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
              <p style={{ color: 'var(--text-secondary)' }}>Loading courses...</p>
            </div>
          ) : filteredCourses.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
              <p style={{ color: 'var(--text-secondary)' }}>No courses match your filter.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 'var(--space-4)' }}>
              {filteredCourses.map((c) => {
                const isRecommended =
                  c.age_band_code === recommendedBand ||
                  c.age_band_code === diagnosticResult?.progression_age_band;

                return (
                  <div
                    key={c.id}
                    className="card"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      border: isRecommended ? '2px solid var(--primary)' : '1px solid var(--border-subtle)',
                      position: 'relative',
                    }}
                  >
                    {isRecommended && (
                      <span
                        className="brand-badge"
                        style={{
                          position: 'absolute',
                          top: '12px',
                          right: '12px',
                          background: 'var(--primary)',
                          color: '#ffffff',
                          fontSize: '0.75rem',
                        }}
                      >
                        ⭐ Best Match
                      </span>
                    )}

                    <div>
                      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                        <span className="brand-badge">{c.subject}</span>
                        <span className="btn-a11y" style={{ fontSize: '0.75rem' }}>
                          {c.age_band_label || 'All Ages'}
                        </span>
                      </div>

                      <h3 style={{ fontSize: '1.1875rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
                        {c.title}
                      </h3>

                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: '1.5', marginBottom: 'var(--space-4)' }}>
                        {c.description || 'Learn key concepts with friendly lessons, spoken audio hints, and daily practice.'}
                      </p>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)', fontSize: '0.875rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>
                          Teacher: <strong>{c.teacher_name}</strong>
                        </span>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          {c.fee > 0 ? `$${c.fee.toFixed(2)}` : 'Free'}
                        </span>
                      </div>

                      {c.is_enrolled ? (
                        <button
                          type="button"
                          className="button-primary"
                          onClick={() => onEnterCourse(c.id)}
                          style={{ width: '100%', padding: '8px 12px' }}
                        >
                          Enter Course Room →
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="button-secondary"
                          onClick={() => setSelectedCourseForEnroll(c)}
                          style={{ width: '100%', padding: '8px 12px' }}
                        >
                          Join Course ({c.fee > 0 ? `$${c.fee.toFixed(2)}` : 'Free'}) →
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: MY COURSES */}
      {/* ============================================================== */}
      {activeTab === 'my_courses' && (
        <div>
          <h2 style={{ fontSize: '1.375rem', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
            Courses You Are Enrolled In
          </h2>

          {enrolledCourses.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 'var(--space-12) var(--space-4)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-3)' }}>📚</div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
                You haven't joined any courses yet.
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', maxWidth: '480px', margin: '0 auto var(--space-6) auto' }}>
                Explore our collection of sensory-friendly courses tailored to your pace and learning preferences.
              </p>
              <button
                type="button"
                className="button-primary"
                onClick={() => setActiveTab('explore')}
                style={{ padding: '10px 20px' }}
              >
                Browse Explore Courses →
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 'var(--space-4)' }}>
              {enrolledCourses.map((c) => (
                <div key={c.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                      <span className="brand-badge" style={{ background: '#059669', color: '#ffffff' }}>
                        Enrolled
                      </span>
                      <span className="brand-badge">{c.subject}</span>
                    </div>

                    <h3 style={{ fontSize: '1.1875rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
                      {c.title}
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: '1.5', marginBottom: 'var(--space-4)' }}>
                      {c.description || 'Watch lessons, take daily practice with AI speech hints, and complete chapter tests.'}
                    </p>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>
                      Instructor: <strong>{c.teacher_name}</strong> · Chapters: <strong>{c.chapters_count || 1}</strong>
                    </div>
                    <button
                      type="button"
                      className="button-primary"
                      onClick={() => onEnterCourse(c.id)}
                      style={{ width: '100%', padding: '10px 14px' }}
                    >
                      Enter Course Room →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: MY PROFILE */}
      {/* ============================================================== */}
      {activeTab === 'profile' && (
        <div style={{ maxWidth: '720px' }}>
          <h2 style={{ fontSize: '1.375rem', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
            Your Learning Profile
          </h2>

          {/* Student Info Card */}
          <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: 'var(--primary)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem',
                  fontWeight: 800,
                }}
              >
                {user?.display_name ? user.display_name.charAt(0).toUpperCase() : 'S'}
              </div>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 var(--space-1) 0' }}>
                  {user?.display_name || 'Student'}
                </h3>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  {user?.email}
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-3)', fontSize: '0.875rem' }}>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Age:</span>{' '}
                <strong>{user?.age || 'Not specified'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Age Group:</span>{' '}
                <strong>{user?.age_band ? `Ages ${user.age_band}` : 'All Ages'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Learning Needs:</span>{' '}
                <strong>{user?.disabilities?.[0]?.label || 'General Personalized'}</strong>
              </div>
            </div>
          </div>

          {/* Diagnostic Placement Card */}
          <div className="card" style={{ marginBottom: 'var(--space-4)', borderLeft: '6px solid var(--primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>
                🎯 Placement Test Status
              </h3>
              <button
                type="button"
                className="button-secondary"
                onClick={onLaunchDiagnostic}
                style={{ padding: '6px 12px', fontSize: '0.8125rem' }}
              >
                Retake Test ↻
              </button>
            </div>

            {diagnosticResult ? (
              <div>
                <p style={{ fontSize: '0.9375rem', marginBottom: 'var(--space-3)' }}>
                  Latest score: <strong>{diagnosticResult.score_percentage}%</strong> ({diagnosticResult.correct_count} of {diagnosticResult.total_questions} questions correct).
                </p>
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  <span className="brand-badge">Current Level: Ages {diagnosticResult.assigned_age_band}</span>
                  <span className="brand-badge" style={{ background: '#059669', color: '#ffffff' }}>
                    Next Level: Ages {diagnosticResult.progression_age_band}
                  </span>
                </div>
              </div>
            ) : (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0 }}>
                You have not completed the placement diagnostic yet. Take it to unlock custom difficulty recommendations!
              </p>
            )}
          </div>

          {/* Privacy & Accommodations Ledger Card */}
          <div className="card" style={{ borderLeft: '6px solid #6366f1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>
                🛡️ Learning Accommodations & Privacy
              </h3>
              <button
                type="button"
                className="button-secondary"
                onClick={onOpenConsentCenter}
                style={{ padding: '6px 12px', fontSize: '0.8125rem' }}
              >
                Open Consent Ledger →
              </button>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0 }}>
              All AI teaching accommodations (like audio narration, extra time, or simplified text) require your clear approval and are logged securely.
            </p>
          </div>
        </div>
      )}

      {/* Simulated Purchase / Enrollment Modal */}
      <CoursePurchaseModal
        isOpen={Boolean(selectedCourseForEnroll)}
        onClose={() => setSelectedCourseForEnroll(null)}
        course={selectedCourseForEnroll}
        onEnrollSuccess={(courseId) => {
          setCourses((prev) =>
            prev.map((c) => (c.id === courseId ? { ...c, is_enrolled: true } : c))
          );
          setActiveTab('my_courses');
        }}
      />
    </div>
  );
};

export default StudentDashboard;
