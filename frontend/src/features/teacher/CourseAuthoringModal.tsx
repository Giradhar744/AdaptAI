import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

interface CourseAuthoringModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCourseCreated: (courseId: string) => void;
}

interface QuestionItem {
  id?: string;
  prompt: string;
  options: { key: string; text: string }[];
  correct_answer: { key: string; text: string };
  explanation?: string;
  difficulty?: string;
}

export const CourseAuthoringModal: React.FC<CourseAuthoringModalProps> = ({
  isOpen,
  onClose,
  onCourseCreated,
}) => {
  const { token } = useAuth();
  const [step, setStep] = useState<'create_course' | 'create_chapter' | 'add_lecture' | 'generate_content' | 'review_questions'>('create_course');

  // Course fields
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('Science');
  const [ageBandCode, setAgeBandCode] = useState('11-15');
  const [description, setDescription] = useState('');
  const [fee, setFee] = useState(0);
  const [courseId, setCourseId] = useState<string | null>(null);

  // Chapter fields
  const [chapterTitle, setChapterTitle] = useState('');
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [chaptersList, setChaptersList] = useState<Array<{ id: string; title: string; position: number }>>([]);

  // Lecture fields
  const [lectureTitle, setLectureTitle] = useState('');
  const [lectureDescription, setLectureDescription] = useState('');
  const [videoRef, setVideoRef] = useState('https://www.w3schools.com/html/mov_bbb.mp4');
  const [durationSeconds, setDurationSeconds] = useState(600);
  const [lecturesList, setLecturesList] = useState<Array<{ id: string; title: string; video_ref: string }>>([]);
  const [selectedLectureId, setSelectedLectureId] = useState<string | null>(null);

  // AI Content generation fields
  const [topicPrompt, setTopicPrompt] = useState('States of matter: solids, liquids, and gases');
  const [numQuestions, setNumQuestions] = useState(3);
  const [generationType, setGenerationType] = useState<'dpp' | 'test'>('dpp');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | 'mixed'>('mixed');

  // Review & Edit Questions state
  const [generatedDppId, setGeneratedDppId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [dppStatus, setDppStatus] = useState<'draft' | 'published'>('published');

  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // 1. Create Course
  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/v1/courses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          description,
          subject,
          age_band_code: ageBandCode,
          fee: Number(fee),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to create course.');
      }

      const created = await res.json();
      setCourseId(created.id);
      setStatusMsg(`Course "${created.title}" successfully created!`);
      setStep('create_chapter');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 2. Create Chapter
  const handleCreateChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/v1/courses/${courseId}/chapters`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: chapterTitle,
          position: chaptersList.length + 1,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to create chapter.');
      }

      const ch = await res.json();
      setChapterId(ch.id);
      setChaptersList((prev) => [...prev, ch]);
      setStatusMsg(`Chapter "${ch.title}" added to course!`);
      setStep('add_lecture');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 3. Add Lecture
  const handleAddLecture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chapterId) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/v1/lectures', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          chapter_id: chapterId,
          title: lectureTitle,
          video_ref: videoRef,
          duration_seconds: Number(durationSeconds),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to add lecture.');
      }

      const lec = await res.json();
      setLecturesList((prev) => [...prev, lec]);
      setSelectedLectureId(lec.id);
      const combinedPrompt = lectureDescription.trim()
        ? `${lec.title}. Core concepts & topics taught in this lesson: ${lectureDescription.trim()}`
        : lec.title;
      setTopicPrompt(combinedPrompt);
      setStatusMsg(`Lesson video "${lec.title}" saved! Ready to generate practice questions.`);
      setStep('generate_content');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 4. AI Generation (DPP or Chapter Test)
  const handleGenerateContent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chapterId) return;
    setLoading(true);
    setErrorMsg(null);

    const endpoint = generationType === 'dpp'
      ? '/api/v1/content/generate-dpp'
      : '/api/v1/content/generate-chapter-test';

    const promptWithDifficulty = `${topicPrompt}. Target difficulty: ${difficulty}. Ensure exactly 4 options (A, B, C, D).`;

    const payload = generationType === 'dpp'
      ? {
          chapter_id: chapterId,
          lecture_id: selectedLectureId || undefined,
          topic_prompt: promptWithDifficulty,
          num_questions: numQuestions,
          target_age_band: ageBandCode,
        }
      : {
          chapter_id: chapterId,
          topic_prompt: promptWithDifficulty,
          num_questions: numQuestions,
          target_age_band: ageBandCode,
          duration_minutes: 20,
        };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Content generation failed.');
      }

      const result = await res.json();
      setGeneratedDppId(result.id);
      setDppStatus(result.status || 'published');
      setQuestions(result.questions || []);
      setStatusMsg(`AI generated ${result.questions?.length || numQuestions} questions! Review and edit below before publishing.`);
      setStep('review_questions');
      if (courseId) {
        onCourseCreated(courseId);
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 5. Question Review & Editing Handlers
  const handleUpdateQuestion = async (index: number) => {
    const q = questions[index];
    if (q.id && token) {
      try {
        await fetch(`/api/v1/questions/${q.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            prompt: q.prompt,
            options: q.options,
            correct_answer: q.correct_answer,
            explanation: q.explanation,
          }),
        });
      } catch {
        // Keep local
      }
    }
    setEditingIndex(null);
  };

  const handleDeleteQuestion = async (index: number) => {
    const q = questions[index];
    if (q.id && token) {
      try {
        await fetch(`/api/v1/questions/${q.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // Keep local
      }
    }
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddCustomQuestion = () => {
    const newQ: QuestionItem = {
      prompt: 'Enter your new question text here...',
      options: [
        { key: 'A', text: 'First answer choice' },
        { key: 'B', text: 'Second answer choice' },
        { key: 'C', text: 'Third answer choice' },
        { key: 'D', text: 'Fourth answer choice' },
      ],
      correct_answer: { key: 'A', text: 'First answer choice' },
      explanation: 'Explanation for students.',
      difficulty: 'easy',
    };
    setQuestions((prev) => [...prev, newQ]);
    setEditingIndex(questions.length);
  };

  const handleTogglePublishStatus = async (newStatus: 'draft' | 'published') => {
    if (generatedDppId && token) {
      try {
        await fetch(`/api/v1/dpps/${generatedDppId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: newStatus }),
        });
        setDppStatus(newStatus);
        setStatusMsg(`Practice questions marked as ${newStatus}!`);
      } catch {
        // Keep state
      }
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
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
          maxWidth: '820px',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--bg-surface)',
          padding: 'var(--space-6)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-xl)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <h2 id="modal-title" style={{ fontSize: '1.375rem', fontWeight: 700, margin: 0 }}>
            Course Creator & AI Studio
          </h2>
          <button
            type="button"
            className="btn-a11y"
            onClick={onClose}
            aria-label="Close authoring wizard"
            style={{ fontSize: '1.25rem', padding: '4px 8px' }}
          >
            ✕
          </button>
        </div>

        {/* Step Progression Bar */}
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-6)' }}>
          {[
            { id: 'create_course', label: '1. Course Info' },
            { id: 'create_chapter', label: '2. Chapter' },
            { id: 'add_lecture', label: '3. Video Lesson' },
            { id: 'generate_content', label: '4. AI Practice' },
            { id: 'review_questions', label: '5. Review & Publish' },
          ].map((s) => (
            <button
              key={s.id}
              type="button"
              className="btn-a11y"
              style={{
                flex: 1,
                fontSize: '0.75rem',
                padding: '6px',
                textAlign: 'center',
                background: step === s.id ? 'var(--primary)' : 'var(--bg-surface-elevated)',
                color: step === s.id ? '#ffffff' : 'var(--text-secondary)',
                borderRadius: 'var(--radius-sm)',
                fontWeight: step === s.id ? 700 : 500,
              }}
              onClick={() => {
                if (courseId || s.id === 'create_course') {
                  setStep(s.id as any);
                }
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        {statusMsg && (
          <div
            role="status"
            style={{
              background: 'var(--color-success-bg)',
              color: 'var(--color-success-text)',
              border: '1px solid var(--color-success-border)',
              padding: 'var(--space-3) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--space-4)',
              fontSize: '0.875rem',
            }}
          >
            ✓ {statusMsg}
          </div>
        )}

        {errorMsg && (
          <div
            role="alert"
            style={{
              background: 'var(--color-danger-bg)',
              color: 'var(--color-danger-text)',
              border: '1px solid var(--color-danger-border)',
              padding: 'var(--space-3) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--space-4)',
              fontSize: '0.875rem',
            }}
          >
            ⚠ {errorMsg}
          </div>
        )}

        {/* STEP 1: CREATE COURSE */}
        {step === 'create_course' && (
          <form onSubmit={handleCreateCourse}>
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label htmlFor="course-title" style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                Course Title
              </label>
              <input
                id="course-title"
                type="text"
                required
                className="input-a11y"
                placeholder="e.g., Everyday Science & Chemistry"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
              <div>
                <label htmlFor="course-subject" style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                  Subject
                </label>
                <select
                  id="course-subject"
                  className="input-a11y"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                >
                  <option value="Science">Science</option>
                  <option value="Mathematics">Mathematics</option>
                  <option value="Language Arts">Language Arts</option>
                  <option value="Social Studies">Social Studies</option>
                  <option value="Practical Skills">Practical Skills</option>
                </select>
              </div>

              <div>
                <label htmlFor="course-age-band" style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                  Target Learning Level (Age Band)
                </label>
                <select
                  id="course-age-band"
                  className="input-a11y"
                  value={ageBandCode}
                  onChange={(e) => setAgeBandCode(e.target.value)}
                >
                  <option value="7-10">Below 11 years (Early Foundations)</option>
                  <option value="11-15">11–15 years (Middle School / Exploratory)</option>
                  <option value="15-20">Above 15 years (Secondary & Transition)</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label htmlFor="course-fee" style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                Course Fee ($ USD - Demo Simulation)
              </label>
              <input
                id="course-fee"
                type="number"
                min="0"
                step="5"
                className="input-a11y"
                value={fee}
                onChange={(e) => setFee(Number(e.target.value))}
                placeholder="0 for Free Demo"
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Set to 0 for Free course or enter a simulated fee (payments are safely simulated).
              </span>
            </div>

            <div style={{ marginBottom: 'var(--space-6)' }}>
              <label htmlFor="course-description" style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                Description
              </label>
              <textarea
                id="course-description"
                rows={3}
                className="input-a11y"
                placeholder="Briefly explain what students will learn..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
              <button type="button" className="button-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="button-primary" disabled={loading || !title}>
                {loading ? 'Creating...' : 'Create Course & Continue →'}
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: CREATE CHAPTER */}
        {step === 'create_chapter' && (
          <form onSubmit={handleCreateChapter}>
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label htmlFor="chapter-title" style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                Chapter Title
              </label>
              <input
                id="chapter-title"
                type="text"
                required
                className="input-a11y"
                placeholder="e.g., Chapter 1: States of Matter"
                value={chapterTitle}
                onChange={(e) => setChapterTitle(e.target.value)}
              />
            </div>

            {chaptersList.length > 0 && (
              <div style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3)', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)' }}>
                <strong style={{ fontSize: '0.875rem' }}>Existing Chapters in this Course:</strong>
                <ul style={{ margin: 'var(--space-2) 0 0 var(--space-4)', fontSize: '0.875rem' }}>
                  {chaptersList.map((ch) => (
                    <li key={ch.id}>{ch.title}</li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-6)' }}>
              <button type="button" className="button-secondary" onClick={() => setStep('create_course')}>
                ← Back
              </button>
              <button type="submit" className="button-primary" disabled={loading || !chapterTitle}>
                {loading ? 'Saving...' : 'Save Chapter & Add Lesson →'}
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: ADD LECTURE VIDEO */}
        {step === 'add_lecture' && (
          <form onSubmit={handleAddLecture}>
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label htmlFor="lecture-title" style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                Lesson Title
              </label>
              <input
                id="lecture-title"
                type="text"
                required
                className="input-a11y"
                placeholder="e.g., Introduction to Solid, Liquid & Gas"
                value={lectureTitle}
                onChange={(e) => setLectureTitle(e.target.value)}
              />
            </div>

            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label htmlFor="lecture-description" style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                Lesson Description & Core Concepts (Used by AI to generate targeted questions)
              </label>
              <textarea
                id="lecture-description"
                rows={3}
                className="input-a11y"
                placeholder="Describe key definitions, formulas, concepts, or transcript from this video lesson..."
                value={lectureDescription}
                onChange={(e) => setLectureDescription(e.target.value)}
                style={{ width: '100%', fontSize: '0.875rem' }}
              />
            </div>

            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label htmlFor="video-url" style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                Video URL or Storage File Reference
              </label>
              <input
                id="video-url"
                type="text"
                required
                className="input-a11y"
                placeholder="https://www.w3schools.com/html/mov_bbb.mp4"
                value={videoRef}
                onChange={(e) => setVideoRef(e.target.value)}
              />
            </div>

            <div style={{ marginBottom: 'var(--space-6)' }}>
              <label htmlFor="duration-seconds" style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                Duration (seconds)
              </label>
              <input
                id="duration-seconds"
                type="number"
                min="0"
                className="input-a11y"
                value={durationSeconds}
                onChange={(e) => setDurationSeconds(Number(e.target.value))}
              />
            </div>
            {lecturesList.length > 0 && (
              <div style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3)', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)' }}>
                <strong style={{ fontSize: '0.875rem' }}>Added Lessons in this Chapter:</strong>
                <ul style={{ margin: 'var(--space-2) 0 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {lecturesList.map((lec) => (
                    <li key={lec.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-surface)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>📹 {lec.title}</span>
                      <button
                        type="button"
                        className="button-secondary"
                        style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                        onClick={() => {
                          setSelectedLectureId(lec.id);
                          setTopicPrompt(lec.title);
                          setGenerationType('dpp');
                          setStep('generate_content');
                        }}
                      >
                        ✨ Generate DPP Questions →
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button type="button" className="button-secondary" onClick={() => setStep('create_chapter')}>
                ← Back
              </button>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => setStep('generate_content')}
                >
                  Skip Video & Generate Practice →
                </button>
                <button type="submit" className="button-primary" disabled={loading || !lectureTitle}>
                  {loading ? 'Saving...' : 'Save Lesson & Proceed →'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* STEP 4: AI CONTENT GENERATOR */}
        {step === 'generate_content' && (
          <form onSubmit={handleGenerateContent}>
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-2)' }}>
                Select Content Type
              </label>
              <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                <button
                  type="button"
                  className={`btn-a11y ${generationType === 'dpp' ? 'active' : ''}`}
                  onClick={() => setGenerationType('dpp')}
                  style={{
                    flex: 1,
                    padding: 'var(--space-3)',
                    background: generationType === 'dpp' ? 'var(--primary-light)' : 'var(--bg-surface-elevated)',
                    border: generationType === 'dpp' ? '2px solid var(--primary)' : '1px solid var(--border-strong)',
                    fontWeight: 600,
                  }}
                >
                  Daily Practice (DPP)
                </button>
                <button
                  type="button"
                  className={`btn-a11y ${generationType === 'test' ? 'active' : ''}`}
                  onClick={() => setGenerationType('test')}
                  style={{
                    flex: 1,
                    padding: 'var(--space-3)',
                    background: generationType === 'test' ? 'var(--primary-light)' : 'var(--bg-surface-elevated)',
                    border: generationType === 'test' ? '2px solid var(--primary)' : '1px solid var(--border-strong)',
                    fontWeight: 600,
                  }}
                >
                  Timed Chapter Test
                </button>
              </div>
            </div>

            {lecturesList.length > 0 && generationType === 'dpp' && (
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <label htmlFor="select-lecture" style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                  Target Lesson for Practice Questions (DPP)
                </label>
                <select
                  id="select-lecture"
                  className="input-a11y"
                  value={selectedLectureId || ''}
                  onChange={(e) => {
                    const lId = e.target.value;
                    setSelectedLectureId(lId || null);
                    const matchingLec = lecturesList.find((l) => l.id === lId);
                    if (matchingLec) {
                      setTopicPrompt(matchingLec.title);
                    }
                  }}
                >
                  <option value="">General Chapter Concepts (All Lessons)</option>
                  {lecturesList.map((lec) => (
                    <option key={lec.id} value={lec.id}>
                      Lesson: {lec.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label htmlFor="topic-prompt" style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                Lesson Description, Notes & Core Concepts for Question Generation
              </label>
              <textarea
                id="topic-prompt"
                rows={4}
                required
                className="input-a11y"
                placeholder="Describe the lecture concepts, key terms, or paste lesson notes so AI can generate questions based on this data..."
                value={topicPrompt}
                onChange={(e) => setTopicPrompt(e.target.value)}
                style={{ width: '100%', fontSize: '0.875rem' }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>
                💡 AI will generate 4-option practice questions assessing these specific lesson concepts and data.
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
              <div>
                <label htmlFor="difficulty" style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                  Question Difficulty
                </label>
                <select
                  id="difficulty"
                  className="input-a11y"
                  value={difficulty}
                  onChange={(e: any) => setDifficulty(e.target.value)}
                >
                  <option value="easy">Easy (Foundations)</option>
                  <option value="medium">Medium (Application)</option>
                  <option value="hard">Hard (Advanced)</option>
                  <option value="mixed">Mixed Difficulty</option>
                </select>
              </div>

              <div>
                <label htmlFor="num-questions" style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                  Number of Questions
                </label>
                <select
                  id="num-questions"
                  className="input-a11y"
                  value={numQuestions}
                  onChange={(e) => setNumQuestions(Number(e.target.value))}
                >
                  <option value={3}>3 Questions</option>
                  <option value={5}>5 Questions</option>
                  <option value={10}>10 Questions</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button type="button" className="button-secondary" onClick={() => setStep('add_lecture')}>
                ← Back
              </button>
              <button type="submit" className="button-primary" disabled={loading || !topicPrompt}>
                {loading ? 'AI Generating Pedagogical Questions...' : '✨ Generate with AI Studio →'}
              </button>
            </div>
          </form>
        )}

        {/* STEP 5: REVIEW & EDIT QUESTIONS */}
        {step === 'review_questions' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.125rem' }}>
                  Review & Edit Questions ({questions.length})
                </h3>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  Status: <strong style={{ color: dppStatus === 'published' ? '#059669' : '#d97706' }}>{dppStatus.toUpperCase()}</strong>
                </span>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={handleAddCustomQuestion}
                  style={{ fontSize: '0.875rem', padding: '6px 12px' }}
                >
                  ➕ Add Question
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => handleTogglePublishStatus(dppStatus === 'published' ? 'draft' : 'published')}
                  style={{ fontSize: '0.875rem', padding: '6px 12px' }}
                >
                  {dppStatus === 'published' ? 'Switch to Draft' : 'Publish to Students'}
                </button>
              </div>
            </div>

            {questions.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', padding: 'var(--space-4)', textAlign: 'center' }}>
                No questions yet. Click "Add Question" above or regenerate.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                {questions.map((q, idx) => (
                  <div
                    key={idx}
                    style={{
                      border: '1px solid var(--border-strong)',
                      borderRadius: 'var(--radius-md)',
                      padding: 'var(--space-4)',
                      background: 'var(--bg-surface-elevated)',
                    }}
                  >
                    {editingIndex === idx ? (
                      /* Inline Question Editor */
                      <div>
                        <label style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: '4px' }}>
                          Question Text:
                        </label>
                        <textarea
                          rows={2}
                          className="input-a11y"
                          value={q.prompt}
                          onChange={(e) => {
                            const val = e.target.value;
                            setQuestions((prev) => prev.map((item, i) => i === idx ? { ...item, prompt: val } : item));
                          }}
                          style={{ marginBottom: 'var(--space-3)' }}
                        />

                        <label style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: '4px' }}>
                          4 Answer Choices (Mark correct radio):
                        </label>
                        {q.options.map((opt, oIdx) => (
                          <div key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: '6px' }}>
                            <input
                              type="radio"
                              name={`correct-${idx}`}
                              checked={q.correct_answer.key === opt.key}
                              onChange={() => {
                                setQuestions((prev) => prev.map((item, i) => i === idx ? {
                                  ...item,
                                  correct_answer: { key: opt.key, text: opt.text },
                                } : item));
                              }}
                            />
                            <strong style={{ width: '20px' }}>{opt.key}:</strong>
                            <input
                              type="text"
                              className="input-a11y"
                              value={opt.text}
                              onChange={(e) => {
                                const val = e.target.value;
                                setQuestions((prev) => prev.map((item, i) => {
                                  if (i !== idx) return item;
                                  const updatedOpts = [...item.options];
                                  updatedOpts[oIdx] = { ...updatedOpts[oIdx], text: val };
                                  return {
                                    ...item,
                                    options: updatedOpts,
                                    correct_answer: item.correct_answer.key === opt.key ? { key: opt.key, text: val } : item.correct_answer,
                                  };
                                }));
                              }}
                              style={{ flex: 1, padding: '4px 8px' }}
                            />
                          </div>
                        ))}

                        <div style={{ marginTop: 'var(--space-3)' }}>
                          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: '4px' }}>
                            Explanation:
                          </label>
                          <input
                            type="text"
                            className="input-a11y"
                            value={q.explanation || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setQuestions((prev) => prev.map((item, i) => i === idx ? { ...item, explanation: val } : item));
                            }}
                          />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
                          <button
                            type="button"
                            className="button-primary"
                            onClick={() => handleUpdateQuestion(idx)}
                            style={{ padding: '4px 12px', fontSize: '0.875rem' }}
                          >
                            Save Changes
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Display Card */
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
                          <strong>Q{idx + 1}: {q.prompt}</strong>
                          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                            <button
                              type="button"
                              className="btn-a11y"
                              onClick={() => setEditingIndex(idx)}
                              style={{ fontSize: '0.8125rem' }}
                            >
                              ✏️ Edit
                            </button>
                            <button
                              type="button"
                              className="btn-a11y"
                              onClick={() => handleDeleteQuestion(idx)}
                              style={{ fontSize: '0.8125rem', color: '#e11d48' }}
                            >
                              🗑️ Delete
                            </button>
                          </div>
                        </div>

                        <ul style={{ margin: '0 0 var(--space-2) var(--space-4)', fontSize: '0.875rem' }}>
                          {q.options.map((opt) => (
                            <li key={opt.key} style={{ color: opt.key === q.correct_answer.key ? '#059669' : 'inherit', fontWeight: opt.key === q.correct_answer.key ? 700 : 400 }}>
                              {opt.key}: {opt.text} {opt.key === q.correct_answer.key && '✓ (Correct Answer)'}
                            </li>
                          ))}
                        </ul>

                        {q.explanation && (
                          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                            <em>Explanation: {q.explanation}</em>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
              <button
                type="button"
                className="button-primary"
                onClick={() => {
                  if (courseId) onCourseCreated(courseId);
                  onClose();
                }}
              >
                Done & Close Wizard ✓
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CourseAuthoringModal;
