import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

interface Lecture {
  id: string;
  chapter_id: string;
  title: string;
  video_ref: string;
  playback_url?: string | null;
  duration_seconds: number;
  dpp_id?: string | null;
  is_completed: boolean;
}

interface Chapter {
  id: string;
  course_id: string;
  title: string;
  position: number;
  lectures: Lecture[];
  dpp_completed: boolean;
  test_unlocked: boolean;
  chapter_test_id?: string | null;
}

interface CourseDetail {
  id: string;
  title: string;
  subject: string;
  age_band_label: string;
  description?: string;
  fee: number;
  chapters: Chapter[];
}

interface CourseStudyRoomProps {
  courseId: string;
  onBackToCourses: () => void;
  onLaunchPractice: (dppId?: string, chapterId?: string, chapterTitle?: string, courseTitle?: string) => void;
  onLaunchTest: (testId?: string, chapterTitle?: string, courseTitle?: string) => void;
}

export const CourseStudyRoom: React.FC<CourseStudyRoomProps> = ({
  courseId,
  onBackToCourses,
  onLaunchPractice,
  onLaunchTest,
}) => {
  const { token } = useAuth();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);
  const [activeLectureId, setActiveLectureId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [generatingDpp, setGeneratingDpp] = useState(false);

  const handleGenerateDppForActiveLecture = async () => {
    if (!activeLecture) return;
    setGeneratingDpp(true);
    setActionMessage('✨ AI is creating 4-choice practice questions for this lesson...');
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/v1/lectures/${activeLecture.id}/dpp/generate`, {
        method: 'POST',
        headers,
      });

      if (res.ok) {
        const dpp = await res.json();
        setActionMessage('Practice questions ready! Launching your session...');
        await fetchCourse();
        setTimeout(() => {
          setActionMessage(null);
          onLaunchPractice(dpp.id, activeChapter?.id, activeChapter?.title, course?.title);
        }, 1200);
      } else {
        const err = await res.json().catch(() => ({}));
        setActionMessage(err.detail || 'Starting standard practice session...');
        setTimeout(() => {
          onLaunchPractice(undefined, activeChapter?.id, activeChapter?.title, course?.title);
        }, 1200);
      }
    } catch {
      onLaunchPractice(undefined, activeChapter?.id, activeChapter?.title, course?.title);
    } finally {
      setGeneratingDpp(false);
    }
  };

  const fetchCourse = async () => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/v1/courses/${courseId}`, { headers });
      if (res.ok) {
        const data: CourseDetail = await res.json();
        setCourse(data);
        if (data.chapters && data.chapters.length > 0) {
          const firstChapter = data.chapters[0];
          if (firstChapter.lectures && firstChapter.lectures.length > 0) {
            setActiveLectureId(firstChapter.lectures[0].id);
          }
        }
      }
    } catch {
      // Fallback course structure if offline/demo
      setCourse({
        id: courseId,
        title: 'Natural Sciences & Cell Biology',
        subject: 'Biology',
        age_band_label: 'Ages 11–15',
        description: 'Explore the building blocks of life, cellular structure, and energy transport with calm, sensory-friendly visual guides.',
        fee: 0,
        chapters: [
          {
            id: 'ch-sample-1',
            course_id: courseId,
            title: 'Chapter 1: The Architecture of Living Cells',
            position: 1,
            lectures: [
              {
                id: 'lec-1',
                chapter_id: 'ch-sample-1',
                title: 'Introduction to Plant and Animal Cells',
                video_ref: 'sample-video-001',
                playback_url: 'https://www.w3schools.com/html/mov_bbb.mp4',
                duration_seconds: 420,
                dpp_id: 'dpp-sample-001',
                is_completed: false,
              },
            ],
            dpp_completed: false,
            test_unlocked: false,
            chapter_test_id: 'test-sample-001',
          },
        ],
      });
      setActiveLectureId('lec-1');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourse();
  }, [courseId, token]);

  const activeChapter = course?.chapters?.[activeChapterIndex];
  const activeLecture = activeChapter?.lectures?.find((l) => l.id === activeLectureId) || activeChapter?.lectures?.[0];

  const handleMarkLessonDone = async (chapterId: string, lectureId: string) => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/v1/chapters/${chapterId}/lectures/complete`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ lecture_id: lectureId }),
      });

      if (res.ok) {
        setActionMessage('Great job! You finished this lesson.');
        setTimeout(() => setActionMessage(null), 3500);
        await fetchCourse();
      }
    } catch {
      // Optimistic update
      if (course) {
        setCourse({
          ...course,
          chapters: course.chapters.map((ch) =>
            ch.id === chapterId
              ? {
                  ...ch,
                  lectures: ch.lectures.map((lec) =>
                    lec.id === lectureId ? { ...lec, is_completed: true } : lec
                  ),
                }
              : ch
          ),
        });
        setActionMessage('Great job! You finished this lesson.');
        setTimeout(() => setActionMessage(null), 3500);
      }
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-12) var(--space-4)' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Opening your course study space...</p>
      </div>
    );
  }

  if (!course) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
        <p>Could not load course details.</p>
        <button type="button" className="button-secondary" onClick={onBackToCourses}>
          ← Back to My Courses
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1040px', margin: '0 auto', padding: 'var(--space-4) 0' }}>
      {/* Top Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <button
          type="button"
          onClick={onBackToCourses}
          className="button-secondary"
          style={{ padding: '0.4rem 0.8rem', fontSize: '0.875rem' }}
        >
          ← Return to My Courses
        </button>
        <span className="brand-badge" style={{ background: '#059669', color: '#ffffff' }}>
          Enrolled Learner
        </span>
      </div>

      {/* Course Banner */}
      <div
        className="card"
        style={{
          marginBottom: 'var(--space-6)',
          borderLeft: '6px solid var(--primary)',
          background: 'linear-gradient(135deg, rgba(13, 148, 136, 0.05) 0%, rgba(99, 102, 241, 0.05) 100%)',
        }}
      >
        <span className="brand-badge" style={{ marginBottom: 'var(--space-2)' }}>
          {course.subject} · {course.age_band_label}
        </span>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 'var(--space-1) 0 var(--space-2) 0' }}>
          {course.title}
        </h1>
        {course.description && (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', margin: 0, lineHeight: '1.6' }}>
            {course.description}
          </p>
        )}
      </div>

      {actionMessage && (
        <div
          role="status"
          style={{
            padding: 'var(--space-3) var(--space-4)',
            marginBottom: 'var(--space-4)',
            background: 'rgba(5, 150, 105, 0.1)',
            borderLeft: '4px solid #059669',
            color: '#059669',
            borderRadius: 'var(--radius-sm)',
            fontWeight: 600,
            fontSize: '0.9375rem',
          }}
        >
          ✨ {actionMessage}
        </div>
      )}

      {/* Main Course Study Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 'var(--space-6)', alignItems: 'start' }}>
        {/* Left: Video Player & Practice / Test Hub */}
        <div>
          {activeLecture ? (
            <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 'var(--space-6)' }}>
              {/* Video Player */}
              <div
                style={{
                  width: '100%',
                  aspectRatio: '16 / 9',
                  background: '#090d16',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}
              >
                {activeLecture.playback_url ? (
                  <video
                    key={activeLecture.playback_url}
                    controls
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    src={activeLecture.playback_url}
                  >
                    Your browser does not support HTML5 video.
                  </video>
                ) : (
                  <div style={{ textAlign: 'center', color: '#94a3b8', padding: 'var(--space-6)' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-2)' }}>📺</div>
                    <div style={{ fontWeight: 600, color: '#f8fafc' }}>{activeLecture.title}</div>
                    <div style={{ fontSize: '0.8125rem', marginTop: 'var(--space-1)' }}>
                      Lesson video loaded and ready to play.
                    </div>
                  </div>
                )}
              </div>

              {/* Lesson Details & Completion Trigger */}
              <div style={{ padding: 'var(--space-5)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                  <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 var(--space-1) 0' }}>
                      {activeLecture.title}
                    </h2>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                      Duration: ~{Math.max(1, Math.round(activeLecture.duration_seconds / 60))} minutes
                    </span>
                  </div>

                  {activeLecture.is_completed ? (
                    <span
                      style={{
                        padding: '6px 14px',
                        background: 'rgba(5, 150, 105, 0.15)',
                        color: '#059669',
                        borderRadius: 'var(--radius-sm)',
                        fontWeight: 700,
                        fontSize: '0.875rem',
                      }}
                    >
                      ✓ Lesson Finished
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="button-primary"
                      onClick={() => handleMarkLessonDone(activeChapter!.id, activeLecture.id)}
                      style={{ padding: '8px 16px', fontSize: '0.875rem' }}
                    >
                      ✓ Mark Lesson Done
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)', marginBottom: 'var(--space-6)' }}>
              <p style={{ color: 'var(--text-secondary)' }}>Select a lesson from the list on the right to start watching.</p>
            </div>
          )}

          {/* Interactive Chapter Exercises Card */}
          {activeChapter && (
            <div className="card" style={{ borderTop: '4px solid #6366f1' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
                Chapter Exercises & Assessment
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 'var(--space-4)' }}>
                Practice questions with helpful hints, then take your timed chapter test to demonstrate your learning.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--space-4)' }}>
                {/* 1. Daily Practice Problem (DPP) */}
                <div
                  style={{
                    padding: 'var(--space-4)',
                    background: 'var(--surface-sunken)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                    <span style={{ fontSize: '1.25rem' }}>📖</span>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
                      Practice Questions (DPP)
                    </h3>
                  </div>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)', minHeight: '38px' }}>
                    Solve 4-choice questions with real-time text and speech hints tailored to your learning needs.
                  </p>
                  {activeLecture?.dpp_id ? (
                    <button
                      type="button"
                      className="button-primary"
                      onClick={() =>
                        onLaunchPractice(
                          activeLecture.dpp_id || undefined,
                          activeChapter.id,
                          activeChapter.title,
                          course.title
                        )
                      }
                      style={{ width: '100%', padding: '8px' }}
                    >
                      Start Practice Session →
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="button-primary"
                      disabled={generatingDpp}
                      onClick={handleGenerateDppForActiveLecture}
                      style={{
                        width: '100%',
                        padding: '8px',
                        background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                      }}
                    >
                      {generatingDpp ? '✨ AI Generating Questions...' : '✨ Generate DPP for this Lesson →'}
                    </button>
                  )}
                </div>

                {/* 2. Timed Chapter Test */}
                <div
                  style={{
                    padding: 'var(--space-4)',
                    background: 'var(--surface-sunken)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                    <span style={{ fontSize: '1.25rem' }}>⏱️</span>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
                      Timed Chapter Test
                    </h3>
                  </div>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)', minHeight: '38px' }}>
                    Server-timed assessment. Your first attempt helps your teacher evaluate the course.
                  </p>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() =>
                      onLaunchTest(
                        activeChapter.chapter_test_id || undefined,
                        activeChapter.title,
                        course.title
                      )
                    }
                    style={{ width: '100%', padding: '8px' }}
                  >
                    Take Chapter Test →
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar: Chapter & Lesson List */}
        <div>
          <div className="card">
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: 'var(--space-3)' }}>
              Course Chapters
            </h2>

            {course.chapters.length === 0 ? (
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                No chapters added to this course yet.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {course.chapters.map((ch, idx) => {
                  const isCurrent = idx === activeChapterIndex;
                  return (
                    <div
                      key={ch.id}
                      style={{
                        borderRadius: 'var(--radius-sm)',
                        border: isCurrent ? '2px solid var(--primary)' : '1px solid var(--border-subtle)',
                        background: isCurrent ? 'rgba(13, 148, 136, 0.05)' : 'var(--surface-sunken)',
                        padding: 'var(--space-3)',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setActiveChapterIndex(idx);
                          if (ch.lectures.length > 0) {
                            setActiveLectureId(ch.lectures[0].id);
                          }
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          width: '100%',
                          textAlign: 'left',
                          cursor: 'pointer',
                          padding: 0,
                          fontWeight: 700,
                          fontSize: '0.875rem',
                          color: isCurrent ? 'var(--primary)' : 'var(--text-primary)',
                        }}
                      >
                        {idx + 1}. {ch.title}
                      </button>

                      {/* Lectures under active chapter */}
                      {isCurrent && ch.lectures.length > 0 && (
                        <div style={{ marginTop: 'var(--space-2)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {ch.lectures.map((lec, lIdx) => {
                            const isLecActive = lec.id === activeLectureId;
                            return (
                              <button
                                key={lec.id}
                                type="button"
                                onClick={() => setActiveLectureId(lec.id)}
                                style={{
                                  background: isLecActive ? 'var(--primary)' : 'transparent',
                                  color: isLecActive ? '#ffffff' : 'var(--text-secondary)',
                                  border: 'none',
                                  borderRadius: 'var(--radius-sm)',
                                  padding: '5px 8px',
                                  fontSize: '0.8125rem',
                                  textAlign: 'left',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                }}
                              >
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  Lesson {lIdx + 1}: {lec.title}
                                </span>
                                {lec.is_completed && <span>✓</span>}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourseStudyRoom;
