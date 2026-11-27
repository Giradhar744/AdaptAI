import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { LoadingScreen } from '../../components/LoadingScreen';
import { formatStudentTrack } from '../../utils/studentGroup';

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
  dpp_id?: string | null;
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

function getEmbedUrl(rawUrl: string | null | undefined): {
  type: 'youtube' | 'vimeo' | 'html5' | 'none';
  embedUrl?: string;
} {
  if (!rawUrl) return { type: 'none' };

  let trimmed = rawUrl.trim();
  if (trimmed.startsWith('//')) {
    trimmed = `https:${trimmed}`;
  } else if (
    trimmed.startsWith('www.') ||
    trimmed.startsWith('youtube.com') ||
    trimmed.startsWith('youtu.be')
  ) {
    trimmed = `https://${trimmed}`;
  }

  // YouTube match: standard watch, youtu.be short, embed, shorts
  const ytMatch = trimmed.match(
    /(?:youtube(?:-nocookie)?\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i
  );
  if (ytMatch && ytMatch[1]) {
    return {
      type: 'youtube',
      embedUrl: `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?autoplay=0&rel=0&modestbranding=1&iv_load_policy=3&playsinline=1&enablejsapi=1`,
    };
  }

  // Vimeo match
  const vimeoMatch = trimmed.match(/(?:vimeo\.com\/)(\d+)/i);
  if (vimeoMatch && vimeoMatch[1]) {
    return {
      type: 'vimeo',
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
    };
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/')) {
    return { type: 'html5', embedUrl: trimmed };
  }

  return { type: 'none' };
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
  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});
  const exercisesSectionRef = React.useRef<HTMLDivElement>(null);

  // Auto-expand the active chapter whenever course or activeChapterIndex updates
  useEffect(() => {
    if (course?.chapters && course.chapters.length > 0) {
      const activeCh = course.chapters[activeChapterIndex];
      if (activeCh && expandedChapters[activeCh.id] === undefined) {
        setExpandedChapters((prev) => ({
          ...prev,
          [activeCh.id]: true,
        }));
      }
    }
  }, [course, activeChapterIndex]);

  const toggleChapter = (chapterId: string, idx: number) => {
    setExpandedChapters((prev) => ({
      ...prev,
      [chapterId]: !prev[chapterId],
    }));
    setActiveChapterIndex(idx);
  };

  const handleScrollToExercises = () => {
    if (exercisesSectionRef.current) {
      exercisesSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
      } else {
        console.error('Failed to fetch course details:', res.status, res.statusText);
      }
    } catch (err) {
      console.error('Error fetching course details from database:', err);
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
      <div style={{ padding: 'var(--space-8) 0' }}>
        <LoadingScreen
          preset="loadingCurriculum"
          title="Opening Course Study Room..."
          subtitle="Loading chapter lectures, video lessons, and practice materials..."
          variant="card"
        />
      </div>
    );
  }

  if (!course) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
        <p style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>
          Could not load course details.
        </p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button type="button" className="button-primary" onClick={fetchCourse} style={{ padding: '8px 18px' }}>
            Retry ↻
          </button>
          <button type="button" className="button-secondary" onClick={onBackToCourses} style={{ padding: '8px 18px' }}>
            ← Back to My Courses
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', margin: '0 auto', padding: 'var(--space-4) 0' }}>
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
          borderRadius: '16px',
          border: '1px solid var(--border-subtle, #e2e8f0)',
          background: 'var(--bg-surface-elevated, #ffffff)',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
          padding: '24px 28px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <span className="brand-badge" style={{ marginBottom: 'var(--space-2)' }}>
              {course.subject} · {formatStudentTrack(course.age_band_label)}
            </span>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 'var(--space-1) 0 var(--space-2) 0' }}>
              {course.title}
            </h1>
            {course.description && (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', margin: 0, lineHeight: '1.6', maxWidth: '720px' }}>
                {course.description}
              </p>
            )}
          </div>

          {/* Top-Right Quick Jump to Test Section */}
          <button
            type="button"
            onClick={handleScrollToExercises}
            className="button-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 18px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#1e293b',
              fontWeight: 700,
              fontSize: '0.875rem',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
              transition: 'all 0.15s ease',
            }}
            title="Jump to Chapter Exercises & Assessment"
          >
            <span style={{ fontSize: '1.125rem' }}>⏱️</span>
            <span>Chapter Test & Practice</span>
          </button>
        </div>
      </div>

      {actionMessage && (
        <div
          role="status"
          style={{
            padding: '12px 18px',
            marginBottom: 'var(--space-4)',
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#059669',
            borderRadius: '10px',
            fontWeight: 600,
            fontSize: '0.9375rem',
          }}
        >
          ✨ {actionMessage}
        </div>
      )}

      {/* Main Course Study Grid (Decreased Video Size, Increased Chapters Sidebar) */}
      <div className="study-room-grid">
        {/* Left: Video Player & Practice / Test Hub */}
        <div>
          {activeLecture ? (
            <div
              className="card"
              style={{
                padding: 0,
                overflow: 'hidden',
                marginBottom: 'var(--space-6)',
                borderRadius: '16px',
                border: '1px solid var(--border-subtle, #e2e8f0)',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
              }}
            >
              {/* Video Player */}
              <div
                style={{
                  width: '100%',
                  aspectRatio: '16 / 9',
                  maxHeight: '440px',
                  background: '#090d16',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}
              >
                {(() => {
                  const media = getEmbedUrl(activeLecture.playback_url || activeLecture.video_ref);
                  if (media.type === 'youtube' || media.type === 'vimeo') {
                    return (
                      <iframe
                        key={media.embedUrl}
                        src={media.embedUrl}
                        title={activeLecture.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        style={{
                          width: '100%',
                          height: '100%',
                          border: 'none',
                        }}
                      />
                    );
                  }
                  if (media.type === 'html5' && media.embedUrl) {
                    return (
                      <video
                        key={media.embedUrl}
                        controls
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        src={media.embedUrl}
                      >
                        Your browser does not support HTML5 video.
                      </video>
                    );
                  }
                  return (
                    <div style={{ textAlign: 'center', color: '#94a3b8', padding: 'var(--space-6)' }}>
                      <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-2)' }}>📺</div>
                      <div style={{ fontWeight: 600, color: '#f8fafc' }}>{activeLecture.title}</div>
                      <div style={{ fontSize: '0.8125rem', marginTop: 'var(--space-1)' }}>
                        Lesson video loaded and ready to play.
                      </div>
                    </div>
                  );
                })()}
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
            <div
              ref={exercisesSectionRef}
              id="chapter-exercises-section"
              className="card"
              style={{
                borderRadius: '16px',
                border: '1px solid var(--border-subtle, #e2e8f0)',
                background: 'var(--bg-surface-elevated, #ffffff)',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                padding: '24px 28px',
                scrollMarginTop: '24px',
              }}
            >
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
                    Solve 3-choice questions with real-time text and speech hints tailored to your learning needs.
                  </p>
                  {(() => {
                    const availableDppId = activeLecture?.dpp_id || activeChapter?.dpp_id;
                    if (availableDppId) {
                      return (
                        <button
                          type="button"
                          className="button-primary"
                          onClick={() =>
                            onLaunchPractice(
                              availableDppId,
                              activeChapter?.id,
                              activeChapter?.title,
                              course?.title
                            )
                          }
                          style={{ width: '100%', padding: '8px' }}
                        >
                          Start Practice Session →
                        </button>
                      );
                    }
                    return (
                      <div
                        style={{
                          padding: '10px 14px',
                          background: 'var(--bg-surface-elevated, #f8fafc)',
                          borderRadius: 'var(--radius-md, 8px)',
                          border: '1px solid var(--border-subtle, #e2e8f0)',
                          color: 'var(--text-secondary, #64748b)',
                          fontSize: '0.8125rem',
                          textAlign: 'center',
                        }}
                      >
                        📝 Practice questions will be published by your teacher soon.
                      </div>
                    );
                  })()}
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

        {/* Right Sidebar: Chapter & Lesson Tree Navigation (Accordion Hierarchy) */}
        <div>
          <div
            className="card"
            style={{
              padding: '24px',
              borderRadius: '16px',
              border: '1px solid var(--border-subtle, #e2e8f0)',
              background: 'var(--bg-surface-elevated, #ffffff)',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <h2 style={{ fontSize: '1.1875rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Course Chapters
              </h2>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary, #64748b)', fontWeight: 600 }}>
                {course.chapters.length} {course.chapters.length === 1 ? 'Chapter' : 'Chapters'}
              </span>
            </div>

            {course.chapters.length === 0 ? (
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                No chapters added to this course yet.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {course.chapters.map((ch, idx) => {
                  const isCurrent = idx === activeChapterIndex;
                  const isExpanded = expandedChapters[ch.id] ?? (isCurrent || idx === 0);
                  const hasLectures = Boolean(ch.lectures && ch.lectures.length > 0);

                  return (
                    <div key={ch.id} style={{ display: 'flex', flexDirection: 'column' }}>
                      {/* Chapter Row Header */}
                      <button
                        type="button"
                        onClick={() => {
                          if (hasLectures) {
                            toggleChapter(ch.id, idx);
                          } else {
                            setActiveChapterIndex(idx);
                          }
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '10px',
                          border: isCurrent ? '1px solid var(--border-subtle, #e2e8f0)' : '1px solid transparent',
                          background: isCurrent ? 'rgba(13, 148, 136, 0.06)' : 'transparent',
                          color: isCurrent ? 'var(--primary, #0d9488)' : 'var(--text-primary)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.15s ease',
                          gap: '10px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                          {hasLectures && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '18px',
                                height: '18px',
                                color: isExpanded ? 'var(--primary, #0d9488)' : '#64748b',
                                flexShrink: 0,
                              }}
                            >
                              {isExpanded ? (
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="6 9 12 15 18 9" />
                                </svg>
                              ) : (
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="9 18 15 12 9 6" />
                                </svg>
                              )}
                            </span>
                          )}
                          <span style={{ fontWeight: 700, fontSize: '0.9375rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {idx + 1}. {ch.title}
                          </span>
                        </div>

                        <span
                          style={{
                            fontSize: '0.75rem',
                            color: '#64748b',
                            background: 'rgba(0, 0, 0, 0.04)',
                            padding: '2px 8px',
                            borderRadius: '9999px',
                            flexShrink: 0,
                            fontWeight: 600,
                          }}
                        >
                          {ch.lectures.length} {ch.lectures.length === 1 ? 'lesson' : 'lessons'}
                        </span>
                      </button>

                      {/* Tree Branch Line with Nested Lessons (Matches Image 1) */}
                      {isExpanded && ch.lectures.length > 0 && (
                        <div
                          style={{
                            marginLeft: '20px',
                            paddingLeft: '14px',
                            borderLeft: '1.5px solid var(--border-subtle, #cbd5e1)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            marginTop: '4px',
                            marginBottom: '8px',
                          }}
                        >
                          {ch.lectures.map((lec, lIdx) => {
                            const isLecActive = isCurrent && lec.id === activeLectureId;
                            return (
                              <button
                                key={lec.id}
                                type="button"
                                onClick={() => {
                                  setActiveChapterIndex(idx);
                                  setActiveLectureId(lec.id);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  width: '100%',
                                  padding: '8px 12px',
                                  borderRadius: '8px',
                                  border: isLecActive ? '1px solid var(--primary, #0d9488)' : '1px solid transparent',
                                  background: isLecActive ? 'var(--primary, #0d9488)' : 'transparent',
                                  color: isLecActive ? '#ffffff' : 'var(--text-secondary, #475569)',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  transition: 'all 0.15s ease',
                                  gap: '10px',
                                  boxShadow: isLecActive ? '0 2px 6px rgba(13, 148, 136, 0.2)' : 'none',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                                  <span
                                    style={{
                                      fontSize: '0.875rem',
                                      fontWeight: isLecActive ? 700 : 500,
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    Lesson {lIdx + 1}: {lec.title}
                                  </span>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                  {lec.is_completed ? (
                                    <span style={{ color: isLecActive ? '#ffffff' : '#059669', fontSize: '0.875rem', fontWeight: 800 }}>✓</span>
                                  ) : (
                                    <span style={{ fontSize: '0.75rem', opacity: isLecActive ? 0.95 : 0.6, fontWeight: 600 }}>
                                      {Math.max(1, Math.round(lec.duration_seconds / 60))}m
                                    </span>
                                  )}
                                </div>
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
