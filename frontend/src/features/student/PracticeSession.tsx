import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { BehaviourTracker, type StruggleAssessmentEvent } from '../../instrumentation/tracker';

export interface PracticeQuestion {
  id: string;
  question_text: string;
  options: Record<string, string>;
  correct_option: string;
  explanation: string;
  difficulty: number | string;
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
  dppId?: string;
  topicId?: string;
  chapterId?: string;
  topicTitle?: string;
  chapterTitle?: string;
  courseTitle?: string;
  studentId?: string;
  disabilityType?: string;
  sessionRef?: string;
  onBackToHome: () => void;
  onCompleted?: () => void;
}

const FALLBACK_QUESTIONS: PracticeQuestion[] = [
  {
    id: 'sample-q1',
    question_text: 'A plant cell has a rigid outer wall made of cellulose. What primary role does this cell wall serve for the plant?',
    options: {
      A: 'It converts sunlight into chemical sugar through photosynthesis.',
      B: 'It provides structural support and protection to help the plant stay upright.',
      C: 'It absorbs water directly from the air through microscopic openings.',
      D: 'It stores extra genetic material for rapid cell division.',
    },
    correct_option: 'B',
    explanation: 'The cell wall is a sturdy outer layer that maintains cell shape and provides mechanical strength so plants can stand upright without a skeleton.',
    difficulty: 'easy',
    bloom_level: 'understand',
  },
  {
    id: 'sample-q2',
    question_text: 'If you dissolve 5 grams of salt into 100 grams of pure water, what is the total mass of the resulting salt water solution?',
    options: {
      A: '95 grams, because some liquid evaporates immediately upon mixing.',
      B: '100 grams, because dissolved solids no longer have measurable mass.',
      C: '105 grams, because the law of conservation of mass states mass is neither created nor destroyed.',
      D: '110 grams, because salt expands in water.',
    },
    correct_option: 'C',
    explanation: 'Mass is conserved in a closed physical mixture. The total mass is exactly 100g water + 5g salt = 105 grams.',
    difficulty: 'medium',
    bloom_level: 'apply',
  },
  {
    id: 'sample-q3',
    question_text: 'Which organelle is often called the powerhouse of the cell because it generates cellular ATP energy?',
    options: {
      A: 'Mitochondrion',
      B: 'Ribosome',
      C: 'Endoplasmic Reticulum',
      D: 'Golgi Apparatus',
    },
    correct_option: 'A',
    explanation: 'Mitochondria perform cellular respiration to produce adenosine triphosphate (ATP), the chemical energy currency of cells.',
    difficulty: 'easy',
    bloom_level: 'remember',
  },
];

