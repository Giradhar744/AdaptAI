import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

interface CourseAuthoringModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCourseCreated: (courseId: string) => void;
}

export const CourseAuthoringModal: React.FC<CourseAuthoringModalProps> = ({
  isOpen,
  onClose,
  onCourseCreated,
}) => {
  const { token } = useAuth();
  const [step, setStep] = useState<'create_course' | 'create_chapter' | 'generate_content'>('create_course');

  // Course fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState('Biology');
  const [ageBandCode, setAgeBandCode] = useState('11-15');

  // Chapter fields
  const [courseId, setCourseId] = useState<string | null>(null);
  const [chapterTitle, setChapterTitle] = useState('');
  const [chapterDescription, setChapterDescription] = useState('');
  const [chapterId, setChapterId] = useState<string | null>(null);

  // AI Content generation fields
  const [topicPrompt, setTopicPrompt] = useState('Photosynthesis, chlorophyll, and light-dependent reactions');
  const [numQuestions, setNumQuestions] = useState(5);
  const [generationType, setGenerationType] = useState<'dpp' | 'test'>('dpp');

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
          description: chapterDescription,
          order_index: 1,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to create chapter.');
      }

      const ch = await res.json();
      setChapterId(ch.id);
      setStatusMsg(`Chapter "${ch.title}" added to course!`);
      setStep('generate_content');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 3. AI Generation (DPP or Chapter Test)
  const handleGenerateContent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chapterId) return;
    setLoading(true);
    setErrorMsg(null);

    const endpoint = generationType === 'dpp'
      ? '/api/v1/content/generate-dpp'
      : '/api/v1/content/generate-chapter-test';

    const payload = generationType === 'dpp'
      ? {
          chapter_id: chapterId,
          topic_prompt: topicPrompt,
          num_questions: numQuestions,
          target_age_band: ageBandCode,
        }
      : {
          chapter_id: chapterId,
          topic_prompt: topicPrompt,
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
      setStatusMsg(`Success! AI generated ${result.questions?.length || numQuestions} pedagogical questions.`);
      if (courseId) {
        onCourseCreated(courseId);
      }
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 'var(--space-4)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: '560px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--border-strong)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
            {step === 'create_course' && 'Step 1: Author New Course'}
            {step === 'create_chapter' && 'Step 2: Add Curriculum Chapter'}
            {step === 'generate_content' && 'Step 3: AI Co-Pilot Content Generation'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            ✕
          </button>
        </div>

        {statusMsg && (
          <div
            style={{
              backgroundColor: 'var(--color-success-bg)',
              color: 'var(--color-success-text)',
              border: '1px solid var(--color-success-border)',
              borderRadius: 'var(--radius-sm)',
              padding: 'var(--space-3)',
              marginBottom: 'var(--space-4)',
              fontSize: '0.875rem',
            }}
          >
            {statusMsg}
          </div>
        )}

        {errorMsg && (
          <div
            style={{
              backgroundColor: 'var(--color-danger-bg)',
              color: 'var(--color-danger-text)',
              border: '1px solid var(--color-danger-border)',
              borderRadius: 'var(--radius-sm)',
              padding: 'var(--space-3)',
              marginBottom: 'var(--space-4)',
              fontSize: '0.875rem',
            }}
          >
            {errorMsg}
          </div>
        )}

        {/* STEP 1: Course Info */}
        {step === 'create_course' && (
          <form onSubmit={handleCreateCourse}>
            <div style={{ marginBottom: 'var(--space-3)' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '4px' }}>
                Course Title
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Adaptive Middle School Life Science"
                style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)' }}
              />
            </div>

            <div style={{ marginBottom: 'var(--space-3)' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '4px' }}>
                Description
              </label>
              <textarea
                rows={3}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Disability-accessible science curriculum with calm scaffolding..."
                style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '4px' }}>
                  Subject Area
                </label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)' }}
                >
                  <option value="Biology">Biology / Life Science</option>
                  <option value="Physics">Physics / Physical Science</option>
                  <option value="Mathematics">Mathematics & Logic</option>
                  <option value="Language Arts">Language Arts & Reading</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '4px' }}>
                  Target Age Band
                </label>
                <select
                  value={ageBandCode}
                  onChange={(e) => setAgeBandCode(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)' }}
                >
                  <option value="7-10">Primary (Ages 7–10)</option>
                  <option value="11-15">Middle School (Ages 11–15)</option>
                  <option value="15-20">Secondary (Ages 15–20)</option>
                </select>
              </div>
            </div>

            <button type="submit" className="button-primary" disabled={loading} style={{ width: '100%', padding: '12px' }}>
              {loading ? 'Creating...' : 'Next: Add Chapter →'}
            </button>
          </form>
        )}

        {/* STEP 2: Chapter Info */}
        {step === 'create_chapter' && (
          <form onSubmit={handleCreateChapter}>
            <div style={{ marginBottom: 'var(--space-3)' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '4px' }}>
                Chapter Title
              </label>
              <input
                type="text"
                required
                value={chapterTitle}
                onChange={(e) => setChapterTitle(e.target.value)}
                placeholder="e.g. Chapter 1: Cellular Structure and Energy"
                style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)' }}
              />
            </div>

            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '4px' }}>
                Chapter Summary
              </label>
              <textarea
                rows={2}
                value={chapterDescription}
                onChange={(e) => setChapterDescription(e.target.value)}
                placeholder="Key concepts covering organelles, photosynthesis, and respiration..."
                style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button
                type="button"
                className="button-secondary"
                onClick={() => setStep('create_course')}
                style={{ flex: 1, padding: '10px' }}
              >
                ← Back
              </button>
              <button
                type="submit"
                className="button-primary"
                disabled={loading}
                style={{ flex: 2, padding: '10px' }}
              >
                {loading ? 'Saving...' : 'Next: Generate Questions with AI →'}
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: AI Co-Pilot Generator */}
        {step === 'generate_content' && (
          <form onSubmit={handleGenerateContent}>
            <div style={{ marginBottom: 'var(--space-3)' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '4px' }}>
                Content Type to Generate
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
                <button
                  type="button"
                  className={`btn-a11y ${generationType === 'dpp' ? 'active' : ''}`}
                  onClick={() => setGenerationType('dpp')}
                  style={{ textAlign: 'center', padding: '8px' }}
                >
                  Daily Practice (DPP)
                </button>
                <button
                  type="button"
                  className={`btn-a11y ${generationType === 'test' ? 'active' : ''}`}
                  onClick={() => setGenerationType('test')}
                  style={{ textAlign: 'center', padding: '8px' }}
                >
                  Timed Chapter Test
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 'var(--space-3)' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '4px' }}>
                Topic Prompt for AI Generator
              </label>
              <textarea
                rows={3}
                required
                value={topicPrompt}
                onChange={(e) => setTopicPrompt(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)' }}
              />
            </div>

            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '4px' }}>
                Number of Questions
              </label>
              <input
                type="number"
                min={2}
                max={15}
                required
                value={numQuestions}
                onChange={(e) => setNumQuestions(Number(e.target.value))}
                style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button
                type="button"
                className="button-secondary"
                onClick={() => setStep('create_chapter')}
                style={{ flex: 1, padding: '10px' }}
              >
                ← Back
              </button>
              <button
                type="submit"
                className="button-primary"
                disabled={loading}
                style={{ flex: 2, padding: '10px' }}
              >
                {loading ? 'AI Co-Pilot is generating...' : '✨ Generate with AI Co-Pilot'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
