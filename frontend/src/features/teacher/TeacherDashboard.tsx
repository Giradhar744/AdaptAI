import React, { useState, useEffect } from 'react';

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
  courseId = 'course-dev-001',
  onBackToHome,
}) => {
  const [analytics, setAnalytics] = useState<CourseAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/v1/courses/${courseId}/analytics`);
        if (res.ok) {
          const data = await res.json();
          setAnalytics(data);
        } else {
          // Fallback sample for demonstration/dev
          generateFallbackAnalytics();
        }
      } catch {
        generateFallbackAnalytics();
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [courseId]);

  const generateFallbackAnalytics = () => {
    setAnalytics({
      course_id: courseId,
      course_title: 'Natural Sciences: Cell Biology & Energy',
      enrolled_students: 8,
      completed_first_attempts: 6,
      avg_first_attempt_score: 83.5,
      total_reattempts: 7,
      struggling_students_count: 2,
      rating: {
        course_id: courseId,
        rating_value: 4.3,
        computed_from_attempt_count: 6,
        min_required_attempts: 5,
        status: 'published',
        computed_at: new Date().toISOString(),
      },
      copilot_summary:
        'Class engagement: 8 students enrolled with 6 first-attempt chapter tests completed. Average first-attempt test mastery stands at 83.5%. Students demonstrated strong learning persistence with 7 mastery re-attempts recorded. Attention: 2 student(s) triggered cognitive friction alerts; we recommend authoring a supplemental step-by-step worked example.',
      students_summary: [
        {
          student_id: 's-1',
          student_name: 'Ananya Sharma',
          first_attempt_score: 100,
          latest_attempt_score: 100,
          attempts_count: 1,
          struggle_risk_level: 'low',
        },
        {
          student_id: 's-2',
          student_name: 'Rohan Mehra',
          first_attempt_score: 75,
          latest_attempt_score: 100,
          attempts_count: 3,
          struggle_risk_level: 'low',
        },
        {
          student_id: 's-3',
          student_name: 'Devansh Verma',
          first_attempt_score: 60,
          latest_attempt_score: 85,
          attempts_count: 2,
          struggle_risk_level: 'medium',
        },
        {
          student_id: 's-4',
          student_name: 'Sara Khan',
          first_attempt_score: 90,
          latest_attempt_score: 90,
          attempts_count: 1,
          struggle_risk_level: 'low',
        },
        {
          student_id: 's-5',
          student_name: 'Kabir Das',
          first_attempt_score: 50,
          latest_attempt_score: 75,
          attempts_count: 3,
          struggle_risk_level: 'high',
        },
      ],
    });
  };

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
          ← Return to Portal Hub
        </button>
        <span className="brand-badge" style={{ background: '#4f46e5', color: '#ffffff' }}>
          Teacher Co-Pilot Active
        </span>
      </div>

      <header style={{ marginBottom: 'var(--space-6)' }}>
        <h1 style={{ fontSize: '1.875rem', fontWeight: 800, marginBottom: 'var(--space-2)' }}>
          Educator Analytics & Course Ranking Dashboard
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.0625rem', lineHeight: '1.6' }}>
          Real-time performance analytics, First-Attempt Star Rankings, and AI Teacher Co-Pilot insights.
        </p>
      </header>

      {loading && (
        <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Loading course performance metrics and Teacher Co-Pilot analytics...
        </div>
      )}

      {!loading && analytics && (
        <>
          {/* TOP METRICS & STAR RATING ROW */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
            {/* Course Rating Card */}
            <div
              className="card"
              style={{
                borderLeft: '6px solid #4f46e5',
                background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.05) 0%, rgba(13, 148, 136, 0.05) 100%)',
              }}
            >
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-1)' }}>
                First-Attempt Star Rating
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
                  ? `Computed from ${analytics.rating.computed_from_attempt_count} verified first attempts.`
                  : `Requires at least ${analytics.rating?.min_required_attempts || 5} first attempts to display.`}
              </p>
            </div>

            {/* Average Mastery Card */}
            <div className="card">
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-1)' }}>
                Avg First-Attempt Score
              </div>
              <div style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--primary)' }}>
                {analytics.avg_first_attempt_score}%
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: 'var(--space-2)' }}>
                {analytics.completed_first_attempts} of {analytics.enrolled_students} enrolled students completed
              </div>
            </div>

            {/* Learning Re-attempts Card */}
            <div className="card">
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-1)' }}>
                Mastery Re-attempts
              </div>
              <div style={{ fontSize: '2.25rem', fontWeight: 800, color: '#059669' }}>
                {analytics.total_reattempts}
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: 'var(--space-2)' }}>
                Voluntary practice re-attempts taken for learning
              </div>
            </div>

            {/* Cognitive Friction Alert Card */}
            <div
              className="card"
              style={{
                borderLeft: analytics.struggling_students_count > 0 ? '4px solid #e11d48' : '4px solid #059669',
              }}
            >
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-1)' }}>
                Cognitive Friction Alerts
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
                  ? 'Students flagged with elevated hesitation/errors'
                  : 'All students learning with calm focus'}
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
              <span style={{ fontSize: '1.25rem' }}>🤖</span>
              <h2 id="heading-copilot" style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0, color: '#4338ca' }}>
                Teacher Co-Pilot Narrative Insights
              </h2>
            </div>
            <p style={{ margin: 0, fontSize: '0.9375rem', lineHeight: '1.6', color: 'var(--text-primary)' }}>
              {analytics.copilot_summary}
            </p>
          </section>

          {/* STUDENT ROSTER & MASTERY PROGRESSION */}
          <section aria-labelledby="heading-roster" className="card">
            <h2 id="heading-roster" style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
              Class Student Performance & Mastery Progression
            </h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
              Compare initial first-attempt scores against latest re-attempt mastery to see individual student growth.
            </p>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: '0.875rem', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '10px 8px' }}>Student Name</th>
                    <th style={{ padding: '10px 8px' }}>First Attempt (Evaluation)</th>
                    <th style={{ padding: '10px 8px' }}>Latest Score (Mastery)</th>
                    <th style={{ padding: '10px 8px' }}>Total Attempts</th>
                    <th style={{ padding: '10px 8px' }}>Struggle Risk</th>
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
                          <span style={{ color: 'var(--text-secondary)' }}>Not Attempted</span>
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
          </section>
        </>
      )}
    </div>
  );
};

export default TeacherDashboard;
