import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { CourseAuthoringModal } from './CourseAuthoringModal';

export interface CourseRatingData {
  course_id: string;
  rating_value: number | null;
  computed_from_attempt_count: number;
  min_required_attempts: number;
  status: 'published' | 'insufficient_data';
  computed_at: string;
}

export interface StudentProgress {
  student_id: string;
  student_name: string;
  first_attempt_score: number | null;
  latest_attempt_score: number | null;
  attempts_count: number;
  struggle_risk_level: string | null;
}

export interface CourseAnalytics {
  course_id: string;
  course_title: string;
  enrolled_students: number;
  completed_first_attempts: number;
  avg_first_attempt_score: number;
  total_reattempts: number;
  struggling_students_count: number;
  rating: CourseRatingData | null;
  copilot_summary: string;
  students_summary: StudentProgress[];
}

interface TeacherDashboardProps {
  courseId?: string;
  onBackToHome: () => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  courseId: initialCourseId = 'course-dev-001',
  onBackToHome,
}) => {
  const { token } = useAuth();
  const [activeCourseId, setActiveCourseId] = useState<string>(initialCourseId);
  const [courses, setCourses] = useState<Array<{ id: string; title: string; subject: string }>>([]);
  const [analytics, setAnalytics] = useState<CourseAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthoringOpen, setIsAuthoringOpen] = useState(false);

  // Fetch teacher's authored courses if authenticated
  useEffect(() => {
    const fetchTeacherCourses = async () => {
      if (!token) return;
      try {
        const res = await fetch('/api/v1/courses?mine=true', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setCourses(data);
            setActiveCourseId(data[0].id);
          }
        }
      } catch {
        // Keep initial
      }
    };
    fetchTeacherCourses();
  }, [token]);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`/api/v1/courses/${activeCourseId}/analytics`, { headers });
        if (res.ok) {
          const data = await res.json();
          setAnalytics(data);
        } else {
          // If no data or course has 0 students yet, show clean real zero-state
          setAnalytics({
            course_id: activeCourseId,
            course_title: courses.find((c) => c.id === activeCourseId)?.title || 'Course Overview',
            enrolled_students: 0,
            completed_first_attempts: 0,
            avg_first_attempt_score: 0,
            total_reattempts: 0,
            struggling_students_count: 0,
            rating: null,
            copilot_summary:
              'No student test activity recorded yet. As students complete their first chapter test, helpful teaching tips, ratings, and progress metrics will appear here in real time.',
            students_summary: [],
          });
        }
      } catch {
        setAnalytics({
          course_id: activeCourseId,
          course_title: 'Course Overview',
          enrolled_students: 0,
          completed_first_attempts: 0,
          avg_first_attempt_score: 0,
          total_reattempts: 0,
          struggling_students_count: 0,
          rating: null,
          copilot_summary:
            'Connect to the server to view live student analytics and course insights.',
          students_summary: [],
        });
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [activeCourseId, token, courses]);

  const renderStars = (rating: number | null) => {
    if (rating === null) return '☆☆☆☆☆';
    const rounded = Math.round(rating);
    return '★'.repeat(rounded) + '☆'.repeat(5 - rounded);
  };

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: 'var(--space-4) 0' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
        <button
          type="button"
          onClick={onBackToHome}
          className="button-secondary"
          style={{ padding: '0.4rem 0.8rem', fontSize: '0.875rem' }}
        >
          ← Return to Dashboard
        </button>
        <span className="brand-badge" style={{ background: '#4f46e5', color: '#ffffff' }}>
          Teacher Workspace Active
        </span>
      </div>

      <header style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <div>
            <h1 style={{ fontSize: '1.875rem', fontWeight: 800, marginBottom: 'var(--space-2)' }}>
              Teacher Dashboard & Course Insights
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.0625rem', lineHeight: '1.6' }}>
              See how your students are doing, view course ratings, and get smart teaching tips.
            </p>
          </div>
          <button
            type="button"
            className="button-primary"
            onClick={() => setIsAuthoringOpen(true)}
            style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span>➕</span> Create New Course with AI
          </button>
        </div>

        {/* Course Switcher if multiple courses exist */}
        {courses.length > 0 && (
          <div style={{ marginTop: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <label htmlFor="course-selector" style={{ fontSize: '0.875rem', fontWeight: 600 }}>
              Active Course:
            </label>
            <select
              id="course-selector"
              value={activeCourseId}
              onChange={(e) => setActiveCourseId(e.target.value)}
              style={{
                padding: '8px 14px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-strong)',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontSize: '0.9375rem',
              }}
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.subject})
                </option>
              ))}
            </select>
          </div>
        )}
      </header>

      {/* Course Authoring Modal */}
      <CourseAuthoringModal
        isOpen={isAuthoringOpen}
        onClose={() => setIsAuthoringOpen(false)}
        onCourseCreated={(newCourseId) => {
          setActiveCourseId(newCourseId);
          if (token) {
            fetch('/api/v1/courses?mine=true', {
              headers: { Authorization: `Bearer ${token}` },
            })
              .then((res) => res.json())
              .then((data) => {
                if (Array.isArray(data)) setCourses(data);
              })
              .catch(() => {});
          }
        }}
      />

      {loading && (
        <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Loading course performance metrics and student insights...
        </div>
      )}

      {!loading && analytics && (
        <>
          {/* TOP METRICS & STAR RATING ROW */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
            {/* Course Rating Card */}
            <div
              className="card"
              style={{
                borderLeft: '6px solid #4f46e5',
                background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.05) 0%, rgba(13, 148, 136, 0.05) 100%)',
              }}
            >
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-1)' }}>
                Course Quality Rating
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)' }}>
                <span style={{ fontSize: '2.25rem', fontWeight: 800, color: '#4f46e5' }}>
                  {analytics.rating?.status === 'published' ? analytics.rating.rating_value : '—'}
                </span>
                <span style={{ fontSize: '1.25rem', color: '#f59e0b' }}>
                  {renderStars(analytics.rating?.rating_value ?? null)}
                </span>
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 'var(--space-2) 0 0 0' }}>
                {analytics.rating?.status === 'published'
                  ? `Based on ${analytics.rating.computed_from_attempt_count} students' first attempts.`
                  : `Shows once at least ${analytics.rating?.min_required_attempts || 5} students finish test 1.`}
              </p>
            </div>

            {/* Average Score Card */}
            <div className="card">
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-1)' }}>
                Average First Score
              </div>
              <div style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--primary)' }}>
                {analytics.avg_first_attempt_score}%
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: 'var(--space-2)' }}>
                {analytics.completed_first_attempts} of {analytics.enrolled_students} enrolled students completed
              </div>
            </div>

            {/* Practice Retakes Card */}
            <div className="card">
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-1)' }}>
                Practice Retakes
              </div>
              <div style={{ fontSize: '2.25rem', fontWeight: 800, color: '#059669' }}>
                {analytics.total_reattempts}
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: 'var(--space-2)' }}>
                Extra practice tries taken for learning
              </div>
            </div>

            {/* Students Needing Help Card */}
            <div
              className="card"
              style={{
                borderLeft: analytics.struggling_students_count > 0 ? '4px solid #e11d48' : '4px solid #059669',
              }}
            >
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-1)' }}>
                Students Needing Help
              </div>
              <div
                style={{
                  fontSize: '2.25rem',
                  fontWeight: 800,
                  color: analytics.struggling_students_count > 0 ? '#be123c' : '#059669',
                }}
              >
                {analytics.struggling_students_count}
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: 'var(--space-2)' }}>
                {analytics.struggling_students_count > 0
                  ? 'Students flagged with hesitation or repeated errors'
                  : 'All students learning smoothly'}
              </div>
            </div>
          </div>

          {/* AI TEACHER CO-PILOT SYNTHESIS */}
          <section
            aria-labelledby="heading-copilot"
            className="card"
            style={{
              borderLeft: '6px solid #6366f1',
              background: 'rgba(99, 102, 241, 0.05)',
              padding: 'var(--space-5)',
              marginBottom: 'var(--space-8)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
              <span style={{ fontSize: '1.25rem' }}>💡</span>
              <h2 id="heading-copilot" style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0, color: '#4338ca' }}>
                Smart Teaching Tips
              </h2>
            </div>
            <p style={{ margin: 0, fontSize: '0.9375rem', lineHeight: '1.6', color: 'var(--text-primary)' }}>
              {analytics.copilot_summary}
            </p>
          </section>

          {/* STUDENT ROSTER & MASTERY PROGRESSION */}
          <section aria-labelledby="heading-roster" className="card">
            <h2 id="heading-roster" style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
              Student Progress
            </h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
              Compare first test scores with latest practice to see each student's improvement.
            </p>

            {analytics.students_summary.length === 0 ? (
              <div
                style={{
                  padding: 'var(--space-6)',
                  textAlign: 'center',
                  background: 'var(--surface-sunken)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-secondary)',
                }}
              >
                <div style={{ fontSize: '1.5rem', marginBottom: 'var(--space-2)' }}>🌱</div>
                <p style={{ fontWeight: 600, margin: '0 0 var(--space-1) 0' }}>
                  No students have joined this course yet.
                </p>
                <p style={{ fontSize: '0.875rem', margin: 0 }}>
                  Once students enroll and complete lessons or tests, their scores and progress will appear here.
                </p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: '0.875rem', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '10px 8px' }}>Student Name</th>
                      <th style={{ padding: '10px 8px' }}>First Score</th>
                      <th style={{ padding: '10px 8px' }}>Latest Score</th>
                      <th style={{ padding: '10px 8px' }}>Total Tries</th>
                      <th style={{ padding: '10px 8px' }}>Needs Help?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.students_summary.map((st) => (
                      <tr key={st.student_id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '10px 8px', fontWeight: 600 }}>{st.student_name}</td>
                        <td style={{ padding: '10px 8px' }}>
                          {st.first_attempt_score !== null ? (
                            <strong style={{ color: st.first_attempt_score >= 70 ? '#059669' : '#d97706' }}>
                              {st.first_attempt_score}%
                            </strong>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)' }}>Not Taken</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 8px' }}>
                          {st.latest_attempt_score !== null ? (
                            <span style={{ color: '#059669', fontWeight: 600 }}>
                              {st.latest_attempt_score}%
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td style={{ padding: '10px 8px' }}>{st.attempts_count}</td>
                        <td style={{ padding: '10px 8px' }}>
                          <span
                            style={{
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              background:
                                st.struggle_risk_level === 'high'
                                  ? 'rgba(225, 29, 72, 0.15)'
                                  : st.struggle_risk_level === 'medium'
                                  ? 'rgba(217, 119, 6, 0.15)'
                                  : 'rgba(5, 150, 105, 0.15)',
                              color:
                                st.struggle_risk_level === 'high'
                                  ? '#be123c'
                                  : st.struggle_risk_level === 'medium'
                                  ? '#d97706'
                                  : '#059669',
                            }}
                          >
                            {st.struggle_risk_level || 'low'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default TeacherDashboard;