export const PracticeSession: React.FC<PracticeSessionProps> = ({
  dppId,
  topicId,
  chapterId,
  topicTitle = 'Daily Practice Problems',
  chapterTitle = 'Lesson Practice',
  courseTitle = 'Interactive Learning',
  studentId: initialStudentId = 'student-dev-001',
  disabilityType: initialDisabilityType = 'dyslexia',
  sessionRef = 'session-practice-001',
  onBackToHome,
  onCompleted,
}) => {
  const { user, token } = useAuth();
  const studentId = user?.student_id || initialStudentId;
  const disabilityType = user?.disabilities?.[0]?.code || initialDisabilityType;

  const [questions, setQuestions] = useState<PracticeQuestion[]>(FALLBACK_QUESTIONS);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);

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
  const currentQ = questions[currentIndex] || questions[0];

  // Load real DPP questions & start live session
  useEffect(() => {
    let isMounted = true;
    const initLiveSession = async () => {
      try {
        let activeDppId = dppId;

        // If only topicId provided, fetch its DPP
        if (!activeDppId && topicId) {
          const res = await fetch(`/api/v1/topics/${topicId}/dpp`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (res.ok) {
            const dppData = await res.json();
            activeDppId = dppData.id;
          }
        }

        if (activeDppId) {
          const res = await fetch(`/api/v1/dpp/${activeDppId}/sessions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ mode: practiceMode }),
          });

          if (res.ok) {
            const data = await res.json();
            if (isMounted) {
              setSessionId(data.session_id);
              if (data.questions && data.questions.length > 0) {
                const formatted: PracticeQuestion[] = data.questions.map((q: any) => {
                  const opts: Record<string, string> = {};
                  if (Array.isArray(q.options)) {
                    q.options.forEach((o: any) => {
                      opts[o.key] = o.text;
                    });
                  }
                  return {
                    id: q.id,
                    question_text: q.prompt,
                    options: opts,
                    correct_option: q.correct_answer?.key || 'A',
                    explanation: q.explanation || 'Review lesson concepts for this topic.',
                    difficulty: q.difficulty || 'medium',
                    bloom_level: 'apply',
                  };
                });
                setQuestions(formatted);
                setCurrentIndex(0);
              }
            }
          }
        }
      } catch {
        // Fallback gracefully to pre-baked sample questions
      }
    };

    initLiveSession();
    return () => {
      isMounted = false;
    };
  }, [dppId, topicId, token, practiceMode]);

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
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlayingAudio(false);
    setSelectedOption(null);
    setIsSubmitted(false);
    setIsCorrect(null);
    setFeedback(null);
    setHints([]);
    setSecondsElapsed(0);
    setShowWorkedExample(false);

    if (currentQ?.id) {
      trackerRef.current?.initQuestion(currentQ.id);
    }
  }, [currentIndex, currentQ?.id]);

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
      if (sessionId) {
        const response = await fetch(`/api/v1/dpp-sessions/${sessionId}/hint`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            question_id: currentQ.id,
            modality: 'audio',
            current_depth: nextLevel === 1 ? 'minimal_nudge' : nextLevel === 2 ? 'partial_hint' : 'worked_example',
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const hintObj: HintData = {
            hint_level: nextLevel,
            hint_text: data.hint_text,
            audio_base64: data.audio_base64,
            audio_mime_type: data.media_type,
            audio_duration_seconds: data.audio_duration,
            adaptation_applied: disabilityType,
          };
          setHints((prev) => [...prev, hintObj]);

          if (data.audio_base64) {
            playAudioFromBase64(data.audio_base64, data.media_type || 'audio/wav');
          } else {
            readAloudWithBrowser(data.hint_text);
          }
          return;
        }
      }

      // Local graceful fallback
      generateLocalHintFallback(nextLevel);
    } catch {
      generateLocalHintFallback(nextLevel);
    } finally {
      setLoadingHint(false);
    }
  };

  const generateLocalHintFallback = (level: number) => {
    const fallbackTexts: Record<number, string> = {
      1: 'Think about the main purpose: what helps the plant stay strong and stand upright toward sunlight?',
      2: 'Notice the words "rigid outer wall". It protects the inner cell and acts like a natural shield.',
      3: 'Compare the choices: Photosynthesis happens in green chloroplasts. The tough outer wall provides mechanical support.',
    };
    const hintText = fallbackTexts[level] || 'Reread the question carefully and look for clues in the wording.';
    const newHint: HintData = {
      hint_level: level,
      hint_text: hintText,
      audio_base64: null,
      audio_mime_type: null,
      audio_duration_seconds: null,
      adaptation_applied: disabilityType,
    };
    setHints((prev) => [...prev, newHint]);
    readAloudWithBrowser(hintText);
  };

  const readAloudWithBrowser = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.onstart = () => setIsPlayingAudio(true);
      utterance.onend = () => setIsPlayingAudio(false);
      utterance.onerror = () => setIsPlayingAudio(false);
      window.speechSynthesis.speak(utterance);
    }
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
      audio.play().catch(() => {
        setIsPlayingAudio(false);
      });
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
    if (correct) {
      setCorrectCount((prev) => prev + 1);
    }

    // Record submission to backend if live session
    if (sessionId) {
      try {
        await fetch(`/api/v1/dpp-sessions/${sessionId}/responses`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            question_id: currentQ.id,
            answer: { selected_key: selectedOption },
            is_correct: correct,
            hints_used: hints.length,
            time_taken_ms: secondsElapsed * 1000,
          }),
        });
      } catch {
        // Silently continue
      }
    }

    // Trigger behavioral check
    const assessment = await trackerRef.current?.recordQuestionCompleted(
      currentQ.id,
      correct,
      secondsElapsed
    );
    if (assessment && (assessment.risk_level === 'high' || assessment.risk_level === 'medium')) {
      setStruggleAlert(assessment);
    }
  };

  const handleNextQuestion = async () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      // Completed all questions in DPP!
      setIsFinished(true);
      if (chapterId && token) {
        try {
          await fetch(`/api/v1/chapters/${chapterId}/dpp/complete`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch {
          // Keep state
        }
      }
      if (onCompleted) {
        onCompleted();
      }
    }
  };

  const startSensoryBreak = () => {
    setIsBreakActive(true);
    setBreakSecondsLeft(300);
    setStruggleAlert(null);
  };

  if (isFinished) {
    const pct = Math.round((correctCount / questions.length) * 100);
    return (
      <div style={{ maxWidth: '840px', margin: '0 auto', padding: 'var(--space-6) 0' }}>
        <section className="card" style={{ textAlign: 'center', padding: 'var(--space-10)' }}>
          <div style={{ fontSize: '3rem', marginBottom: 'var(--space-3)' }}>
            {pct >= 70 ? '🌟' : '🌱'}
          </div>
          <h2 style={{ fontSize: '1.625rem', marginBottom: 'var(--space-2)' }}>
            Practice Session Completed!
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.0625rem', marginBottom: 'var(--space-6)' }}>
            You answered <strong>{correctCount} out of {questions.length}</strong> questions correctly ({pct}%).
          </p>

          <div
            style={{
              display: 'inline-flex',
              gap: 'var(--space-4)',
              background: 'var(--bg-surface-elevated)',
              padding: 'var(--space-4) var(--space-8)',
              borderRadius: 'var(--radius-lg)',
              marginBottom: 'var(--space-8)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Score</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>{pct}%</div>
            </div>
            <div style={{ width: '1px', background: 'var(--border-subtle)' }} />
            <div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Questions</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{questions.length}</div>
            </div>
            <div style={{ width: '1px', background: 'var(--border-subtle)' }} />
            <div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Status</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#059669' }}>Unlocked ✓</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center' }}>
            <button
              type="button"
              className="button-primary"
              onClick={onBackToHome}
            >
              Back to Course Room →
            </button>
            <button
              type="button"
              className="button-secondary"
              onClick={() => {
                setIsFinished(false);
                setCurrentIndex(0);
                setCorrectCount(0);
              }}
            >
              🔄 Practice Again
            </button>
          </div>
        </section>
      </div>
    );
  }

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
          ← Return to Course
        </button>

        {/* Mode Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', background: 'var(--bg-surface-elevated)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
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
            AI Hint Mode
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
            Independent
          </button>
        </div>
      </div>

      {/* Breadcrumb Context */}
      <div style={{ marginBottom: 'var(--space-4)', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
        <span>{courseTitle}</span> &gt; <span>{chapterTitle}</span> &gt; <strong style={{ color: 'var(--text-primary)' }}>{topicTitle}</strong>
      </div>

      {/* SENSORY BREAK OVERLAY */}
      {isBreakActive && (
        <div
          role="dialog"
          aria-label="Sensory Pause"
          className="card"
          style={{
            background: 'var(--bg-surface-elevated)',
            border: '2px solid var(--primary)',
            padding: 'var(--space-6)',
            marginBottom: 'var(--space-6)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '2rem', marginBottom: 'var(--space-2)' }}>🌿</div>
          <h3 style={{ fontSize: '1.25rem', marginBottom: 'var(--space-2)' }}>Taking a Mindful Pause</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-4)', maxWidth: '480px', margin: '0 auto var(--space-4)' }}>
            Take a deep breath and relax. Pausing lets your brain process new information calmly.
          </p>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)', marginBottom: 'var(--space-4)' }}>
            {Math.floor(breakSecondsLeft / 60)}:{(breakSecondsLeft % 60).toString().padStart(2, '0')}
          </div>
          <button
            type="button"
            className="button-primary"
            onClick={() => setIsBreakActive(false)}
          >
            I Feel Ready to Continue →
          </button>
        </div>
      )}

      {/* STRUGGLE INTERVENTION ALERT */}
      {struggleAlert && !isBreakActive && (
        <div
          role="alert"
          className="card"
          style={{
            borderLeft: struggleAlert.risk_level === 'high' ? '4px solid #e11d48' : '4px solid #0284c7',
            background: 'var(--bg-surface-elevated)',
            marginBottom: 'var(--space-6)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <strong style={{ color: struggleAlert.risk_level === 'high' ? '#e11d48' : 'var(--primary)' }}>
                {struggleAlert.risk_level === 'high' ? 'Need a quick breather?' : 'Helpful Learning Tip'}
              </strong>
              <p style={{ margin: 'var(--space-2) 0', fontSize: '0.9375rem' }}>
                {struggleAlert.risk_level === 'high'
                  ? 'We noticed this question feels tricky. Taking a short pause helps reset your attention.'
                  : 'Would you like an example to see how to approach this concept step-by-step?'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStruggleAlert(null)}
              className="btn-a11y"
              style={{ fontSize: '0.8125rem' }}
            >
              ✕
            </button>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            {struggleAlert.risk_level === 'high' ? (
              <button type="button" className="button-primary" onClick={startSensoryBreak} style={{ padding: '6px 12px', fontSize: '0.875rem' }}>
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
                style={{ padding: '6px 12px', fontSize: '0.875rem' }}
              >
                📖 Show Step-by-Step Example
              </button>
            )}
            <button type="button" className="button-secondary" onClick={() => setStruggleAlert(null)} style={{ padding: '6px 12px', fontSize: '0.875rem' }}>
              Keep Trying
            </button>
          </div>
        </div>
      )}

      {/* WORKED EXAMPLE DRAWER */}
      {showWorkedExample && (
        <section aria-label="Step-by-Step Example" className="card" style={{ marginBottom: 'var(--space-6)', borderLeft: '4px solid #0284c7' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', color: '#0284c7' }}>
              📖 Step-by-Step Example
            </h3>
            <button type="button" className="btn-a11y" onClick={() => setShowWorkedExample(false)} style={{ fontSize: '0.8125rem' }}>
              Close Example
            </button>
          </div>
          <p style={{ fontSize: '0.9375rem', lineHeight: '1.6', color: 'var(--text-primary)' }}>
            <strong>How to think through this:</strong> Differentiate between internal energy generators, transport systems, and external protective walls.
          </p>
        </section>
      )}

      {/* Main Question Card */}
      <div className="card" style={{ marginBottom: 'var(--space-6)', opacity: isBreakActive ? 0.4 : 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <span className="brand-badge" style={{ textTransform: 'uppercase' }}>
            Question {currentIndex + 1} of {questions.length}
          </span>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Time: {secondsElapsed}s
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

            let borderStyle = '1px solid var(--border-strong)';
            let bgStyle = 'var(--bg-surface)';

            if (isSelected && !isSubmitted) {
              borderStyle = '2px solid var(--primary)';
              bgStyle = 'var(--primary-light)';
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
                    background: isSelected ? 'var(--primary)' : 'var(--border-strong)',
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
          {/* Hint Controls */}
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
                'Hints Turned Off'
              ) : loadingHint ? (
                'Getting Clue...'
              ) : hints.length >= 3 ? (
                'All 3 Clues Viewed'
              ) : (
                `Get Helpful Clue (${hints.length + 1} of 3)`
              )}
            </button>
            {hints.length > 0 && (
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                ({hints.length}/3 clues used)
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
              id="btn-next-question"
            >
              {currentIndex < questions.length - 1 ? 'Next Question →' : 'Finish Practice →'}
            </button>
          )}
        </div>
      </div>

      {/* Hints Drawer */}
      {hints.length > 0 && (
        <section aria-label="Helpful Clues" style={{ marginBottom: 'var(--space-6)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 'var(--space-3)', color: 'var(--text-primary)' }}>
            Helpful Clues:
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {hints.map((h, i) => (
              <div
                key={i}
                className="card"
                style={{
                  borderLeft: '4px solid var(--primary)',
                  background: 'var(--bg-surface-elevated)',
                  padding: 'var(--space-4)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--primary)' }}>
                    Clue {h.hint_level}: {h.hint_level === 1 ? 'Orientation Clue' : h.hint_level === 2 ? 'Concept Reminder' : 'Step-by-Step Guide'}
                  </span>
                  <button
                    type="button"
                    className="btn-a11y"
                    onClick={() => {
                      if (h.audio_base64) {
                        playAudioFromBase64(h.audio_base64, h.audio_mime_type || 'audio/wav');
                      } else {
                        readAloudWithBrowser(h.hint_text);
                      }
                    }}
                    style={{ fontSize: '0.8125rem', padding: '2px 8px' }}
                    aria-label="Listen to clue"
                  >
                    {isPlayingAudio ? '🔊 Playing...' : '🔊 Read Aloud'}
                  </button>
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
            <span style={{ fontSize: '1.25rem' }}>{isCorrect ? '✅' : '💡'}</span>
            <strong style={{ fontSize: '1rem', color: isCorrect ? '#059669' : '#d97706' }}>
              {isCorrect ? 'Great job!' : 'Good try! Here is why:'}
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
