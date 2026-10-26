import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

export interface QuestionOption {
  key: string;
  text: string;
}

export interface QuestionItem {
  id?: string;
  prompt: string;
  options: QuestionOption[];
  correct_answer: { key: string; text: string };
  explanation?: string;
  difficulty?: string;
}

interface QuestionReviewModalProps {
  isOpen: boolean;
  dppId: string | null;
  lectureTitle: string;
  chapterTitle?: string;
  onClose: () => void;
  onDppUpdated?: () => void;
}

export const QuestionReviewModal: React.FC<QuestionReviewModalProps> = ({
  isOpen,
  dppId,
  lectureTitle,
  chapterTitle,
  onClose,
  onDppUpdated,
}) => {
  const { token } = useAuth();
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [dppStatus, setDppStatus] = useState<'draft' | 'published'>('published');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // In-place edit state
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [editOptions, setEditOptions] = useState<QuestionOption[]>([
    { key: 'A', text: '' },
    { key: 'B', text: '' },
    { key: 'C', text: '' },
    { key: 'D', text: '' },
  ]);
  const [editCorrectKey, setEditCorrectKey] = useState('A');
  const [editExplanation, setEditExplanation] = useState('');
  const [editDifficulty, setEditDifficulty] = useState('medium');

  // Adding new question state
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newPrompt, setNewPrompt] = useState('');
  const [newOptions, setNewOptions] = useState<QuestionOption[]>([
    { key: 'A', text: '' },
    { key: 'B', text: '' },
    { key: 'C', text: '' },
    { key: 'D', text: '' },
  ]);
  const [newCorrectKey, setNewCorrectKey] = useState('A');
  const [newExplanation, setNewExplanation] = useState('');
  const [newDifficulty, setNewDifficulty] = useState('medium');

  // 1. Fetch DPP questions from DB
  const fetchDppDetails = async () => {
    if (!dppId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/v1/dpps/${dppId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setQuestions(data.questions || []);
        setDppStatus(data.status || 'published');
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMsg(err.detail || 'Could not load practice questions.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error loading DPP.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && dppId) {
      fetchDppDetails();
      setIsAddingNew(false);
      setEditingQuestionId(null);
      setStatusMsg(null);
      setErrorMsg(null);
    }
  }, [isOpen, dppId]);

  if (!isOpen || !dppId) return null;

  // 2. Start editing an existing question
  const startEditing = (q: QuestionItem) => {
    setEditingQuestionId(q.id || null);
    setEditPrompt(q.prompt);
    // Ensure 4 options
    const normalizedOptions: QuestionOption[] = ['A', 'B', 'C', 'D'].map((key) => {
      const existing = q.options?.find((o) => o.key.toUpperCase() === key);
      return { key, text: existing ? existing.text : '' };
    });
    setEditOptions(normalizedOptions);
    setEditCorrectKey(q.correct_answer?.key || 'A');
    setEditExplanation(q.explanation || '');
    setEditDifficulty(q.difficulty || 'medium');
  };

  // 3. Save question edits to DB
  const handleSaveEdit = async (qId: string) => {
    if (!editPrompt.trim() || editPrompt.trim().length < 5) {
      setErrorMsg('Question text must be at least 5 characters.');
      return;
    }
    const hasEmptyOption = editOptions.some((opt) => !opt.text.trim());
    if (hasEmptyOption) {
      setErrorMsg('All 4 answer options (A, B, C, D) must have text.');
      return;
    }

    const correctOpt = editOptions.find((o) => o.key === editCorrectKey) || editOptions[0];

    setSaving(true);
    setErrorMsg(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/v1/questions/${qId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          prompt: editPrompt.trim(),
          options: editOptions.map((o) => ({ key: o.key, text: o.text.trim() })),
          correct_answer: { key: correctOpt.key, text: correctOpt.text.trim() },
          explanation: editExplanation.trim() || undefined,
          difficulty: editDifficulty,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setQuestions((prev) => prev.map((q) => (q.id === qId ? updated : q)));
        setEditingQuestionId(null);
        setStatusMsg('Question updated and saved to database successfully!');
        setTimeout(() => setStatusMsg(null), 3000);
        if (onDppUpdated) onDppUpdated();
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMsg(err.detail || 'Failed to update question.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error saving question.');
    } finally {
      setSaving(false);
    }
  };

  // 4. Delete question from DB
  const handleDeleteQuestion = async (qId: string, idx: number) => {
    const confirmDelete = window.confirm(`Are you sure you want to delete Question ${idx + 1}?`);
    if (!confirmDelete) return;

    setSaving(true);
    setErrorMsg(null);
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/v1/questions/${qId}`, {
        method: 'DELETE',
        headers,
      });

      if (res.ok) {
        setQuestions((prev) => prev.filter((q) => q.id !== qId));
        setStatusMsg(`Question ${idx + 1} deleted from database.`);
        setTimeout(() => setStatusMsg(null), 3000);
        if (onDppUpdated) onDppUpdated();
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMsg(err.detail || 'Could not delete question.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error deleting question.');
    } finally {
      setSaving(false);
    }
  };

  // 5. Add custom 4-option question to DB
  const handleAddNewQuestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPrompt.trim() || newPrompt.trim().length < 5) {
      setErrorMsg('Question text must be at least 5 characters.');
      return;
    }
    const hasEmptyOption = newOptions.some((opt) => !opt.text.trim());
    if (hasEmptyOption) {
      setErrorMsg('Please fill in text for all 4 choices (A, B, C, D).');
      return;
    }

    const correctOpt = newOptions.find((o) => o.key === newCorrectKey) || newOptions[0];

    setSaving(true);
    setErrorMsg(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/v1/dpps/${dppId}/questions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt: newPrompt.trim(),
          options: newOptions.map((o) => ({ key: o.key, text: o.text.trim() })),
          correct_answer: { key: correctOpt.key, text: correctOpt.text.trim() },
          explanation: newExplanation.trim() || undefined,
          difficulty: newDifficulty,
        }),
      });

      if (res.ok) {
        const createdQ = await res.json();
        setQuestions((prev) => [...prev, createdQ]);
        setIsAddingNew(false);
        setNewPrompt('');
        setNewOptions([
          { key: 'A', text: '' },
          { key: 'B', text: '' },
          { key: 'C', text: '' },
          { key: 'D', text: '' },
        ]);
        setNewExplanation('');
        setStatusMsg('New question added and saved to database!');
        setTimeout(() => setStatusMsg(null), 3500);
        if (onDppUpdated) onDppUpdated();
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMsg(err.detail || 'Failed to add question.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error creating question.');
    } finally {
      setSaving(false);
    }
  };

  // 6. Toggle draft/published status
  const handleToggleStatus = async (targetStatus: 'draft' | 'published') => {
    setSaving(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/v1/dpps/${dppId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: targetStatus }),
      });

      if (res.ok) {
        setDppStatus(targetStatus);
        setStatusMsg(`DPP practice questions marked as ${targetStatus}.`);
        setTimeout(() => setStatusMsg(null), 3000);
      }
    } catch {
      // keep
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dpp-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-4)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '850px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-surface)',
          padding: 'var(--space-6)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-xl)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: '4px' }}>
              <span className="brand-badge" style={{ fontSize: '0.75rem', padding: '2px 8px' }}>
                Daily Practice (DPP)
              </span>
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  fontWeight: 600,
                  background: dppStatus === 'published' ? '#ecfdf5' : '#fffbeb',
                  color: dppStatus === 'published' ? '#065f46' : '#92400e',
                  border: `1px solid ${dppStatus === 'published' ? '#a7f3d0' : '#fde68a'}`,
                }}
              >
                {dppStatus === 'published' ? '● Published' : '○ Draft'}
              </span>
            </div>
            <h2 id="dpp-modal-title" style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
              Verify & Manage DPP Questions
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: '4px 0 0 0' }}>
              Lesson: <strong>{lectureTitle}</strong> {chapterTitle ? `• Chapter: ${chapterTitle}` : ''}
            </p>
          </div>

          <button
            type="button"
            className="btn-a11y"
            onClick={onClose}
            aria-label="Close question review modal"
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              lineHeight: 1,
              padding: '4px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Action Status Notifications */}
        {statusMsg && (
          <div style={{ background: '#ecfdf5', borderColor: '#10b981', color: '#065f46', border: '1px solid #10b981', borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: 'var(--space-3)', fontSize: '0.875rem', fontWeight: 600 }}>
            ✓ {statusMsg}
          </div>
        )}
        {errorMsg && (
          <div style={{ background: '#fef2f2', borderColor: '#ef4444', color: '#991b1b', border: '1px solid #ef4444', borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: 'var(--space-3)', fontSize: '0.875rem', fontWeight: 600 }}>
            ⚠️ {errorMsg}
          </div>
        )}

        {/* Toolbar: Add question & status toggler */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          <div style={{ fontSize: '0.9375rem', fontWeight: 700 }}>
            Total Questions: <span style={{ color: 'var(--primary)' }}>{questions.length}</span> (All 4 Choices)
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button
              type="button"
              className="button-secondary"
              style={{ padding: '6px 12px', fontSize: '0.8125rem' }}
              onClick={() => handleToggleStatus(dppStatus === 'published' ? 'draft' : 'published')}
              disabled={saving}
            >
              {dppStatus === 'published' ? 'Mark as Draft' : 'Publish to Students'}
            </button>
            <button
              type="button"
              className="button-primary"
              style={{ padding: '6px 14px', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={() => {
                setIsAddingNew(!isAddingNew);
                setEditingQuestionId(null);
              }}
              disabled={saving}
            >
              <span>{isAddingNew ? '✕ Cancel' : '➕ Add Question'}</span>
            </button>
          </div>
        </div>

        {/* Scrollable Questions Body */}
        <div style={{ overflowY: 'auto', flex: 1, paddingRight: '4px', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Add New Question Form */}
          {isAddingNew && (
            <form
              onSubmit={handleAddNewQuestionSubmit}
              style={{
                background: 'var(--bg-muted)',
                padding: 'var(--space-4)',
                borderRadius: 'var(--radius-md)',
                border: '2px dashed var(--primary)',
              }}
            >
              <h4 style={{ margin: '0 0 var(--space-3) 0', fontSize: '1rem', color: 'var(--primary)', fontWeight: 700 }}>
                ➕ Add New Practice Question
              </h4>

              <div style={{ marginBottom: 'var(--space-3)' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '4px' }}>
                  Question Prompt *
                </label>
                <textarea
                  required
                  rows={2}
                  className="input-a11y"
                  placeholder="e.g. Which of the following organelles is known as the powerhouse of the cell?"
                  value={newPrompt}
                  onChange={(e) => setNewPrompt(e.target.value)}
                  style={{ width: '100%', fontSize: '0.875rem' }}
                />
              </div>

              <div style={{ marginBottom: 'var(--space-3)' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '6px' }}>
                  Answer Choices (Select radio button for the correct answer) *
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-2)' }}>
                  {newOptions.map((opt, idx) => (
                    <div
                      key={opt.key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                        background: 'var(--bg-surface)',
                        padding: '6px 10px',
                        borderRadius: 'var(--radius-sm)',
                        border: newCorrectKey === opt.key ? '2px solid #10b981' : '1px solid var(--border-subtle)',
                      }}
                    >
                      <input
                        type="radio"
                        id={`new-opt-${opt.key}`}
                        name="new-correct-option"
                        checked={newCorrectKey === opt.key}
                        onChange={() => setNewCorrectKey(opt.key)}
                        style={{ cursor: 'pointer', accentColor: '#10b981' }}
                      />
                      <label htmlFor={`new-opt-${opt.key}`} style={{ fontWeight: 700, fontSize: '0.8125rem', width: '24px', cursor: 'pointer' }}>
                        {opt.key}.
                      </label>
                      <input
                        type="text"
                        required
                        className="input-a11y"
                        placeholder={`Choice ${opt.key} text`}
                        value={opt.text}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewOptions((prev) =>
                            prev.map((o, i) => (i === idx ? { ...o, text: val } : o))
                          );
                        }}
                        style={{ flex: 1, fontSize: '0.8125rem', padding: '4px 8px' }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '4px' }}>
                    Explanation / Solution Hint
                  </label>
                  <input
                    type="text"
                    className="input-a11y"
                    placeholder="e.g. Mitochondria produce ATP through cellular respiration."
                    value={newExplanation}
                    onChange={(e) => setNewExplanation(e.target.value)}
                    style={{ width: '100%', fontSize: '0.8125rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '4px' }}>
                    Difficulty
                  </label>
                  <select
                    className="input-a11y"
                    value={newDifficulty}
                    onChange={(e) => setNewDifficulty(e.target.value)}
                    style={{ width: '100%', fontSize: '0.8125rem' }}
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
                <button
                  type="button"
                  className="button-secondary"
                  style={{ padding: '6px 12px', fontSize: '0.8125rem' }}
                  onClick={() => setIsAddingNew(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button-primary"
                  disabled={saving}
                  style={{ padding: '6px 16px', fontSize: '0.8125rem' }}
                >
                  {saving ? 'Saving...' : 'Save Question to DB →'}
                </button>
              </div>
            </form>
          )}

          {/* Questions Listing */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-secondary)' }}>
              Loading practice questions from database...
            </div>
          ) : questions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-8)', background: 'var(--bg-muted)', borderRadius: 'var(--radius-md)' }}>
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                No questions exist yet in this DPP. Click <strong>"+ Add Question"</strong> above to add one.
              </p>
            </div>
          ) : (
            questions.map((q, idx) => {
              const isEditing = editingQuestionId === q.id;

              return (
                <div
                  key={q.id || idx}
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-4)',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  {/* Top Bar of Card */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '0.875rem' }}>
                        Question {idx + 1}
                      </span>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          textTransform: 'uppercase',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background:
                            q.difficulty === 'hard'
                              ? '#fee2e2'
                              : q.difficulty === 'medium'
                              ? '#fef3c7'
                              : '#dcfce7',
                          color:
                            q.difficulty === 'hard'
                              ? '#991b1b'
                              : q.difficulty === 'medium'
                              ? '#92400e'
                              : '#166534',
                        }}
                      >
                        {q.difficulty || 'medium'}
                      </span>
                    </div>

                    {!isEditing && (
                      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        <button
                          type="button"
                          className="button-secondary"
                          style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                          onClick={() => startEditing(q)}
                        >
                          ✏️ Edit
                        </button>
                        {q.id && (
                          <button
                            type="button"
                            className="button-secondary"
                            style={{ fontSize: '0.75rem', padding: '3px 8px', color: '#ef4444', borderColor: '#fca5a5' }}
                            onClick={() => handleDeleteQuestion(q.id!, idx)}
                          >
                            🗑️ Delete
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Inline Edit Form */}
                  {isEditing ? (
                    <div style={{ marginTop: 'var(--space-2)' }}>
                      <div style={{ marginBottom: 'var(--space-2)' }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '2px' }}>
                          Question Text *
                        </label>
                        <textarea
                          rows={2}
                          className="input-a11y"
                          value={editPrompt}
                          onChange={(e) => setEditPrompt(e.target.value)}
                          style={{ width: '100%', fontSize: '0.875rem' }}
                        />
                      </div>

                      <div style={{ marginBottom: 'var(--space-3)' }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '4px' }}>
                          Choices (Check radio to mark correct answer)
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--space-2)' }}>
                          {editOptions.map((opt, optIdx) => (
                            <div
                              key={opt.key}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--space-2)',
                                background: 'var(--bg-muted)',
                                padding: '6px 8px',
                                borderRadius: 'var(--radius-sm)',
                                border: editCorrectKey === opt.key ? '2px solid #10b981' : '1px solid var(--border-subtle)',
                              }}
                            >
                              <input
                                type="radio"
                                id={`edit-opt-${q.id}-${opt.key}`}
                                name={`edit-correct-${q.id}`}
                                checked={editCorrectKey === opt.key}
                                onChange={() => setEditCorrectKey(opt.key)}
                                style={{ cursor: 'pointer', accentColor: '#10b981' }}
                              />
                              <label htmlFor={`edit-opt-${q.id}-${opt.key}`} style={{ fontWeight: 700, fontSize: '0.8125rem', width: '20px', cursor: 'pointer' }}>
                                {opt.key}.
                              </label>
                              <input
                                type="text"
                                className="input-a11y"
                                value={opt.text}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setEditOptions((prev) =>
                                    prev.map((o, i) => (i === optIdx ? { ...o, text: val } : o))
                                  );
                                }}
                                style={{ flex: 1, fontSize: '0.8125rem', padding: '4px 6px' }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '2px' }}>
                            Explanation
                          </label>
                          <input
                            type="text"
                            className="input-a11y"
                            value={editExplanation}
                            onChange={(e) => setEditExplanation(e.target.value)}
                            style={{ width: '100%', fontSize: '0.8125rem' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '2px' }}>
                            Difficulty
                          </label>
                          <select
                            className="input-a11y"
                            value={editDifficulty}
                            onChange={(e) => setEditDifficulty(e.target.value)}
                            style={{ width: '100%', fontSize: '0.8125rem' }}
                          >
                            <option value="easy">Easy</option>
                            <option value="medium">Medium</option>
                            <option value="hard">Hard</option>
                          </select>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
                        <button
                          type="button"
                          className="button-secondary"
                          style={{ padding: '4px 10px', fontSize: '0.8125rem' }}
                          onClick={() => setEditingQuestionId(null)}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="button-primary"
                          disabled={saving}
                          style={{ padding: '4px 14px', fontSize: '0.8125rem' }}
                          onClick={() => q.id && handleSaveEdit(q.id)}
                        >
                          {saving ? 'Saving...' : 'Save to DB'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Read-Only Display Mode with 4 Options */
                    <div>
                      <p style={{ fontWeight: 600, fontSize: '0.9375rem', margin: '0 0 var(--space-3) 0', color: 'var(--text-primary)' }}>
                        {q.prompt}
                      </p>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                        {q.options?.map((opt) => {
                          const isCorrect = q.correct_answer?.key === opt.key;

                          return (
                            <div
                              key={opt.key}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--space-2)',
                                padding: '8px 12px',
                                borderRadius: 'var(--radius-sm)',
                                background: isCorrect ? '#ecfdf5' : 'var(--bg-muted)',
                                border: isCorrect ? '1.5px solid #10b981' : '1px solid var(--border-subtle)',
                                color: isCorrect ? '#065f46' : 'var(--text-primary)',
                                fontWeight: isCorrect ? 600 : 400,
                                fontSize: '0.875rem',
                              }}
                            >
                              <span style={{ fontWeight: 700, minWidth: '22px' }}>
                                {opt.key}.
                              </span>
                              <span style={{ flex: 1 }}>{opt.text}</span>
                              {isCorrect && (
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#059669', background: '#d1fae5', padding: '1px 6px', borderRadius: '4px' }}>
                                  ✓ Correct
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {q.explanation && (
                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', background: 'var(--bg-muted)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', marginTop: 'var(--space-2)' }}>
                          💡 <strong>Explanation:</strong> {q.explanation}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-4)', marginTop: 'var(--space-4)', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="button-primary"
            onClick={onClose}
            style={{ padding: '8px 24px' }}
          >
            Done Reviewing
          </button>
        </div>
      </div>
    </div>
  );
};
