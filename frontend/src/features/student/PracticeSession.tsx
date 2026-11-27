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

  // Real question state from DB - no hardcoded biology questions
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);
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
  const [breakSecondsLeft, setBreakSecondsLeft] = useState(300);
  const [showWorkedExample, setShowWorkedExample] = useState(false);

  // Timing tracking
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const currentQ: PracticeQuestion | undefined = questions[currentIndex] || questions[0];

  // Load real DPP questions & start live session
  useEffect(() => {
    let isMounted = true;
    const initLiveSession = async () => {
      setIsLoadingQuestions(true);
      try {
        let activeDppId = dppId;

        // 1. If only chapterId provided, fetch DPP for that chapter
        if (!activeDppId && chapterId) {
          try {
            const chRes = await fetch(`/api/v1/chapters/${chapterId}/dpp`, {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            if (chRes.ok) {
              const chDpp = await chRes.json();
              if (chDpp.id) {
                activeDppId = chDpp.id;
              }
            }
          } catch {
            // continue
          }
        }

        // 2. If only topicId provided, fetch its DPP
        if (!activeDppId && topicId) {
          try {
            const res = await fetch(`/api/v1/topics/${topicId}/dpp`, {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            if (res.ok) {
              const dppData = await res.json();
              activeDppId = dppData.id;
            }
          } catch {
            // continue
          }
        }

        // 3. If still no activeDppId (e.g. preview mode), find the first available course DPP
        if (!activeDppId) {
          try {
            const coursesRes = await fetch('/api/v1/courses', {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            if (coursesRes.ok) {
              const coursesData = await coursesRes.json();
              const courseList = Array.isArray(coursesData) ? coursesData : coursesData.items || [];
              for (const c of courseList) {
                const cDetailRes = await fetch(`/api/v1/courses/${c.id}`, {
                  headers: token ? { Authorization: `Bearer ${token}` } : {},
                });
                if (cDetailRes.ok) {
                  const cDetail = await cDetailRes.json();
                  for (const ch of cDetail.chapters || []) {
                    const foundDpp = ch.dpp_id || ch.lectures?.find((l: any) => l.dpp_id)?.dpp_id;
                    if (foundDpp) {
                      activeDppId = foundDpp;
                      break;
                    }
                  }
                }
                if (activeDppId) break;
              }
            }
          } catch {
            // continue
          }
        }

        if (activeDppId) {
          let questionsList: any[] = [];

          // Try starting session with telemetry
          try {
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
              }
              if (data.questions && data.questions.length > 0) {
                questionsList = data.questions;
              }
            }
          } catch {
            // fallback to direct DPP fetch below
          }

          // If no questions from session (e.g. preview/teacher/non-student), fetch DPP directly
          if (questionsList.length === 0) {
            try {
              const dppRes = await fetch(`/api/v1/dpps/${activeDppId}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
              });
              if (dppRes.ok) {
                const dppData = await dppRes.json();
                if (dppData.questions && dppData.questions.length > 0) {
                  questionsList = dppData.questions;
                }
              }
            } catch {
              // continue
            }
          }

          if (isMounted && questionsList.length > 0) {
            const formatted: PracticeQuestion[] = questionsList.map((q: any) => {
              const opts: Record<string, string> = {};
              if (Array.isArray(q.options)) {
                q.options.forEach((o: any) => {
                  opts[o.key] = o.text;
                });
              } else if (typeof q.options === 'object' && q.options !== null) {
                Object.entries(q.options).forEach(([k, v]) => {
                  opts[k] = String(v);
                });
              }
              return {
                id: q.id,
                question_text: q.prompt || q.question_text || '',
                options: opts,
                correct_option: q.correct_answer?.key || (typeof q.correct_answer === 'string' ? q.correct_answer : 'A'),
                explanation: q.explanation || 'Review lesson concepts for this topic.',
                difficulty: q.difficulty || 'medium',
                bloom_level: q.bloom_level || 'apply',
              };
            });
            setQuestions(formatted);
            setCurrentIndex(0);
          }
        }
      } catch {
        // failed to load live DPP
      } finally {
        if (isMounted) {
          setIsLoadingQuestions(false);
        }
      }
    };

    initLiveSession();
    return () => {
      isMounted = false;
    };
  }, [dppId, topicId, chapterId, token, practiceMode]);

  // Initialize tracker on mount
  useEffect(() => {
    const tracker = new BehaviourTracker(
      sessionRef,
      studentId,
      (assessment) => {
        if (assessment.risk_level === 'high' || assessment.risk_level === 'medium') {
          setStruggleAlert(assessment);
        }
      },
      token
    );
    trackerRef.current = tracker;

    return () => {
      tracker.disconnect();
    };
  }, [sessionRef, studentId, token]);

  // Pre-load speech synthesis voices
  useEffect(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      const onVoicesChanged = () => {
        window.speechSynthesis.getVoices();
      };
      window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
      return () => {
        window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
      };
    }
  }, []);

  // Timer loop for time tracking
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
    if (isBreakActive || !currentQ) return;
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

          const isRealAudio = Boolean(data.audio_base64 && data.audio_base64.length > 200);
          if (isRealAudio) {
            playAudioFromBase64(data.audio_base64, data.media_type || 'audio/wav');
          } else {
            readAloudWithBrowser(data.hint_text);
          }
          return;
        }
      }

      // Local graceful fallback using current question explanation
      generateLocalHintFallback(nextLevel);
    } catch {
      generateLocalHintFallback(nextLevel);
    } finally {
      setLoadingHint(false);
    }
  };

  const generateLocalHintFallback = (level: number) => {
    let hintText = '';
    if (level === 1) {
      hintText = currentQ?.explanation
        ? `Orientation clue: ${currentQ.explanation.split('.')[0]}. Read each option attentively.`
        : 'Take your time to read the question prompt carefully and identify what it is specifically asking for.';
    } else if (level === 2) {
      hintText = currentQ?.options
        ? `Concept clue: Look at the given choices: ${Object.keys(currentQ.options).join(', ')}. Eliminate the ones that do not match the core requirements.`
        : 'Focus on the core concept and rule out options that are clearly inaccurate.';
    } else {
      hintText = currentQ?.explanation
        ? `Step-by-step guidance: ${currentQ.explanation}`
        : 'Review the question requirements and eliminate the options that cannot be correct. You are doing great!';
    }
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

      // Prioritize Indian English (en-IN) voices for localized accent clarity
      const voices = window.speechSynthesis.getVoices();
      const indianVoice =
        voices.find(
          (v) =>
            v.lang === 'en-IN' ||
            v.lang.startsWith('en-IN') ||
            v.name.toLowerCase().includes('india') ||
            v.name.toLowerCase().includes('hindi')
        ) || voices.find((v) => v.lang.startsWith('en'));

      if (indianVoice) {
        utterance.voice = indianVoice;
        utterance.lang = indianVoice.lang;
      } else {
        utterance.lang = 'en-IN';
      }

      // Calm, comfortable pacing suited for ADHD, Autism, and Dyslexia learners
      utterance.rate = 0.98;
      utterance.pitch = 1.0;
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
    if (!selectedOption || isSubmitted || isBreakActive || !currentQ) return;

    const correct = selectedOption === currentQ.correct_option;
    setIsCorrect(correct);
    setIsSubmitted(true);
    setFeedback(currentQ.explanation);

    if (correct) {
      setCorrectCount((prev) => prev + 1);
    }

    if (trackerRef.current) {
      trackerRef.current.recordQuestionCompleted(currentQ.id, correct, secondsElapsed);
    }

    // Persist response to server session
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
            selected_option_key: selectedOption,
            hints_used_count: hints.length,
          }),
        });
      } catch {
        // silent fail
      }
    }
  };

  const handleNextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setIsFinished(true);
      if (chapterId && token) {
        fetch(`/api/v1/chapters/${chapterId}/dpp/complete`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }
      if (onCompleted) {
        onCompleted();
      }
    }
  };

  const startSensoryBreak = () => {
    setBreakSecondsLeft(300);
    setIsBreakActive(true);
    setStruggleAlert(null);
  };

  // Loading State
  if (isLoadingQuestions) {
    return (
      <div style={{ width: '100%', maxWidth: '1440px', margin: '0 auto', padding: 'var(--space-8) 0', textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-3)' }}>📖</div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
          Loading Practice Problems...
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>
          Retrieving real questions authored by your teacher for this lesson...
        </p>
      </div>
    );
  }

  // Empty State - No questions published yet
  if (questions.length === 0 || !currentQ) {
    return (
      <div style={{ width: '100%', maxWidth: '840px', margin: '0 auto', padding: 'var(--space-8) 0', textAlign: 'center' }}>
        <div className="card" style={{ padding: 'var(--space-8)' }}>
          <div style={{ fontSize: '3rem', marginBottom: 'var(--space-3)' }}>📝</div>
          <h2 style={{ fontSize: '1.375rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
            No Questions Available Yet
          </h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '480px', margin: '0 auto var(--space-6)', lineHeight: '1.6' }}>
            No practice problems have been published for this lesson yet. Practice problems added or generated by the teacher in the course studio will appear here.
          </p>
          <button type="button" onClick={onBackToHome} className="button-primary" style={{ padding: '10px 24px' }}>
            ← Return to Course
          </button>
        </div>
      </div>
    );
  }

  // Summary Screen when Finished
  if (isFinished) {
    const pct = Math.round((correctCount / questions.length) * 100);
    return (
      <div style={{ maxWidth: '840px', margin: '0 auto', padding: 'var(--space-6) 0' }}>
        <section aria-label="Practice Completion" className="card" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
          <div style={{ fontSize: '3rem', marginBottom: 'var(--space-3)' }}>🎉</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
            Practice Session Completed!
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-6)' }}>
            You scored {correctCount} out of {questions.length} ({pct}%)
          </p>

          <div
            style={{
              display: 'inline-flex',
              gap: 'var(--space-6)',
              background: 'var(--bg-surface-elevated)',
              padding: 'var(--space-4) var(--space-6)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--space-6)',
            }}
          >
            <div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Accuracy</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)' }}>{pct}%</div>
            </div>
            <div style={{ borderLeft: '1px solid var(--border-subtle)' }} />
            <div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Questions</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{questions.length}</div>
            </div>
            <div style={{ borderLeft: '1px solid var(--border-subtle)' }} />
            <div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Hints Used</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{hints.length}</div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-3)' }}>
            <button type="button" className="button-primary" onClick={onBackToHome} style={{ padding: '10px 20px' }}>
              ← Return to Course Room
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
    <div style={{ width: '100%', margin: '0 auto', padding: '0 0 var(--space-4) 0' }}>
      {/* Top Header & Breadcrumb */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
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
      <div style={{ marginBottom: 'var(--space-3)', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
        <span>{courseTitle}</span> &gt; <span>{chapterTitle}</span> &gt; <strong style={{ color: 'var(--text-primary)' }}>{topicTitle}</strong>
      </div>

      {/* SENSORY BREAK OVERLAY (Full width if active) */}
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

      {/* 2-Column Responsive Practice Workspace */}
      <div className="practice-workspace-grid">
        {/* LEFT COLUMN: Question & Answering Section */}
        <div>
          {/* STRUGGLE INTERVENTION ALERT */}
          {struggleAlert && !isBreakActive && (
            <div
              role="alert"
              className="card"
              style={{
                borderLeft: struggleAlert.risk_level === 'high' ? '4px solid #e11d48' : '4px solid #0284c7',
                background: 'var(--bg-surface-elevated)',
                marginBottom: 'var(--space-4)',
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
            <section aria-label="Step-by-Step Example" className="card" style={{ marginBottom: 'var(--space-4)', borderLeft: '4px solid #0284c7' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', color: '#0284c7' }}>
                  📖 Step-by-Step Example
                </h3>
                <button type="button" className="btn-a11y" onClick={() => setShowWorkedExample(false)} style={{ fontSize: '0.8125rem' }}>
                  Close Example
                </button>
              </div>
              <p style={{ fontSize: '0.9375rem', lineHeight: '1.6', color: 'var(--text-primary)' }}>
                <strong>How to think through this:</strong> {currentQ.explanation || 'Read each word attentively. Break the problem down into smaller steps and compare each option with the question requirements.'}
              </p>
            </section>
          )}

          {/* Main Question Card */}
          <div className="card" style={{ marginBottom: 'var(--space-5)', opacity: isBreakActive ? 0.4 : 1 }}>
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

            {/* Action Bar (Check / Next) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)', paddingTop: 'var(--space-2)' }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>💡</span>
                <span>
                  {practiceMode === 'independent'
                    ? 'Hints off (Independent Mode)'
                    : hints.length > 0
                    ? `${hints.length} of 3 clues unlocked on right`
                    : 'Need guidance? Clues available on the right'}
                </span>
              </div>

              {!isSubmitted ? (
                <button
                  type="button"
                  className="button-primary"
                  onClick={handleSubmitAnswer}
                  disabled={!selectedOption || isBreakActive}
                  id="btn-submit-answer"
                  style={{ padding: '10px 24px', fontSize: '1rem' }}
                >
                  Check My Answer
                </button>
              ) : (
                <button
                  type="button"
                  className="button-primary"
                  onClick={handleNextQuestion}
                  id="btn-next-question"
                  style={{ padding: '10px 24px', fontSize: '1rem' }}
                >
                  {currentIndex < questions.length - 1 ? 'Next Question →' : 'Finish Practice →'}
                </button>
              )}
            </div>
          </div>

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

        {/* RIGHT COLUMN: Dedicated Helpful Clues & Spoken Audio Hints Assistant */}
        <aside
          aria-label="Helpful Clues Panel"
          style={{
            position: 'sticky',
            top: 'var(--space-4)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
          }}
        >
          <div
            className="card"
            style={{
              padding: 'var(--space-6)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            {/* Panel Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span style={{ fontSize: '1.25rem' }}>💡</span>
                <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Helpful Clues
                </h3>
              </div>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-sm)',
                  background: hints.length > 0 ? 'var(--primary-light)' : 'var(--bg-surface-elevated)',
                  color: hints.length > 0 ? 'var(--primary)' : 'var(--text-secondary)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                {practiceMode === 'independent' ? 'Hints Off' : `${hints.length}/3 used`}
              </span>
            </div>

            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0 0 var(--space-4) 0', lineHeight: '1.5' }}>
              Spoken audio clues & simplified hints adapted to your learning profile.
            </p>

            {/* Request Clue Button */}
            <button
              type="button"
              className="button-secondary"
              onClick={handleRequestHint}
              disabled={loadingHint || hints.length >= 3 || isSubmitted || practiceMode === 'independent' || isBreakActive}
              id="btn-request-hint"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-2)',
                padding: '12px 16px',
                fontWeight: 600,
                fontSize: '0.9375rem',
                marginBottom: 'var(--space-4)',
                background:
                  hints.length < 3 && !isSubmitted && practiceMode !== 'independent'
                    ? 'var(--primary-light)'
                    : 'var(--bg-surface-elevated)',
                borderColor:
                  hints.length < 3 && !isSubmitted && practiceMode !== 'independent'
                    ? 'var(--primary)'
                    : 'var(--border-strong)',
                color:
                  hints.length < 3 && !isSubmitted && practiceMode !== 'independent'
                    ? 'var(--primary)'
                    : 'var(--text-secondary)',
              }}
            >
              <span>💡</span>
              <span>
                {practiceMode === 'independent'
                  ? 'Hints Disabled in Independent Mode'
                  : loadingHint
                  ? 'Generating Audio Clue...'
                  : hints.length >= 3
                  ? 'All 3 Clues Viewed'
                  : isSubmitted
                  ? 'Question Completed'
                  : `Get Helpful Clue (${hints.length + 1} of 3)`}
              </span>
            </button>

            {/* Loading Clue Indicator */}
            {loadingHint && (
              <div
                style={{
                  padding: 'var(--space-4)',
                  background: 'var(--bg-surface-elevated)',
                  borderRadius: 'var(--radius-md)',
                  textAlign: 'center',
                  marginBottom: 'var(--space-4)',
                  border: '1px solid var(--primary-light)',
                }}
              >
                <div style={{ fontSize: '1.5rem', marginBottom: 'var(--space-2)' }}>✨</div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--primary)' }}>
                  Formulating Spoken Clue...
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Adapting language & speech pacing to your profile
                </div>
              </div>
            )}

            {/* Clues Stream List */}
            {hints.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {hints.map((h, i) => (
                  <div
                    key={i}
                    style={{
                      borderLeft: '4px solid var(--primary)',
                      background: 'var(--bg-surface-elevated)',
                      padding: 'var(--space-4) var(--space-5)',
                      borderRadius: 'var(--radius-md)',
                      boxShadow: 'var(--shadow-sm)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--primary)' }}>
                        Clue {h.hint_level}: {h.hint_level === 1 ? 'Orientation' : h.hint_level === 2 ? 'Concept Reminder' : 'Step-by-Step Guide'}
                      </span>
                      <button
                        type="button"
                        className="btn-a11y"
                        onClick={() => {
                          if (h.audio_base64 && h.audio_base64.length > 200) {
                            playAudioFromBase64(h.audio_base64, h.audio_mime_type || 'audio/wav');
                          } else if (h.hint_text) {
                            readAloudWithBrowser(h.hint_text);
                          }
                        }}
                        style={{
                          fontSize: '0.8125rem',
                          padding: '4px 10px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                        }}
                        aria-label="Listen to clue in Indian English"
                      >
                        {isPlayingAudio ? '🔊 Playing...' : '🔊 Read Aloud'}
                      </button>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.9375rem', lineHeight: '1.6', color: 'var(--text-primary)' }}>
                      {h.hint_text}
                    </p>
                  </div>
                ))}
              </div>
            ) : !loadingHint ? (
              /* Friendly Empty State */
              <div
                style={{
                  padding: 'var(--space-6) var(--space-5)',
                  textAlign: 'center',
                  background: 'var(--bg-surface-elevated)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px dashed var(--border-strong)',
                }}
              >
                <div style={{ fontSize: '2rem', marginBottom: 'var(--space-2)' }}>🎧</div>
                <div style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: 'var(--space-2)' }}>
                  Need a Clue?
                </div>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.6' }}>
                  Click <strong>Get Helpful Clue</strong> above to unlock spoken audio and step-by-step guidance.
                </p>
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default PracticeSession;
