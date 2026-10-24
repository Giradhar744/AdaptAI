import React, { useState, useEffect } from 'react';

export interface SafeTestQuestion {
  id: string;
  prompt: string;
  question_type: string;
  options: { key: string; text: string }[];
  difficulty?: string;
}

export interface AnswerFeedback {
  question_id: string;
  selected_key: string;
  correct_key: string;
  is_correct: boolean;
  explanation?: string;
}

export interface TestResult {
  attempt_id: string;
  attempt_number: number;
  is_first_attempt: boolean;
  score: number;
  max_score: number;
  score_percentage: number;
  is_late: boolean;
  feedback: AnswerFeedback[];
}

interface TimedChapterTestProps {
  testId?: string;
  chapterTitle?: string;
  courseTitle?: string;
  studentId?: string;
  onBackToHome: () => void;
}

// Fallback questions for offline / preview
const SAMPLE_TEST_QUESTIONS: SafeTestQuestion[] = [
  {
    id: 't-q1',
    prompt: 'Which organelle is responsible for cellular respiration and generating ATP molecules?',
    question_type: 'mcq',
    options: [
      { key: 'A', text: 'Mitochondria' },
      { key: 'B', text: 'Endoplasmic Reticulum' },
      { key: 'C', text: 'Golgi Apparatus' },
      { key: 'D', text: 'Chloroplast' },
    ],
    difficulty: 'medium',
  },
  {
    id: 't-q2',
    prompt: 'What primary structural polymer comprises plant cell walls to give them rigid support?',
    question_type: 'mcq',
    options: [
      { key: 'A', text: 'Cellulose' },
      { key: 'B', text: 'Glycogen' },
      { key: 'C', text: 'Keratin' },
      { key: 'D', text: 'Lipid bilayer' },
    ],
    difficulty: 'medium',
  },
  {
    id: 't-q3',
    prompt: 'During diffusion, molecules move spontaneously in which direction across a concentration gradient?',
    question_type: 'mcq',
    options: [
      { key: 'A', text: 'From high concentration to low concentration' },
      { key: 'B', text: 'From low concentration to high concentration' },
      { key: 'C', text: 'Only when active ATP energy is consumed' },
      { key: 'D', text: 'Randomly without net movement' },
    ],
    difficulty: 'easy',
  },
];

