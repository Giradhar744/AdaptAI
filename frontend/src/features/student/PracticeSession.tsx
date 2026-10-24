import React, { useState, useEffect, useRef } from 'react';
import { BehaviourTracker, type StruggleAssessmentEvent } from '../../instrumentation/tracker';

export interface PracticeQuestion {
  id: string;
  question_text: string;
  options: Record<string, string>;
  correct_option: string;
  explanation: string;
  difficulty: number;
  bloom_level: string;
}

export interface HintData {
  hint_level: number;
  hint_text: string;
  audio_base64: string | null;
  audio_mime_type: string | null;
  audio_duration_seconds: number | null;
  adaptation_applied: string | null;
}

interface PracticeSessionProps {
  topicTitle?: string;
  chapterTitle?: string;
  courseTitle?: string;
  studentId?: string;
  disabilityType?: string;
  sessionRef?: string;
  onBackToHome: () => void;
}

// Sample fallback questions in case API is operating offline/isolated
const FALLBACK_QUESTIONS: PracticeQuestion[] = [
  {
    id: 'sample-q1',
    question_text: 'A plant cell has a rigid outer wall made of cellulose. What primary role does this cell wall serve for the plant?',
    options: {
      A: 'It converts sunlight into chemical sugar through photosynthesis.',
      B: 'It provides structural support and protection to help the plant stay upright.',
      C: 'It absorbs water directly from the air through microscopic openings.',
      D: 'It stores the genetic blueprints and instructs cell division.',
    },
    correct_option: 'B',
    explanation: 'The cell wall is a sturdy outer layer that maintains cell shape and provides mechanical strength so plants can stand upright without a skeleton.',
    difficulty: 2,
    bloom_level: 'understand',
  },
  {
    id: 'sample-q2',
    question_text: 'If you dissolve 5 grams of salt into 100 grams of pure water, what is the total mass of the resulting salt water solution?',
    options: {
      A: '95 grams, because some liquid evaporates immediately upon mixing.',
      B: '100 grams, because dissolved solids no longer have measurable mass.',
      C: '105 grams, because the law of conservation of mass states mass is neither created nor destroyed.',
      D: '500 grams, because the salt multiplies the mass of the solvent.',
    },
    correct_option: 'C',
    explanation: 'Mass is conserved in a closed physical mixture. The total mass is exactly 100g water + 5g salt = 105 grams.',
    difficulty: 2,
    bloom_level: 'apply',
  },
  {
    id: 'sample-q3',
    question_text: 'Which organelle is often called the powerhouse of the cell because it generates cellular ATP energy?',
    options: {
      A: 'Mitochondrion',
      B: 'Ribosome',
      C: 'Endoplasmic Reticulum',
      D: 'Vacuole',
    },
    correct_option: 'A',
    explanation: 'Mitochondria perform cellular respiration to produce adenosine triphosphate (ATP), the chemical energy currency of cells.',
    difficulty: 1,
    bloom_level: 'remember',
  },
];

