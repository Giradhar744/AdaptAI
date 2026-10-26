import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { QuestionReviewModal } from './QuestionReviewModal';

interface Lecture {
  id: string;
  chapter_id: string;
  title: string;
  video_ref: string;
  playback_url?: string | null;
  duration_seconds: number;
  dpp_id?: string | null;
  is_completed?: boolean;
}

interface Chapter {
  id: string;
  course_id: string;
  title: string;
  position: number;
  lectures: Lecture[];
  chapter_test_id?: string | null;
}

interface CourseSummary {
  id: string;
  title: string;
  subject: string;
  age_band_code: string;
  age_band_label: string;
  chapters_count: number;
  description?: string;
  fee: number;
}

interface CourseDetail extends CourseSummary {
  chapters: Chapter[];
}

interface AgeBandDef {
  code: string;
  title: string;
  subtitle: string;
  icon: string;
  accentColor: string;
  bgColor: string;
}

const AGE_BANDS: AgeBandDef[] = [
  {
    code: '7-10',
    title: 'Ages 7–10',
    subtitle: 'Primary / Early Foundations',
    icon: '🧒',
    accentColor: '#0284c7',
    bgColor: '#f0f9ff',
  },
  {
    code: '11-15',
    title: 'Ages 11–15',
    subtitle: 'Middle School / Exploratory',
    icon: '🧑',
    accentColor: '#059669',
    bgColor: '#f0fdf4',
  },
  {
    code: '15-20',
    title: 'Ages 15–20',
    subtitle: 'Secondary & Transition',
    icon: '🎓',
    accentColor: '#7c3aed',
    bgColor: '#faf5ff',
  },
];

interface TeacherCoursesManagerProps {
  onLaunchPractice?: (dppId?: string, chapterId?: string, chapterTitle?: string, courseTitle?: string) => void;
  onOpenCreateCourse?: () => void;
  onOpenAnalytics?: (courseId: string) => void;
}

