import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { CoursePurchaseModal } from './CoursePurchaseModal';
import { LoadingScreen } from '../../components/LoadingScreen';
import { getStudentGroupName, formatStudentTrack } from '../../utils/studentGroup';

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
  score?: number;
  max_score?: number;
  percentage?: number;
  score_percentage?: number;
  assigned_age_band?: string;
  recommended_age_band?: string;
  progression_age_band?: string | null;
  total_questions?: number;
  correct_count?: number;
  completed_at?: string;
  explanation?: string;
}

interface StudentDashboardProps {
  onEnterCourse: (courseId: string) => void;
  activeTab?: 'explore' | 'my_courses';
  onTabChange?: (tab: 'explore' | 'my_courses') => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  onEnterCourse,
  activeTab: controlledTab,
  onTabChange,
}) => {
  const { user, token, refreshProfile } = useAuth();
  const [internalTab, setInternalTab] = useState<'explore' | 'my_courses'>('explore');
  const activeTab = controlledTab !== undefined ? controlledTab : internalTab;
  const setActiveTab = onTabChange || setInternalTab;
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [diagnosticResult, setDiagnosticResult] = useState<DiagnosticLatestResult | null>(null);
  const [selectedCourseForEnroll, setSelectedCourseForEnroll] = useState<CourseItem | null>(null);
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

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
    } catch (err) {
      console.error('Failed to fetch courses from database:', err);
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
        if (data) {
          const rawPercentage =
            data.score_percentage !== undefined && data.score_percentage !== null
              ? data.score_percentage
              : data.percentage !== undefined && data.percentage !== null
              ? data.percentage
              : typeof data.score === 'number' && typeof data.max_score === 'number' && data.max_score > 0
              ? (data.score / data.max_score) * 100
              : 0;

          const rawAssignedBand =
            data.assigned_age_band ||
            data.recommended_age_band ||
            user?.age_band ||
            '11-15';

          const rawCorrect =
            data.correct_count !== undefined && data.correct_count !== null
              ? data.correct_count
              : typeof data.score === 'number'
              ? Math.round(data.score)
              : 0;

          const rawTotal =
            data.total_questions !== undefined && data.total_questions !== null
              ? data.total_questions
              : typeof data.max_score === 'number'
              ? Math.round(data.max_score)
              : 10;

          setDiagnosticResult({
            ...data,
            percentage: Math.round(rawPercentage),
            score_percentage: Math.round(rawPercentage),
            assigned_age_band: rawAssignedBand,
            recommended_age_band: rawAssignedBand,
            progression_age_band: data.progression_age_band || '',
            correct_count: rawCorrect,
            total_questions: rawTotal,
            score: data.score ?? rawCorrect,
            max_score: data.max_score ?? rawTotal,
          });

          // Sync AuthContext profile so top header badge matches placed batch
          if (refreshProfile && rawAssignedBand) {
            if (getStudentGroupName(user?.age_band) !== getStudentGroupName(rawAssignedBand)) {
              refreshProfile();
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch diagnostic result:', err);
    }
  };

  useEffect(() => {
    fetchCourses();
    fetchLatestDiagnostic();
  }, [token, user?.student_id]);

  const enrolledCourses = courses.filter((c) => c.is_enrolled);

  // Recommended courses base band
  const recommendedBand = diagnosticResult?.assigned_age_band || user?.age_band || '';

  // All Available Courses displays all courses from the database, highlighting the student's batch with "★ Best Match"
  const groupCourses = courses;

  const standardSubjects = ['Language Arts', 'Science', 'Biology', 'Mathematics'];
  const subjects = ['all', ...Array.from(new Set([...groupCourses.map((c) => c.subject), ...standardSubjects])).filter(Boolean)];
  const activeSubject = subjects.includes(selectedSubjectFilter) ? selectedSubjectFilter : 'all';
  const subjectFilteredCourses = activeSubject === 'all'
    ? groupCourses
    : groupCourses.filter((c) => c.subject === activeSubject);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredExploreCourses = subjectFilteredCourses.filter((c) => {
    if (!normalizedQuery) return true;
    const title = (c.title || '').toLowerCase();
    const desc = (c.description || '').toLowerCase();
    const subj = (c.subject || '').toLowerCase();
    const teacher = (c.teacher_name || '').toLowerCase();
    return title.includes(normalizedQuery) || desc.includes(normalizedQuery) || subj.includes(normalizedQuery) || teacher.includes(normalizedQuery);
  });

  const filteredEnrolledCourses = enrolledCourses.filter((c) => {
    if (!normalizedQuery) return true;
    const title = (c.title || '').toLowerCase();
    const desc = (c.description || '').toLowerCase();
    const subj = (c.subject || '').toLowerCase();
    const teacher = (c.teacher_name || '').toLowerCase();
    return title.includes(normalizedQuery) || desc.includes(normalizedQuery) || subj.includes(normalizedQuery) || teacher.includes(normalizedQuery);
  });

  return (
    <div id="courses-section">
      {/* Navigation Tabs on Left + Persistent Search Bar on Right (Same Line / Same X-Axis) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1.5px solid var(--border-subtle, #e2e8f0)',
          marginBottom: 'var(--space-6)',
          flexWrap: 'wrap',
          gap: 'var(--space-3)',
        }}
      >
        <div style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setActiveTab('explore')}
            style={{
              padding: '10px 4px 12px 4px',
              fontSize: '1rem',
              fontWeight: activeTab === 'explore' ? 700 : 600,
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'explore' ? '3px solid var(--primary, #0f766e)' : '3px solid transparent',
              color: activeTab === 'explore' ? 'var(--primary, #0f766e)' : 'var(--text-secondary, #64748b)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.15s ease',
            }}
          >
            <span>🔍</span> Explore Courses
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('my_courses')}
            style={{
              padding: '10px 4px 12px 4px',
              fontSize: '1rem',
              fontWeight: activeTab === 'my_courses' ? 700 : 600,
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'my_courses' ? '3px solid var(--primary, #0f766e)' : '3px solid transparent',
              color: activeTab === 'my_courses' ? 'var(--primary, #0f766e)' : 'var(--text-secondary, #64748b)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.15s ease',
            }}
          >
            <span>📚</span> My Courses ({enrolledCourses.length})
          </button>
        </div>

        {/* Unified Search Input for Both Sections */}
        <div style={{ position: 'relative', width: '100%', maxWidth: '340px', paddingBottom: '6px' }}>
          <span style={{ position: 'absolute', left: '14px', top: 'calc(50% - 3px)', transform: 'translateY(-50%)', color: '#64748b', fontSize: '0.9375rem', pointerEvents: 'none' }}>
            🔍
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={activeTab === 'explore' ? 'Search courses by title or description...' : 'Search your enrolled courses...'}
            aria-label="Search courses"
            style={{
              width: '100%',
              padding: '8px 36px 8px 38px',
              fontSize: '0.875rem',
              borderRadius: '9999px',
              border: '1.5px solid #cbd5e1',
              outline: 'none',
              background: '#ffffff',
              color: '#0f172a',
              transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#0f766e';
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(15, 118, 110, 0.15)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#cbd5e1';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              style={{
                position: 'absolute',
                right: '12px',
                top: 'calc(50% - 3px)',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                fontSize: '0.875rem',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: EXPLORE COURSES */}
      {/* ============================================================== */}
      {activeTab === 'explore' && (
        <div>
          {/* Controls Bar: Title on Left, Subject Filter Pills on Right */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            <div>
              <h2 style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--text-primary, #0f172a)', margin: 0 }}>
                All Available Courses
              </h2>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary, #64748b)', marginTop: '4px' }}>
                {filteredExploreCourses.length} {filteredExploreCourses.length === 1 ? 'course' : 'courses'} found
              </div>
            </div>

            {/* Subject Filter Pills */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              {subjects.map((subj) => {
                const isActive = selectedSubjectFilter === subj;
                return (
                  <button
                    key={subj}
                    type="button"
                    onClick={() => setSelectedSubjectFilter(subj)}
                    style={{
                      padding: '6px 16px',
                      fontSize: '0.8125rem',
                      fontWeight: isActive ? 600 : 500,
                      borderRadius: '9999px',
                      cursor: 'pointer',
                      border: isActive ? 'none' : '1px solid var(--border-subtle, #e2e8f0)',
                      background: isActive ? 'var(--primary, #0f766e)' : '#ffffff',
                      color: isActive ? '#ffffff' : 'var(--text-primary, #334155)',
                      transition: 'all 0.15s ease',
                      boxShadow: isActive ? '0 2px 6px rgba(15, 118, 110, 0.25)' : 'none',
                    }}
                  >
                    {subj === 'all' ? 'All Subjects' : subj}
                  </button>
                );
              })}
            </div>
          </div>

          {loadingCourses ? (
            <LoadingScreen
              preset="loadingCurriculum"
              title="Loading Your Courses & Subjects..."
              subtitle="Fetching tailored courses matching your age band and accommodations..."
              variant="card"
            />
          ) : filteredExploreCourses.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🔍</div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '6px' }}>
                {searchQuery ? `No courses found matching "${searchQuery}"` : 'No courses match your filter.'}
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '16px' }}>
                Try searching with different keywords or clear your active filters.
              </p>
              {(searchQuery || selectedSubjectFilter !== 'all') && (
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedSubjectFilter('all');
                  }}
                  style={{ padding: '8px 16px', fontSize: '0.875rem' }}
                >
                  Clear All Filters ↻
                </button>
              )}
            </div>
          ) : (
            <div className="courses-cards-grid">
              {filteredExploreCourses.map((c) => {
                const isRecommended =
                  c.age_band_code === recommendedBand ||
                  c.age_band_code === diagnosticResult?.progression_age_band;

                return (
                  <div
                    key={c.id}
                    className="course-card-item"
                    onClick={() => {
                      if (c.is_enrolled) {
                        onEnterCourse(c.id);
                      } else {
                        setSelectedCourseForEnroll(c);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        if (c.is_enrolled) {
                          onEnterCourse(c.id);
                        } else {
                          setSelectedCourseForEnroll(c);
                        }
                      }
                    }}
                  >
                    <div>
                      {/* Top Badges Row */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', minHeight: '26px' }}>
                        <span
                          style={{
                            background: '#ccfbf1',
                            color: '#0f766e',
                            padding: '3px 12px',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                          }}
                        >
                          {c.subject}
                        </span>
                        {isRecommended && (
                          <span
                            style={{
                              background: '#0f766e',
                              color: '#ffffff',
                              padding: '3px 12px',
                              borderRadius: '9999px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            ★ Best Match
                          </span>
                        )}
                      </div>

                      {/* Batch Track Badge */}
                      <div style={{ marginBottom: '10px' }}>
                        <span
                          style={{
                            background: '#f1f5f9',
                            color: '#475569',
                            padding: '2px 10px',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            display: 'inline-block',
                          }}
                        >
                          {formatStudentTrack(c.age_band_label || c.age_band_code)}
                        </span>
                      </div>

                      {/* Course Title */}
                      <h3 style={{ fontSize: '1.1875rem', fontWeight: 700, color: '#0f172a', margin: '0 0 8px 0', lineHeight: 1.3 }}>
                        {c.title}
                      </h3>

                      {/* Course Description */}
                      <p style={{ color: '#475569', fontSize: '0.875rem', lineHeight: 1.5, margin: '0 0 16px 0', flex: 1, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {c.description || 'Learn key concepts with friendly lessons, spoken audio hints, and daily practice.'}
                      </p>
                    </div>

                    {/* Card Footer: Teacher on Left, Price on Right */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                      <span style={{ color: '#64748b' }}>
                        Teacher: <strong style={{ color: '#0f172a' }}>{c.teacher_name}</strong>
                      </span>
                      <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9375rem' }}>
                        {c.fee > 0 ? `$${c.fee.toFixed(2)}` : 'Free'}
                      </span>
                    </div>

                    {/* Action Button */}
                    <div style={{ marginTop: '12px' }}>
                      {c.is_enrolled ? (
                        <button
                          type="button"
                          className="button-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEnterCourse(c.id);
                          }}
                          style={{
                            width: '100%',
                            padding: '9px 12px',
                            justifyContent: 'center',
                            fontSize: '0.9375rem',
                            fontWeight: 600,
                          }}
                        >
                          Enter Course Room →
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="button-secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCourseForEnroll(c);
                          }}
                          style={{
                            width: '100%',
                            padding: '9px 12px',
                            justifyContent: 'center',
                            fontSize: '0.9375rem',
                            fontWeight: 600,
                          }}
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
          {/* Section Header */}
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <h2 style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--text-primary, #0f172a)', margin: 0 }}>
              Courses You Are Enrolled In
            </h2>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary, #64748b)', marginTop: '4px' }}>
              {filteredEnrolledCourses.length} {filteredEnrolledCourses.length === 1 ? 'course' : 'courses'} enrolled
            </div>
          </div>

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
          ) : filteredEnrolledCourses.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🔍</div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '6px' }}>
                No enrolled courses found matching "{searchQuery}"
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '16px' }}>
                Try searching for a different keyword or clear your search to view all courses.
              </p>
              <button
                type="button"
                className="button-secondary"
                onClick={() => setSearchQuery('')}
                style={{ padding: '8px 16px', fontSize: '0.875rem' }}
              >
                Clear Search ↻
              </button>
            </div>
          ) : (
            <div className="courses-cards-grid">
              {filteredEnrolledCourses.map((c) => {
                const isRecommended =
                  c.age_band_code === recommendedBand ||
                  c.age_band_code === diagnosticResult?.progression_age_band;

                return (
                  <div
                    key={c.id}
                    className="course-card-item"
                    onClick={() => onEnterCourse(c.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onEnterCourse(c.id);
                      }
                    }}
                  >
                    <div>
                      {/* Top status row: Enrolled badge on left, Best Match badge on right */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', minHeight: '26px' }}>
                        <span
                          style={{
                            background: '#059669',
                            color: '#ffffff',
                            padding: '3px 12px',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                          }}
                        >
                          Enrolled
                        </span>
                        {isRecommended && (
                          <span
                            style={{
                              background: '#0f766e',
                              color: '#ffffff',
                              padding: '3px 12px',
                              borderRadius: '9999px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            ★ Best Match
                          </span>
                        )}
                      </div>

                      {/* Course classification row: Subject and Batch Track */}
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            background: '#ccfbf1',
                            color: '#0f766e',
                            padding: '3px 12px',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                          }}
                        >
                          {c.subject}
                        </span>
                        <span
                          style={{
                            background: '#f1f5f9',
                            color: '#475569',
                            padding: '2px 10px',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                          }}
                        >
                          {formatStudentTrack(c.age_band_label || c.age_band_code)}
                        </span>
                      </div>

                      <h3 style={{ fontSize: '1.1875rem', fontWeight: 700, color: '#0f172a', margin: '0 0 8px 0', lineHeight: 1.3 }}>
                        {c.title}
                      </h3>
                      <p style={{ color: '#475569', fontSize: '0.875rem', lineHeight: 1.5, margin: '0 0 16px 0', flex: 1, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {c.description || 'Watch lessons, take daily practice with AI speech hints, and complete chapter tests.'}
                      </p>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                      <span style={{ color: '#64748b' }}>
                        Teacher: <strong style={{ color: '#0f172a' }}>{c.teacher_name}</strong>
                      </span>
                      <span style={{ color: '#0f766e', fontWeight: 700 }}>
                        {c.chapters_count || 1} {c.chapters_count === 1 ? 'Chapter' : 'Chapters'}
                      </span>
                    </div>

                    {/* Action Button */}
                    <div style={{ marginTop: '12px' }}>
                      <button
                        type="button"
                        className="button-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEnterCourse(c.id);
                        }}
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          justifyContent: 'center',
                          fontSize: '0.9375rem',
                          fontWeight: 600,
                        }}
                      >
                        Enter Course Room →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