export const PracticeSession: React.FC<PracticeSessionProps> = ({
  topicTitle = 'Plant & Animal Cell Biology',
  chapterTitle = 'Cell Structure & Function',
  courseTitle = 'Middle School Science',
  studentId = 'student-dev-001',
  disabilityType = 'dyslexia',
  sessionRef = 'session-practice-001',
  onBackToHome,
}) => {
  const [questions] = useState<PracticeQuestion[]>(FALLBACK_QUESTIONS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Practice Mode: Independent vs AI-Guided
  const [practiceMode, setPracticeMode] = useState<'independent' | 'ai_guided'>('ai_guided');

  // Hints state
  const [hints, setHints] = useState<HintData[]>([]);
  const [loadingHint, setLoadingHint] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Telemetry & Proactive Struggle Interventions
  const trackerRef = useRef<BehaviourTracker | null>(null);
  const [struggleAlert, setStruggleAlert] = useState<StruggleAssessmentEvent | null>(null);
  const [isBreakActive, setIsBreakActive] = useState(false);
  const [breakSecondsLeft, setBreakSecondsLeft] = useState(300); // 5 min sensory break
  const [showWorkedExample, setShowWorkedExample] = useState(false);

  // Timing tracking
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const currentQ = questions[currentIndex];

  // Initialize tracker on mount
  useEffect(() => {
    const tracker = new BehaviourTracker(sessionRef, studentId, (assessment) => {
      if (assessment.risk_level === 'high' || assessment.risk_level === 'medium') {
        setStruggleAlert(assessment);
      }
    });
    trackerRef.current = tracker;

    return () => {
      tracker.disconnect();
    };
  }, [sessionRef, studentId]);

  // Question timer
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [currentIndex]);

  // Break countdown timer
  useEffect(() => {
    let interval: any = null;
    if (isBreakActive && breakSecondsLeft > 0) {
      interval = setInterval(() => {
        setBreakSecondsLeft((prev) => Math.max(0, prev - 1));
      }, 1000);
    } else if (breakSecondsLeft === 0) {
      setIsBreakActive(false);
    }
    return () => clearInterval(interval);
  }, [isBreakActive, breakSecondsLeft]);

  // Clean state on question change
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlayingAudio(false);
    setSelectedOption(null);
    setIsSubmitted(false);
    setIsCorrect(null);
    setFeedback(null);
    setHints([]);
    setSecondsElapsed(0);
    setShowWorkedExample(false);

    trackerRef.current?.initQuestion(currentQ.id);
  }, [currentIndex, currentQ.id]);

  const handleSelectOption = (optKey: string) => {
    if (isSubmitted || isBreakActive) return;
    trackerRef.current?.recordOptionChange();
    setSelectedOption(optKey);
  };

  const handleRequestHint = async () => {
    if (isBreakActive) return;
    const nextLevel = hints.length + 1;
    if (nextLevel > 3) return;

    trackerRef.current?.recordHintRequest(nextLevel);
    setLoadingHint(true);
    try {
      const response = await fetch('/api/v1/practice/hint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          question_id: currentQ.id,
          hint_level: nextLevel,
          modality: 'audio_text',
          question_text: currentQ.question_text,
          correct_option: currentQ.correct_option,
          options: currentQ.options,
          bloom_level: currentQ.bloom_level,
          disability_type: disabilityType,
        }),
      });

      if (response.ok) {
        const data: HintData = await response.json();
        setHints((prev) => [...prev, data]);
        if (data.audio_base64) {
          playAudioFromBase64(data.audio_base64, data.audio_mime_type || 'audio/wav');
        }
      } else {
        generateLocalHintFallback(nextLevel);
      }
    } catch {
      generateLocalHintFallback(nextLevel);
    } finally {
      setLoadingHint(false);
    }
  };

  const generateLocalHintFallback = (level: number) => {
    const fallbackTexts: Record<number, string> = {
      1: 'Think about what gives a skyscraper its shape even in strong winds: what sturdy outer structure provides this?',
      2: 'Notice the words "rigid outer wall". How does rigidity help an organism that cannot move or run away from danger?',
      3: 'Compare the functions: Photosynthesis happens in chloroplasts; genetic material is in the nucleus. That leaves structural support as the cell wall’s duty.',
    };
    const newHint: HintData = {
      hint_level: level,
      hint_text: fallbackTexts[level] || 'Review the key terms in the question.',
      audio_base64: null,
      audio_mime_type: null,
      audio_duration_seconds: null,
      adaptation_applied: disabilityType,
    };
    setHints((prev) => [...prev, newHint]);
  };

  const playAudioFromBase64 = (base64String: string, mimeType: string) => {
    try {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audioUrl = `data:${mimeType};base64,${base64String}`;
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      setIsPlayingAudio(true);
      audio.onended = () => setIsPlayingAudio(false);
      audio.onerror = () => setIsPlayingAudio(false);
      audio.play().catch(() => setIsPlayingAudio(false));
    } catch {
      setIsPlayingAudio(false);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!selectedOption || isSubmitted || isBreakActive) return;

    const correct = selectedOption === currentQ.correct_option;
    setIsCorrect(correct);
    setIsSubmitted(true);
    setFeedback(currentQ.explanation);

    // Send telemetry and trigger struggle detection assessment
    const assessment = await trackerRef.current?.recordQuestionCompleted(
      currentQ.id,
      correct,
      secondsElapsed
    );
    if (assessment && (assessment.risk_level === 'high' || assessment.risk_level === 'medium')) {
      setStruggleAlert(assessment);
    }
  };

  const handleNextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const startSensoryBreak = () => {
    setIsBreakActive(true);
    setBreakSecondsLeft(300);
    setStruggleAlert(null);
  };

  const endBreakEarly = () => {
    setIsBreakActive(false);
  };

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div style={{ maxWidth: '840px', margin: '0 auto', padding: 'var(--space-4) 0' }}>
      {/* Top Header & Breadcrumb */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <button
          type="button"
          onClick={onBackToHome}
          className="button-secondary"
          style={{ padding: '0.4rem 0.8rem', fontSize: '0.875rem' }}
        >
          ← Return to Dashboard
        </button>

        {/* Mode Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', background: 'var(--surface-sunken)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
          <button
            type="button"
            className="btn-a11y"
            style={{
              background: practiceMode === 'ai_guided' ? 'var(--primary)' : 'transparent',
              color: practiceMode === 'ai_guided' ? '#ffffff' : 'var(--text-secondary)',
              border: 'none',
              fontWeight: 600,
            }}
            onClick={() => setPracticeMode('ai_guided')}
            aria-pressed={practiceMode === 'ai_guided'}
          >
            AI-Guided Mode
          </button>
          <button
            type="button"
            className="btn-a11y"
            style={{
              background: practiceMode === 'independent' ? 'var(--primary)' : 'transparent',
              color: practiceMode === 'independent' ? '#ffffff' : 'var(--text-secondary)',
              border: 'none',
              fontWeight: 600,
            }}
            onClick={() => setPracticeMode('independent')}
            aria-pressed={practiceMode === 'independent'}
          >
            Independent Mode
          </button>
        </div>
      </div>

      {/* Breadcrumb Context Card */}
      <div style={{ marginBottom: 'var(--space-4)', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
        <span>{courseTitle}</span> &gt; <span>{chapterTitle}</span> &gt; <strong style={{ color: 'var(--text-primary)' }}>{topicTitle}</strong>
      </div>

      {/* SENSORY BREAK OVERLAY (Cognitive Rest / Overload Prevention per PROJECT.md §9.3 & §10.5) */}
      {isBreakActive && (
        <div
          role="dialog"
          aria-label="Sensory Pause"
          className="card"
          style={{
            background: 'var(--surface-elevated, #f8fafc)',
            border: '2px solid var(--primary)',
            borderRadius: 'var(--radius-lg, 16px)',
            padding: 'var(--space-6)',
            marginBottom: 'var(--space-6)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '3rem', marginBottom: 'var(--space-2)' }}>🌿</div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: 'var(--space-2)', color: 'var(--text-primary)' }}>
            Sensory & Cognitive Pause
          </h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '520px', margin: '0 auto var(--space-4)' }}>
            Take deep breaths, stretch your arms, or rest your eyes. We’ve paused your practice so your mind can recharge.
          </p>
          <div
            style={{
              fontSize: '2.5rem',
              fontWeight: 800,
              color: 'var(--primary)',
              marginBottom: 'var(--space-4)',
              letterSpacing: '2px',
            }}
          >
            {formatTimer(breakSecondsLeft)}
          </div>
          <button
            type="button"
            className="button-primary"
            onClick={endBreakEarly}
            style={{ minWidth: '180px' }}
          >
            I Feel Recharged — Resume
          </button>
        </div>
      )}

      {/* PROACTIVE STRUGGLE INTERVENTION BANNER */}
      {struggleAlert && !isBreakActive && (
        <div
          role="alert"
          className="card"
          style={{
            borderLeft: struggleAlert.risk_level === 'high' ? '6px solid #e11d48' : '6px solid #0284c7',
            background: struggleAlert.risk_level === 'high' ? 'rgba(225, 29, 72, 0.06)' : 'rgba(2, 132, 199, 0.06)',
            padding: 'var(--space-4)',
            marginBottom: 'var(--space-6)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
                <span>{struggleAlert.risk_level === 'high' ? '🛡️' : '💡'}</span>
                <strong style={{ color: struggleAlert.risk_level === 'high' ? '#be123c' : '#0369a1', fontSize: '1rem' }}>
                  {struggleAlert.risk_level === 'high'
                    ? 'Proactive Support: High Cognitive Friction Detected'
                    : 'Learning Scaffolding Suggestion'}
                </strong>
              </div>
              <p style={{ margin: '0 0 var(--space-3) 0', fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                {struggleAlert.proposals[0]?.rationale ||
                  (struggleAlert.risk_level === 'high'
                    ? 'We noticed extended hesitation and consecutive errors. Taking a gentle sensory break can refresh your focus.'
                    : 'Challenging questions detected. Would you like a guided worked example to walk through this concept?')}
              </p>
              {struggleAlert.contributing_factors.length > 0 && (
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>
                  Detected factors: {struggleAlert.contributing_factors.join(' • ')}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setStruggleAlert(null)}
              aria-label="Dismiss suggestion"
              className="btn-a11y"
              style={{ padding: '2px 8px', fontSize: '0.8125rem' }}
            >
              ✕ Dismiss
            </button>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            {struggleAlert.risk_level === 'high' ? (
              <button
                type="button"
                className="button-primary"
                onClick={startSensoryBreak}
                style={{ padding: '0.45rem 1rem', fontSize: '0.875rem' }}
              >
                🌿 Take a 5-Minute Pause
              </button>
            ) : (
              <button
                type="button"
                className="button-primary"
                onClick={() => {
                  setShowWorkedExample(true);
                  setStruggleAlert(null);
                }}
                style={{ padding: '0.45rem 1rem', fontSize: '0.875rem' }}
              >
                📖 View Step-by-Step Worked Example
              </button>
            )}
            <button
              type="button"
              className="button-secondary"
              onClick={() => setStruggleAlert(null)}
              style={{ padding: '0.45rem 1rem', fontSize: '0.875rem' }}
            >
              Continue Practicing
            </button>
          </div>
        </div>
      )}

      {/* WORKED EXAMPLE DRAWER (When activated via Scaffolding Proposal) */}
      {showWorkedExample && (
        <section aria-label="Step-by-Step Worked Example" className="card" style={{ marginBottom: 'var(--space-6)', borderLeft: '4px solid #0284c7' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', color: '#0369a1' }}>
              📖 Scaffolded Worked Example (ZPD Level 1)
            </h3>
            <button
              type="button"
              className="btn-a11y"
              onClick={() => setShowWorkedExample(false)}
              style={{ fontSize: '0.8125rem' }}
            >
              Close Example
            </button>
          </div>
          <p style={{ fontSize: '0.9375rem', lineHeight: '1.6', color: 'var(--text-primary)' }}>
            <strong>Problem Walkthrough:</strong> When looking at structural biological components, always differentiate between internal energy generators (like mitochondria), synthesis factories (like ribosomes), and outer structural supports (like the cellulose cell wall).
          </p>
          <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', margin: 0 }}>
            Because plants lack an internal bone skeleton, the cell wall provides the mechanical counter-pressure that keeps stems and leaves upright toward sunlight.
          </p>
        </section>
      )}

      {/* Main Question Card */}
      <div className="card" style={{ marginBottom: 'var(--space-6)', opacity: isBreakActive ? 0.4 : 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <span className="brand-badge" style={{ textTransform: 'uppercase' }}>
            Question {currentIndex + 1} of {questions.length}
          </span>
          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            <span>Elapsed: {secondsElapsed}s</span>
            <span>Target Level: {currentQ.bloom_level}</span>
          </div>
        </div>

        {/* Question Text */}
        <p style={{ fontSize: '1.1875rem', fontWeight: 600, lineHeight: '1.6', marginBottom: 'var(--space-6)', color: 'var(--text-primary)' }}>
          {currentQ.question_text}
        </p>

        {/* MCQ Option Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
          {Object.entries(currentQ.options).map(([key, text]) => {
            const isSelected = selectedOption === key;
            const isCorrectOption = isSubmitted && key === currentQ.correct_option;
            const isIncorrectOption = isSubmitted && isSelected && !isCorrect;

            let borderStyle = '1px solid var(--border-subtle)';
            let bgStyle = 'var(--surface-sunken)';

            if (isSelected && !isSubmitted) {
              borderStyle = '2px solid var(--primary)';
              bgStyle = 'rgba(13, 148, 136, 0.08)';
            } else if (isCorrectOption) {
              borderStyle = '2px solid #059669';
              bgStyle = 'rgba(5, 150, 105, 0.12)';
            } else if (isIncorrectOption) {
              borderStyle = '2px solid #e11d48';
              bgStyle = 'rgba(225, 29, 72, 0.1)';
            }

            return (
              <button
                key={key}
                type="button"
                onClick={() => handleSelectOption(key)}
                disabled={isSubmitted || isBreakActive}
                className="btn-a11y"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  border: borderStyle,
                  background: bgStyle,
                  cursor: isSubmitted || isBreakActive ? 'default' : 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                  fontSize: '1rem',
                  lineHeight: '1.5',
                  color: 'var(--text-primary)',
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    fontWeight: 700,
                    background: isSelected ? 'var(--primary)' : 'var(--border-subtle)',
                    color: isSelected ? '#ffffff' : 'var(--text-primary)',
                    flexShrink: 0,
                  }}
                >
                  {key}
                </span>
                <span style={{ flex: 1 }}>{text}</span>
              </button>
            );
          })}
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          {/* Hint Request Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <button
              type="button"
              className="button-secondary"
              onClick={handleRequestHint}
              disabled={loadingHint || hints.length >= 3 || isSubmitted || practiceMode === 'independent' || isBreakActive}
              id="btn-request-hint"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <span>💡</span>
              {practiceMode === 'independent' ? (
                'Hints Disabled in Independent Mode'
              ) : loadingHint ? (
                'Generating Gentle Hint...'
              ) : hints.length >= 3 ? (
                'All Hints Provided (3/3)'
              ) : (
                `Request Hint ${hints.length + 1} of 3`
              )}
            </button>
            {hints.length > 0 && (
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                ({hints.length}/3 hints viewed)
              </span>
            )}
          </div>

          {/* Submit or Next Button */}
          {!isSubmitted ? (
            <button
              type="button"
              className="button-primary"
              onClick={handleSubmitAnswer}
              disabled={!selectedOption || isBreakActive}
              id="btn-submit-answer"
            >
              Check My Answer
            </button>
          ) : (
            <button
              type="button"
              className="button-primary"
              onClick={handleNextQuestion}
              disabled={currentIndex >= questions.length - 1}
              id="btn-next-question"
            >
              {currentIndex < questions.length - 1 ? 'Next Question →' : 'Session Complete!'}
            </button>
          )}
        </div>
      </div>

      {/* Hints Drawer / Multi-level Display */}
      {hints.length > 0 && (
        <section aria-label="Step-by-step Hints" style={{ marginBottom: 'var(--space-6)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 'var(--space-3)', color: 'var(--text-primary)' }}>
            Scaffolded ZPD Hints ({hints.length} revealed):
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {hints.map((h, i) => (
              <div
                key={i}
                className="card"
                style={{
                  borderLeft: '4px solid var(--primary)',
                  background: 'var(--surface-sunken)',
                  padding: 'var(--space-4)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--primary)' }}>
                    Level {h.hint_level}: {h.hint_level === 1 ? 'Concept Nudge' : h.hint_level === 2 ? 'Strategy Guide' : 'Guided Breakdown'}
                  </span>
                  {h.audio_base64 && (
                    <button
                      type="button"
                      className="btn-a11y"
                      onClick={() => playAudioFromBase64(h.audio_base64!, h.audio_mime_type || 'audio/wav')}
                      style={{ fontSize: '0.8125rem', padding: '2px 8px' }}
                      aria-label="Listen to audio narration"
                    >
                      {isPlayingAudio ? '🔊 Playing Audio...' : '🔊 Listen to Audio'}
                    </button>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: '0.9375rem', lineHeight: '1.5', color: 'var(--text-primary)' }}>
                  {h.hint_text}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Answer Feedback Region */}
      {isSubmitted && (
        <section
          aria-live="polite"
          className="card"
          style={{
            borderLeft: isCorrect ? '4px solid #059669' : '4px solid #d97706',
            background: isCorrect ? 'rgba(5, 150, 105, 0.05)' : 'rgba(217, 119, 6, 0.05)',
            marginBottom: 'var(--space-6)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: '1.25rem' }}>{isCorrect ? '✅' : '💭'}</span>
            <strong style={{ fontSize: '1rem', color: isCorrect ? '#059669' : '#d97706' }}>
              {isCorrect ? 'Excellent thinking!' : 'Good try! Take a look at the concept explanation:'}
            </strong>
          </div>
          <p style={{ margin: 0, fontSize: '0.9375rem', lineHeight: '1.6', color: 'var(--text-primary)' }}>
            {feedback}
          </p>
        </section>
      )}
    </div>
  );
};

export default PracticeSession;