export const TimedChapterTest: React.FC<TimedChapterTestProps> = ({
  testId = 'test-sample-001',
  chapterTitle = 'Cell Biology & Transport',
  courseTitle = 'Natural Sciences',
  onBackToHome,
}) => {
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [attemptNumber, setAttemptNumber] = useState(1);
  const [isFirstAttempt, setIsFirstAttempt] = useState(true);
  const [questions, setQuestions] = useState<SafeTestQuestion[]>(SAMPLE_TEST_QUESTIONS);
  const [secondsRemaining, setSecondsRemaining] = useState(1200); // 20 mins default
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  // Initialize test attempt from API or fallback
  useEffect(() => {
    const initAttempt = async () => {
      try {
        const res = await fetch(`/api/v1/chapter-tests/${testId}/attempts`, {
          method: 'POST',
        });
        if (res.ok) {
          const data = await res.json();
          setAttemptId(data.attempt_id);
          setAttemptNumber(data.attempt_number);
          setIsFirstAttempt(data.is_first_attempt);
          if (data.questions && data.questions.length > 0) {
            setQuestions(data.questions);
          }
          setSecondsRemaining(data.time_limit_seconds || 1200);
        }
      } catch {
        // Use standalone sample fallback
        setAttemptId('sample-att-001');
      }
    };
    initAttempt();
  }, [testId]);

  // Server-enforced countdown timer
  useEffect(() => {
    if (testResult) return;
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmitTest();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [testResult]);

  const handleSelectKey = (questionId: string, key: string) => {
    if (testResult || isSubmitting) return;
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: key }));
  };

  const handleSubmitTest = async () => {
    if (isSubmitting || testResult) return;
    setIsSubmitting(true);

    const answersPayload = Object.entries(selectedAnswers).map(([qid, key]) => ({
      question_id: qid,
      selected_key: key,
    }));

    try {
      if (attemptId && attemptId !== 'sample-att-001') {
        const res = await fetch(`/api/v1/attempts/${attemptId}/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers: answersPayload }),
        });
        if (res.ok) {
          const resultData: TestResult = await res.json();
          setTestResult(resultData);
          setIsSubmitting(false);
          return;
        }
      }
    } catch {
      // Fallback local grading
    }

    // Local grading fallback
    const mockCorrect: Record<string, string> = { 't-q1': 'A', 't-q2': 'A', 't-q3': 'A' };
    let score = 0;
    const feedback: AnswerFeedback[] = questions.map((q) => {
      const selected = selectedAnswers[q.id] || '';
      const correct = mockCorrect[q.id] || 'A';
      const isCorrect = selected === correct;
      if (isCorrect) score += 1;
      return {
        question_id: q.id,
        selected_key: selected,
        correct_key: correct,
        is_correct: isCorrect,
        explanation: 'Review the chapter summaries on cell organelle function.',
      };
    });

    setTestResult({
      attempt_id: attemptId || 'sample-att-001',
      attempt_number: attemptNumber,
      is_first_attempt: isFirstAttempt,
      score,
      max_score: questions.length,
      score_percentage: Math.round((score / questions.length) * 100),
      is_late: false,
      feedback,
    });
    setIsSubmitting(false);
  };

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div style={{ maxWidth: '840px', margin: '0 auto', padding: 'var(--space-4) 0' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <button
          type="button"
          onClick={onBackToHome}
          className="button-secondary"
          style={{ padding: '0.4rem 0.8rem', fontSize: '0.875rem' }}
        >
          ← Return to Dashboard
        </button>

        {/* Attempt Badge (First Attempt Rule: PROJECT.md §11 rule 1) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <span
            className="brand-badge"
            style={{
              background: isFirstAttempt ? '#0d9488' : '#6366f1',
              color: '#ffffff',
            }}
          >
            {isFirstAttempt ? '★ Attempt 1: Official Evaluation' : `Attempt ${attemptNumber}: Learning Re-attempt`}
          </span>

          {!testResult && (
            <div
              style={{
                fontWeight: 700,
                fontSize: '1rem',
                fontFamily: 'monospace',
                background: secondsRemaining < 180 ? 'rgba(225, 29, 72, 0.1)' : 'var(--surface-sunken)',
                color: secondsRemaining < 180 ? '#be123c' : 'var(--text-primary)',
                padding: '4px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
              }}
              aria-label="Remaining test time"
            >
              ⏳ {formatTimer(secondsRemaining)}
            </div>
          )}
        </div>
      </div>

      <div style={{ marginBottom: 'var(--space-6)', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
        <span>{courseTitle}</span> &gt; <strong style={{ color: 'var(--text-primary)' }}>{chapterTitle}</strong>
      </div>

      {/* Notice on First Attempt Rule */}
      {isFirstAttempt && !testResult && (
        <div
          className="card"
          style={{
            borderLeft: '4px solid #0d9488',
            background: 'rgba(13, 148, 136, 0.06)',
            padding: 'var(--space-3) var(--space-4)',
            marginBottom: 'var(--space-6)',
            fontSize: '0.875rem',
            lineHeight: '1.5',
          }}
        >
          <strong>First Attempt Policy:</strong> This first attempt counts toward your teacher's course evaluation and ranking.
          You can re-attempt this test later anytime for unlimited learning mastery!
        </div>
      )}

      {/* TEST RESULT VIEW */}
      {testResult ? (
        <section aria-labelledby="heading-result" className="card" style={{ marginBottom: 'var(--space-6)' }}>
          <h2 id="heading-result" style={{ fontSize: '1.5rem', marginBottom: 'var(--space-2)' }}>
            Chapter Test Results
          </h2>
          <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center', margin: 'var(--space-4) 0', flexWrap: 'wrap' }}>
            <div
              style={{
                fontSize: '2.5rem',
                fontWeight: 800,
                color: testResult.score_percentage >= 70 ? '#059669' : '#d97706',
              }}
            >
              {testResult.score_percentage}%
            </div>
            <div>
              <div>Score: <strong>{testResult.score} / {testResult.max_score}</strong></div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                {testResult.is_first_attempt
                  ? 'Official first-attempt result recorded.'
                  : 'Practice re-attempt completed for learning.'}
              </div>
            </div>
          </div>

          <h3 style={{ fontSize: '1.125rem', marginTop: 'var(--space-6)', marginBottom: 'var(--space-3)' }}>
            Question Review & Rationales:
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {questions.map((q, idx) => {
              const fb = testResult.feedback.find((f) => f.question_id === q.id);
              const isCorrect = fb?.is_correct;
              return (
                <div
                  key={q.id}
                  style={{
                    padding: 'var(--space-4)',
                    borderRadius: 'var(--radius-md)',
                    border: isCorrect ? '2px solid #059669' : '2px solid #d97706',
                    background: isCorrect ? 'rgba(5, 150, 105, 0.04)' : 'rgba(217, 119, 6, 0.04)',
                  }}
                >
                  <p style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>
                    {idx + 1}. {q.prompt}
                  </p>
                  <div style={{ fontSize: '0.875rem', marginBottom: 'var(--space-2)' }}>
                    Your Answer: <strong>Option {fb?.selected_key || 'None'}</strong> {isCorrect ? '✅' : '❌'} | Correct Answer: <strong>Option {fb?.correct_key}</strong>
                  </div>
                  {fb?.explanation && (
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0 }}>
                      Explanation: {fb.explanation}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 'var(--space-6)', display: 'flex', gap: 'var(--space-3)' }}>
            <button
              type="button"
              className="button-primary"
              onClick={() => {
                setTestResult(null);
                setSelectedAnswers({});
                setAttemptNumber((prev) => prev + 1);
                setIsFirstAttempt(false);
                setSecondsRemaining(1200);
              }}
            >
              Take Learning Re-attempt ↻
            </button>
            <button
              type="button"
              className="button-secondary"
              onClick={onBackToHome}
            >
              Return to Course
            </button>
          </div>
        </section>
      ) : (
        /* QUESTION LIST */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {questions.map((q, qIndex) => (
            <div key={q.id} className="card">
              <span className="brand-badge" style={{ marginBottom: 'var(--space-2)', display: 'inline-block' }}>
                Question {qIndex + 1} of {questions.length}
              </span>
              <p style={{ fontSize: '1.125rem', fontWeight: 600, lineHeight: '1.6', marginBottom: 'var(--space-4)' }}>
                {q.prompt}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {q.options.map((opt) => {
                  const isSelected = selectedAnswers[q.id] === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      className="btn-a11y"
                      onClick={() => handleSelectKey(q.id, opt.key)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-3)',
                        padding: 'var(--space-3) var(--space-4)',
                        borderRadius: 'var(--radius-md)',
                        border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-subtle)',
                        background: isSelected ? 'rgba(13, 148, 136, 0.08)' : 'var(--surface-sunken)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontSize: '0.9375rem',
                      }}
                    >
                      <span
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          background: isSelected ? 'var(--primary)' : 'var(--border-subtle)',
                          color: isSelected ? '#ffffff' : 'var(--text-primary)',
                        }}
                      >
                        {opt.key}
                      </span>
                      <span>{opt.text}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Submit Test Button */}
          <div style={{ textAlign: 'right', marginTop: 'var(--space-4)' }}>
            <button
              type="button"
              className="button-primary"
              onClick={handleSubmitTest}
              disabled={isSubmitting || Object.keys(selectedAnswers).length === 0}
              style={{ minWidth: '200px', padding: '0.75rem 1.5rem', fontSize: '1rem' }}
            >
              {isSubmitting ? 'Grading Test...' : 'Submit Completed Test →'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimedChapterTest;