export const TeacherCoursesManager: React.FC<TeacherCoursesManagerProps> = ({
  onLaunchPractice,
  onOpenCreateCourse,
  onOpenAnalytics,
}) => {
  const { token } = useAuth();

  // All courses loaded from backend
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);

  // Hierarchy Navigation State
  const [activeAgeBandCode, setActiveAgeBandCode] = useState<string>('7-10');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [courseDetail, setCourseDetail] = useState<CourseDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Status and feedback
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Chapter Management State
  const [isAddingChapter, setIsAddingChapter] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [savingChapter, setSavingChapter] = useState(false);

  // Lecture Management State
  const [addingLectureToChapterId, setAddingLectureToChapterId] = useState<string | null>(null);
  const [newLectureTitle, setNewLectureTitle] = useState('');
  const [newLectureDescription, setNewLectureDescription] = useState('');
  const [newVideoUrl, setNewVideoUrl] = useState('https://www.w3schools.com/html/mov_bbb.mp4');
  const [newDurationMinutes, setNewDurationMinutes] = useState(8);
  const [autoGenDppOnAdd, setAutoGenDppOnAdd] = useState(true);
  const [savingLecture, setSavingLecture] = useState(false);

  // Dedicated AI DPP Generation Prompt Modal
  const [promptingDppLecture, setPromptingDppLecture] = useState<{ id: string; title: string; chapterTitle: string } | null>(null);
  const [dppGenPrompt, setDppGenPrompt] = useState<string>('');
  const [dppGenNumQuestions, setDppGenNumQuestions] = useState<number>(5);
  const [dppGenDifficulty, setDppGenDifficulty] = useState<string>('medium');

  // DPP Review Modal State
  const [reviewDppId, setReviewDppId] = useState<string | null>(null);
  const [reviewLectureTitle, setReviewLectureTitle] = useState<string>('');
  const [reviewChapterTitle, setReviewChapterTitle] = useState<string>('');
  const [generatingDppLectureId, setGeneratingDppLectureId] = useState<string | null>(null);

  // Lightweight In-Memory Cache (LRU bounded, max 20 courses, ~0.3 MB total memory)
  const courseDetailCache = React.useRef<Map<string, CourseDetail>>(new Map());

  // 1. Fetch Teacher's Courses
  const fetchTeacherCourses = async () => {
    setLoadingCourses(true);
    setActionError(null);
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/v1/courses?mine=true', { headers });
      if (res.ok) {
        const data = await res.json();
        const list: CourseSummary[] = Array.isArray(data) ? data : [];
        setCourses(list);

        // If current active age band has no courses, select the first one that does
        const hasActiveCourses = list.some((c) => c.age_band_code === activeAgeBandCode);
        if (!hasActiveCourses && list.length > 0) {
          setActiveAgeBandCode(list[0].age_band_code || '7-10');
        }
      } else {
        const err = await res.json().catch(() => ({}));
        setActionError(err.detail || 'Could not load courses.');
      }
    } catch (err: any) {
      setActionError(err.message || 'Error loading courses.');
    } finally {
      setLoadingCourses(false);
    }
  };

  useEffect(() => {
    fetchTeacherCourses();
  }, [token]);

  // 2. Fetch Course Details (with Chapters & Lectures) with in-memory caching
  const fetchCourseDetail = async (cId: string, forceRefresh = false) => {
    // Return immediately from cache if available (0ms instant transition)
    if (!forceRefresh && courseDetailCache.current.has(cId)) {
      setCourseDetail(courseDetailCache.current.get(cId)!);
      return;
    }

    setLoadingDetail(true);
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/v1/courses/${cId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        // Bounded LRU: limit to 20 courses max (~0.3 MB)
        if (courseDetailCache.current.size >= 20) {
          const firstKey = courseDetailCache.current.keys().next().value;
          if (firstKey) courseDetailCache.current.delete(firstKey);
        }
        courseDetailCache.current.set(cId, data);
        setCourseDetail(data);
      } else {
        const err = await res.json().catch(() => ({}));
        setActionError(err.detail || 'Could not load curriculum.');
      }
    } catch (err: any) {
      setActionError(err.message || 'Error fetching course chapters.');
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    if (selectedCourseId) {
      fetchCourseDetail(selectedCourseId);
    } else {
      setCourseDetail(null);
    }
  }, [selectedCourseId]);

  // Derived: Courses belonging to the selected Age Band
  const currentAgeBandCourses = courses.filter((c) => c.age_band_code === activeAgeBandCode);

  // Group current age band courses by Subject
  // e.g., { "Science": [course1], "Mathematics": [course2] }
  const subjectsMap: Record<string, CourseSummary[]> = {};
  currentAgeBandCourses.forEach((c) => {
    const sub = c.subject?.trim() || 'General';
    if (!subjectsMap[sub]) {
      subjectsMap[sub] = [];
    }
    subjectsMap[sub].push(c);
  });
  const subjectsInAgeBand = Object.keys(subjectsMap).sort();

  // 3. Add Chapter to Course (persists to DB)
  const handleAddChapterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId || !newChapterTitle.trim()) return;

    setSavingChapter(true);
    setActionError(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/v1/courses/${selectedCourseId}/chapters`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: newChapterTitle.trim(),
        }),
      });

      if (res.ok) {
        setActionStatus(`Chapter "${newChapterTitle.trim()}" created successfully!`);
        setTimeout(() => setActionStatus(null), 3500);
        setNewChapterTitle('');
        setIsAddingChapter(false);
        await fetchCourseDetail(selectedCourseId, true);
        await fetchTeacherCourses();
      } else {
        const err = await res.json().catch(() => ({}));
        setActionError(err.detail || 'Failed to add chapter.');
      }
    } catch (err: any) {
      setActionError(err.message || 'Error adding chapter.');
    } finally {
      setSavingChapter(false);
    }
  };

  // 4. Delete Chapter from Course (persists to DB)
  const handleDeleteChapter = async (chapterId: string, chapterTitle: string) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete chapter "${chapterTitle}"?\nAll associated lectures and practice questions in this chapter will be deleted.`
    );
    if (!confirmDelete) return;

    setActionStatus(`Deleting chapter "${chapterTitle}"...`);
    setActionError(null);
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/v1/chapters/${chapterId}`, {
        method: 'DELETE',
        headers,
      });

      if (res.ok) {
        setActionStatus(`Chapter "${chapterTitle}" was deleted.`);
        setTimeout(() => setActionStatus(null), 3500);
        if (selectedCourseId) {
          await fetchCourseDetail(selectedCourseId, true);
        }
        await fetchTeacherCourses();
      } else {
        const err = await res.json().catch(() => ({}));
        setActionError(err.detail || 'Could not delete chapter.');
      }
    } catch (err: any) {
      setActionError(err.message || 'Error deleting chapter.');
    }
  };

  // 5. Add Lecture to Chapter (persists to DB)
  const handleAddLectureSubmit = async (e: React.FormEvent, chapterId: string, chapterTitle: string) => {
    e.preventDefault();
    if (!newLectureTitle.trim()) return;

    setSavingLecture(true);
    setActionError(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/v1/lectures', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          chapter_id: chapterId,
          title: newLectureTitle.trim(),
          video_ref: newVideoUrl.trim() || 'sample-video-001',
          duration_seconds: Math.max(60, Math.round(newDurationMinutes * 60)),
        }),
      });

      if (res.ok) {
        const createdLecture = await res.json();
        const lectureTitleAdded = newLectureTitle.trim();
        setActionStatus(`Lecture "${lectureTitleAdded}" added!`);
        setTimeout(() => setActionStatus(null), 3500);

        setAddingLectureToChapterId(null);
        setNewLectureTitle('');
        setNewLectureDescription('');
        setNewDurationMinutes(8);

        // Optionally auto-generate DPP immediately using description & data
        if (autoGenDppOnAdd && createdLecture.id) {
          handleGenerateLectureDpp(createdLecture.id, lectureTitleAdded, chapterTitle, newLectureDescription);
        } else if (selectedCourseId) {
          await fetchCourseDetail(selectedCourseId, true);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        setActionError(err.detail || 'Failed to add lecture.');
      }
    } catch (err: any) {
      setActionError(err.message || 'Error adding lecture.');
    } finally {
      setSavingLecture(false);
    }
  };

  // 6. Delete Lecture (persists to DB)
  const handleDeleteLecture = async (lectureId: string, lectureTitle: string) => {
    const confirmDelete = window.confirm(`Are you sure you want to delete the lesson "${lectureTitle}"?`);
    if (!confirmDelete) return;

    setActionStatus(`Deleting "${lectureTitle}"...`);
    setActionError(null);
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/v1/lectures/${lectureId}`, {
        method: 'DELETE',
        headers,
      });

      if (res.ok) {
        setActionStatus(`Lesson "${lectureTitle}" was deleted.`);
        setTimeout(() => setActionStatus(null), 3500);
        if (selectedCourseId) {
          await fetchCourseDetail(selectedCourseId, true);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        setActionError(err.detail || 'Could not delete lesson.');
      }
    } catch (err: any) {
      setActionError(err.message || 'Error deleting lesson.');
    }
  };

  // 7. Generate DPP for Lecture via AI
  const handleGenerateLectureDpp = async (
    lectureId: string,
    lectureTitle: string,
    chapterTitle?: string,
    customDescription?: string,
    numQuestions: number = 5,
    difficulty: string = 'medium'
  ) => {
    setGeneratingDppLectureId(lectureId);
    setActionStatus(`AI is generating 4-option practice questions based on lecture notes for "${lectureTitle}"...`);
    setActionError(null);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/v1/lectures/${lectureId}/dpp/generate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          description: customDescription,
          num_questions: numQuestions,
          difficulty: difficulty,
        }),
      });

      if (res.ok) {
        const dpp = await res.json();
        setActionStatus(`AI created ${dpp.questions?.length || numQuestions} practice questions for "${lectureTitle}"!`);
        setTimeout(() => setActionStatus(null), 4000);

        if (selectedCourseId) {
          await fetchCourseDetail(selectedCourseId, true);
        }

        setPromptingDppLecture(null);

        // Open question review modal so teacher can verify questions
        if (dpp.id) {
          setReviewDppId(dpp.id);
          setReviewLectureTitle(lectureTitle);
          setReviewChapterTitle(chapterTitle || '');
        }
      } else {
        const err = await res.json().catch(() => ({}));
        setActionError(err.detail || 'Could not generate practice questions.');
      }
    } catch (err: any) {
      setActionError(err.message || 'Error creating questions.');
    } finally {
      setGeneratingDppLectureId(null);
    }
  };

  // 8. Delete DPP from Lecture (persists to DB)
  const handleDeleteDpp = async (dppId: string, lectureTitle: string) => {
    const confirmDelete = window.confirm(`Are you sure you want to delete the practice questions (DPP) for "${lectureTitle}"?`);
    if (!confirmDelete) return;

    setActionStatus(`Deleting practice questions...`);
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/v1/dpps/${dppId}`, {
        method: 'DELETE',
        headers,
      });

      if (res.ok) {
        setActionStatus(`DPP for "${lectureTitle}" was deleted.`);
        setTimeout(() => setActionStatus(null), 3000);
        if (selectedCourseId) {
          await fetchCourseDetail(selectedCourseId, true);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        setActionError(err.detail || 'Could not delete DPP.');
      }
    } catch (err: any) {
      setActionError(err.message || 'Error deleting DPP.');
    }
  };

  const activeAgeBand = AGE_BANDS.find((b) => b.code === activeAgeBandCode) || AGE_BANDS[0];

  return (
    <div style={{ marginTop: 'var(--space-8)' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <h2 style={{ fontSize: '1.625rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
            📚 Curriculum & Course Management
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', marginTop: 'var(--space-1)' }}>
            Organized by <strong>Age Group</strong> → Select an age band to view subjects, chapters, and video lessons.
          </p>
        </div>

        {onOpenCreateCourse && (
          <button
            type="button"
            className="button-primary"
            onClick={onOpenCreateCourse}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px' }}
          >
            <span>➕</span> Create New Course
          </button>
        )}
      </div>

      {/* Notifications / Feedback Alerts */}
      {actionStatus && (
        <div style={{ background: '#ecfdf5', borderColor: '#10b981', color: '#065f46', border: '1px solid #10b981', borderRadius: 'var(--radius-md)', padding: '12px 18px', marginBottom: 'var(--space-4)', fontWeight: 600, fontSize: '0.9375rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>✓</span> {actionStatus}
        </div>
      )}
      {actionError && (
        <div style={{ background: '#fef2f2', borderColor: '#ef4444', color: '#991b1b', border: '1px solid #ef4444', borderRadius: 'var(--radius-md)', padding: '12px 18px', marginBottom: 'var(--space-4)', fontWeight: 600, fontSize: '0.9375rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>⚠️</span> {actionError}
        </div>
      )}

      {/* LEVEL 1: Age Group Distribution Selector */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-2)' }}>
          Step 1: Select Target Age Group
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--space-3)' }}>
          {AGE_BANDS.map((band) => {
            const isSelected = activeAgeBandCode === band.code;
            // Count unique subjects authored in this age band
            const bandCourses = courses.filter((c) => c.age_band_code === band.code);
            const bandSubjects = Array.from(new Set(bandCourses.map((c) => c.subject?.trim() || 'General')));

            return (
              <button
                key={band.code}
                type="button"
                onClick={() => {
                  setActiveAgeBandCode(band.code);
                  setSelectedCourseId(null); // Return to subjects view for newly selected age band
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 20px',
                  borderRadius: 'var(--radius-lg)',
                  background: isSelected ? band.bgColor : 'var(--bg-surface-elevated)',
                  border: isSelected ? `2.5px solid ${band.accentColor}` : '1.5px solid var(--border-subtle)',
                  boxShadow: isSelected ? 'var(--shadow-md)' : 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <span style={{ fontSize: '2rem' }}>{band.icon}</span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '1.125rem', color: isSelected ? band.accentColor : 'var(--text-primary)' }}>
                      {band.title}
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                      {band.subtitle}
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '4px 10px',
                      borderRadius: '999px',
                      background: isSelected ? band.accentColor : 'var(--bg-muted)',
                      color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                    }}
                  >
                    {bandSubjects.length} {bandSubjects.length === 1 ? 'Subject' : 'Subjects'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Viewport: Swappable between Subjects List & Chapter Curriculum */}
      {loadingCourses ? (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-10)' }}>
          <p style={{ color: 'var(--text-secondary)' }}>Loading courses for {activeAgeBand.title}...</p>
        </div>
      ) : selectedCourseId && courseDetail ? (
        /* LEVEL 3 & 4: Subject Curriculum View (Chapters & Lectures) */
        <div className="card" style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-strong)' }}>
          {/* Breadcrumb Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '0.875rem' }}>
              <button
                type="button"
                onClick={() => setSelectedCourseId(null)}
                style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', padding: 0 }}
              >
                ← Back to Subjects ({activeAgeBand.title})
              </button>
              <span style={{ color: 'var(--text-muted)' }}>/</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {courseDetail.subject}
              </span>
              <span style={{ color: 'var(--text-muted)' }}>•</span>
              <span style={{ color: 'var(--text-secondary)' }}>
                {courseDetail.title}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              {onOpenAnalytics && (
                <button
                  type="button"
                  className="button-secondary"
                  style={{ padding: '6px 12px', fontSize: '0.8125rem' }}
                  onClick={() => onOpenAnalytics(courseDetail.id)}
                >
                  📊 View Student Scores
                </button>
              )}
              <button
                type="button"
                className="button-primary"
                style={{ padding: '6px 14px', fontSize: '0.8125rem' }}
                onClick={() => setIsAddingChapter(!isAddingChapter)}
              >
                {isAddingChapter ? '✕ Cancel' : '➕ Add Chapter'}
              </button>
            </div>
          </div>

          {/* Subject Banner */}
          <div style={{ background: activeAgeBand.bgColor, border: `1px solid ${activeAgeBand.accentColor}33`, borderRadius: 'var(--radius-md)', padding: '16px 20px', marginBottom: 'var(--space-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
              <div>
                <span className="brand-badge" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>
                  {courseDetail.subject}
                </span>
                <h3 style={{ fontSize: '1.375rem', fontWeight: 800, margin: '4px 0 2px 0' }}>
                  {courseDetail.title}
                </h3>
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  Target Age Band: <strong>{activeAgeBand.title}</strong> ({activeAgeBand.subtitle}) • {courseDetail.chapters?.length || 0} Chapters
                </p>
              </div>
            </div>
          </div>

          {/* Add Chapter Inline Form */}
          {isAddingChapter && (
            <form
              onSubmit={handleAddChapterSubmit}
              style={{
                background: 'var(--bg-muted)',
                padding: 'var(--space-4)',
                borderRadius: 'var(--radius-md)',
                border: '2px dashed var(--primary)',
                marginBottom: 'var(--space-6)',
              }}
            >
              <h4 style={{ margin: '0 0 var(--space-2) 0', fontSize: '1rem', color: 'var(--primary)', fontWeight: 700 }}>
                ➕ Add New Chapter to "{courseDetail.subject}"
              </h4>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>
                Each chapter organizes video lessons and daily practice questions for this subject.
              </p>
              <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  required
                  className="input-a11y"
                  placeholder="e.g. Chapter 3: Chemical Reactions and Bonding"
                  value={newChapterTitle}
                  onChange={(e) => setNewChapterTitle(e.target.value)}
                  style={{ flex: 1, minWidth: '240px' }}
                />
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => setIsAddingChapter(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button-primary"
                  disabled={savingChapter || !newChapterTitle.trim()}
                >
                  {savingChapter ? 'Saving Chapter...' : 'Save Chapter to DB →'}
                </button>
              </div>
            </form>
          )}

          {/* Chapter & Lecture List */}
          {loadingDetail ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
              <p style={{ color: 'var(--text-secondary)' }}>Loading curriculum chapters...</p>
            </div>
          ) : !courseDetail.chapters || courseDetail.chapters.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-8)', background: 'var(--bg-muted)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '2rem', marginBottom: 'var(--space-2)' }}>📑</div>
              <h4 style={{ fontSize: '1.125rem', fontWeight: 700, margin: '0 0 var(--space-2) 0' }}>
                No chapters added yet for this subject
              </h4>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-4)', fontSize: '0.875rem' }}>
                Click "+ Add Chapter" above to start structuring your lessons.
              </p>
              <button
                type="button"
                className="button-primary"
                onClick={() => setIsAddingChapter(true)}
              >
                ➕ Add First Chapter
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
              {courseDetail.chapters.map((ch, chIdx) => {
                const isAddingLectureThisChapter = addingLectureToChapterId === ch.id;

                return (
                  <div
                    key={ch.id}
                    style={{
                      background: 'var(--bg-surface-elevated)',
                      border: '1.5px solid var(--border-strong)',
                      borderRadius: 'var(--radius-md)',
                      padding: 'var(--space-5)',
                      boxShadow: 'var(--shadow-sm)',
                    }}
                  >
                    {/* Chapter Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--primary)', background: 'var(--bg-muted)', padding: '2px 8px', borderRadius: '4px' }}>
                            Chapter {chIdx + 1}
                          </span>
                          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                            {ch.lectures?.length || 0} Lessons
                          </span>
                        </div>
                        <h4 style={{ fontSize: '1.125rem', fontWeight: 700, margin: '4px 0 0 0', color: 'var(--text-primary)' }}>
                          {ch.title}
                        </h4>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <button
                          type="button"
                          className="button-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.8125rem' }}
                          onClick={() => {
                            setAddingLectureToChapterId(
                              isAddingLectureThisChapter ? null : ch.id
                            );
                          }}
                        >
                          {isAddingLectureThisChapter ? '✕ Close' : '➕ Add Lecture'}
                        </button>
                        <button
                          type="button"
                          className="button-secondary"
                          style={{ padding: '6px 10px', fontSize: '0.8125rem', color: '#ef4444', borderColor: '#fca5a5' }}
                          title="Delete this chapter from database"
                          onClick={() => handleDeleteChapter(ch.id, ch.title)}
                        >
                          🗑️ Delete Chapter
                        </button>
                      </div>
                    </div>

                    {/* Add Lecture Form */}
                    {isAddingLectureThisChapter && (
                      <form
                        onSubmit={(e) => handleAddLectureSubmit(e, ch.id, ch.title)}
                        style={{
                          background: 'var(--bg-muted)',
                          padding: 'var(--space-4)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1.5px dashed var(--primary)',
                          marginBottom: 'var(--space-4)',
                        }}
                      >
                        <strong style={{ display: 'block', fontSize: '0.875rem', marginBottom: 'var(--space-3)', color: 'var(--primary)' }}>
                          Add Video Lecture to "{ch.title}"
                        </strong>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '2px' }}>
                              Lecture Title *
                            </label>
                            <input
                              type="text"
                              required
                              className="input-a11y"
                              placeholder="e.g. Introduction to Newton's Laws"
                              value={newLectureTitle}
                              onChange={(e) => setNewLectureTitle(e.target.value)}
                              style={{ width: '100%', fontSize: '0.875rem' }}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '2px' }}>
                              Video URL or Video ID
                            </label>
                            <input
                              type="text"
                              className="input-a11y"
                              placeholder="https://www.w3schools.com/html/mov_bbb.mp4"
                              value={newVideoUrl}
                              onChange={(e) => setNewVideoUrl(e.target.value)}
                              style={{ width: '100%', fontSize: '0.875rem' }}
                            />
                          </div>

                          <div style={{ maxWidth: '140px' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '2px' }}>
                              Duration (mins)
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="120"
                              className="input-a11y"
                              value={newDurationMinutes}
                              onChange={(e) => setNewDurationMinutes(Number(e.target.value))}
                              style={{ width: '100%', fontSize: '0.875rem' }}
                            />
                          </div>
                        </div>

                        <div style={{ marginBottom: 'var(--space-3)' }}>
                          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '2px' }}>
                            Lesson Description & Key Concepts (Used by AI to generate targeted practice questions)
                          </label>
                          <textarea
                            rows={2}
                            className="input-a11y"
                            placeholder="e.g. Explains Newton's First Law of Motion (Inertia), force, and mass with real-world examples and friction..."
                            value={newLectureDescription}
                            onChange={(e) => setNewLectureDescription(e.target.value)}
                            style={{ width: '100%', fontSize: '0.875rem' }}
                          />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={autoGenDppOnAdd}
                              onChange={(e) => setAutoGenDppOnAdd(e.target.checked)}
                              style={{ cursor: 'pointer', accentColor: 'var(--primary)' }}
                            />
                            <span>✨ Automatically generate 4-option practice questions (DPP) with AI</span>
                          </label>

                          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                            <button
                              type="button"
                              className="button-secondary"
                              style={{ padding: '6px 12px', fontSize: '0.8125rem' }}
                              onClick={() => setAddingLectureToChapterId(null)}
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              className="button-primary"
                              disabled={savingLecture || !newLectureTitle.trim()}
                              style={{ padding: '6px 16px', fontSize: '0.8125rem' }}
                            >
                              {savingLecture ? 'Saving to DB...' : 'Save Lecture →'}
                            </button>
                          </div>
                        </div>
                      </form>
                    )}

                    {/* Lectures List */}
                    {!ch.lectures || ch.lectures.length === 0 ? (
                      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0, fontStyle: 'italic' }}>
                        No video lessons in this chapter yet. Click "+ Add Lecture" above to add one.
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                        {ch.lectures.map((lec, lIdx) => {
                          const isGeneratingDpp = generatingDppLectureId === lec.id;

                          return (
                            <div
                              key={lec.id}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                background: 'var(--bg-surface)',
                                padding: '12px 16px',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--border-subtle)',
                                flexWrap: 'wrap',
                                gap: 'var(--space-3)',
                              }}
                            >
                              {/* Left lecture info */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                <span style={{ fontSize: '1.25rem' }}>📹</span>
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                                    {lIdx + 1}. {lec.title}
                                  </div>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span>~{Math.max(1, Math.round(lec.duration_seconds / 60))} mins</span>
                                    <span>•</span>
                                    {lec.dpp_id ? (
                                      <span style={{ color: '#059669', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        ✓ DPP Practice Ready (4 Choices)
                                      </span>
                                    ) : (
                                      <span style={{ color: '#d97706', fontWeight: 600 }}>
                                        No DPP Questions Yet
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Right Action buttons */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                {lec.dpp_id ? (
                                  <>
                                    <button
                                      type="button"
                                      className="button-primary"
                                      style={{
                                        fontSize: '0.75rem',
                                        padding: '5px 12px',
                                        background: 'linear-gradient(135deg, #0f766e 0%, #0d9488 100%)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                      }}
                                      onClick={() => {
                                        setReviewDppId(lec.dpp_id!);
                                        setReviewLectureTitle(lec.title);
                                        setReviewChapterTitle(ch.title);
                                      }}
                                    >
                                      📝 Review & Edit Questions
                                    </button>

                                    {onLaunchPractice && (
                                      <button
                                        type="button"
                                        className="button-secondary"
                                        style={{ fontSize: '0.75rem', padding: '5px 10px' }}
                                        onClick={() =>
                                          onLaunchPractice(
                                            lec.dpp_id || undefined,
                                            ch.id,
                                            ch.title,
                                            courseDetail.title
                                          )
                                        }
                                      >
                                        📖 Student Preview
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      className="button-secondary"
                                      style={{ fontSize: '0.75rem', padding: '5px 8px', color: '#b91c1c' }}
                                      title="Delete DPP"
                                      onClick={() => handleDeleteDpp(lec.dpp_id!, lec.title)}
                                    >
                                      Delete DPP
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    className="button-primary"
                                    disabled={isGeneratingDpp}
                                    style={{
                                      fontSize: '0.75rem',
                                      padding: '5px 12px',
                                      background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                                    }}
                                    onClick={() => {
                                      setPromptingDppLecture({
                                        id: lec.id,
                                        title: lec.title,
                                        chapterTitle: ch.title,
                                      });
                                      setDppGenPrompt(`Lesson: ${lec.title} in Chapter "${ch.title}". Core concepts, problem sets, and key principles covered in this lecture.`);
                                    }}
                                  >
                                    {isGeneratingDpp ? 'AI Generating...' : '✨ Generate DPP (4 Options)'}
                                  </button>
                                )}

                                <button
                                  type="button"
                                  className="button-secondary"
                                  style={{
                                    fontSize: '0.75rem',
                                    padding: '5px 8px',
                                    color: '#ef4444',
                                    borderColor: '#fca5a5',
                                  }}
                                  title="Delete lecture from database"
                                  onClick={() => handleDeleteLecture(lec.id, lec.title)}
                                >
                                  🗑️ Delete
                                </button>
                              </div>
                            </div>
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
      ) : (
        /* LEVEL 2: Subjects Under the Selected Age Band */
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Subjects for {activeAgeBand.title}
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                Click on any subject below to manage its chapters, lectures, and practice questions.
              </p>
            </div>
            <span
              style={{
                fontSize: '0.8125rem',
                fontWeight: 700,
                color: activeAgeBand.accentColor,
                background: activeAgeBand.bgColor,
                padding: '4px 12px',
                borderRadius: '999px',
                border: `1px solid ${activeAgeBand.accentColor}33`,
              }}
            >
              {subjectsInAgeBand.length} {subjectsInAgeBand.length === 1 ? 'Subject Available' : 'Subjects Available'}
            </span>
          </div>

          {subjectsInAgeBand.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 'var(--space-10)', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-2)' }}>📖</div>
              <h4 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
                No subjects created yet for {activeAgeBand.title}
              </h4>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-5)', maxWidth: '480px', margin: '0 auto var(--space-5) auto' }}>
                You have not authored any courses for {activeAgeBand.title} ({activeAgeBand.subtitle}). Create a course to add subjects like Science or Mathematics.
              </p>
              {onOpenCreateCourse && (
                <button type="button" className="button-primary" onClick={onOpenCreateCourse}>
                  ✨ Create Subject / Course for {activeAgeBand.title}
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
              {subjectsInAgeBand.map((subjectName) => {
                const subjectCourses = subjectsMap[subjectName];
                const totalChapters = subjectCourses.reduce((sum, c) => sum + (c.chapters_count || 0), 0);

                // Derive subject icon
                let subIcon = '📚';
                const lowerSub = subjectName.toLowerCase();
                if (lowerSub.includes('science') || lowerSub.includes('bio') || lowerSub.includes('chem') || lowerSub.includes('phys')) {
                  subIcon = '🧪';
                } else if (lowerSub.includes('math') || lowerSub.includes('algebra') || lowerSub.includes('geom') || lowerSub.includes('trig')) {
                  subIcon = '📐';
                } else if (lowerSub.includes('comp') || lowerSub.includes('code') || lowerSub.includes('tech')) {
                  subIcon = '💻';
                } else if (lowerSub.includes('eng') || lowerSub.includes('lang') || lowerSub.includes('lit')) {
                  subIcon = '📖';
                } else if (lowerSub.includes('art') || lowerSub.includes('music')) {
                  subIcon = '🎨';
                }

                return (
                  <div
                    key={subjectName}
                    className="card"
                    style={{
                      padding: 'var(--space-5)',
                      borderRadius: 'var(--radius-lg)',
                      border: '1.5px solid var(--border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                    }}
                  >
                    <div>
                      {/* Subject Card Header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                        <div
                          style={{
                            width: '46px',
                            height: '46px',
                            borderRadius: 'var(--radius-md)',
                            background: activeAgeBand.bgColor,
                            border: `1px solid ${activeAgeBand.accentColor}33`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.5rem',
                          }}
                        >
                          {subIcon}
                        </div>
                        <div>
                          <h4 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
                            {subjectName}
                          </h4>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {subjectCourses.length} {subjectCourses.length === 1 ? 'Course' : 'Courses'} • {totalChapters} Chapters
                          </span>
                        </div>
                      </div>

                      {/* Course Titles inside this Subject */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', margin: 'var(--space-3) 0' }}>
                        {subjectCourses.map((c) => (
                          <div
                            key={c.id}
                            style={{
                              background: 'var(--bg-muted)',
                              padding: '8px 12px',
                              borderRadius: 'var(--radius-sm)',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                              {c.title}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              {c.chapters_count || 0} Ch.
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Open Curriculum Action */}
                    <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="button-primary"
                        style={{ width: '100%', justifyContent: 'center' }}
                        onClick={() => setSelectedCourseId(subjectCourses[0].id)}
                      >
                        Open Subject Curriculum & Chapters →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Dedicated AI DPP Generation Prompt Modal */}
      {promptingDppLecture && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1050,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-4)',
            backdropFilter: 'blur(3px)',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '640px',
              background: 'var(--bg-surface)',
              padding: 'var(--space-6)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-xl)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
              <div>
                <span className="brand-badge" style={{ fontSize: '0.75rem' }}>AI Question Generator</span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '4px 0 0 0' }}>
                  Generate DPP for "{promptingDppLecture.title}"
                </h3>
              </div>
              <button
                type="button"
                className="btn-a11y"
                onClick={() => setPromptingDppLecture(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 'var(--space-4)' }}>
              Provide the lecture description, notes, or specific concepts. The AI will generate 4-option practice questions based on this data.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleGenerateLectureDpp(
                  promptingDppLecture.id,
                  promptingDppLecture.title,
                  promptingDppLecture.chapterTitle,
                  dppGenPrompt,
                  dppGenNumQuestions,
                  dppGenDifficulty
                );
              }}
            >
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '4px' }}>
                  Lesson Notes & Concepts for Question Generation *
                </label>
                <textarea
                  rows={4}
                  required
                  className="input-a11y"
                  placeholder="Describe the topics, definitions, formulas, or transcript covered in this video lesson..."
                  value={dppGenPrompt}
                  onChange={(e) => setDppGenPrompt(e.target.value)}
                  style={{ width: '100%', fontSize: '0.875rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '4px' }}>
                    Number of Questions
                  </label>
                  <select
                    className="input-a11y"
                    value={dppGenNumQuestions}
                    onChange={(e) => setDppGenNumQuestions(Number(e.target.value))}
                    style={{ width: '100%', fontSize: '0.875rem' }}
                  >
                    <option value={3}>3 Questions</option>
                    <option value={5}>5 Questions</option>
                    <option value={10}>10 Questions</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '4px' }}>
                    Difficulty
                  </label>
                  <select
                    className="input-a11y"
                    value={dppGenDifficulty}
                    onChange={(e) => setDppGenDifficulty(e.target.value)}
                    style={{ width: '100%', fontSize: '0.875rem' }}
                  >
                    <option value="easy">Easy (Foundations)</option>
                    <option value="medium">Medium (Application)</option>
                    <option value="hard">Hard (Advanced)</option>
                    <option value="mixed">Mixed Difficulty</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => setPromptingDppLecture(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button-primary"
                  disabled={generatingDppLectureId === promptingDppLecture.id || !dppGenPrompt.trim()}
                  style={{ background: 'linear-gradient(135deg, #0f766e 0%, #0d9488 100%)', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {generatingDppLectureId === promptingDppLecture.id ? 'AI Generating...' : '✨ Generate Questions from Notes →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DPP Question Verification & Editor Modal */}
      <QuestionReviewModal
        isOpen={Boolean(reviewDppId)}
        dppId={reviewDppId}
        lectureTitle={reviewLectureTitle}
        chapterTitle={reviewChapterTitle}
        onClose={() => setReviewDppId(null)}
        onDppUpdated={() => {
          if (selectedCourseId) {
            fetchCourseDetail(selectedCourseId, true);
          }
        }}
      />
    </div>
  );
};
