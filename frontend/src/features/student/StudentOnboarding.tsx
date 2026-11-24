import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { LoadingScreen } from '../../components/LoadingScreen';
import { getStudentGroupName, sanitizeStudentText } from '../../utils/studentGroup';

interface QuestionOption {
  key: string;
  text: string;
}

interface Question {
  id: string;
  prompt: string;
  options: QuestionOption[];
}

interface DiagnosticResult {
  score: number;
  max_score: number;
  percentage: number;
  recommended_course_id?: string;
  recommended_course_title?: string;
  explanation: string;
  strengths: string[];
  focus_areas: string[];
}

export const StudentOnboarding: React.FC<{ onBackToHome: () => void; autoStart?: boolean }> = ({
  onBackToHome,
  autoStart = false,
}) => {
  const { user, token: authContextToken, isAuthenticated, register, refreshProfile } = useAuth();
  const [step, setStep] = useState<'register' | 'diagnostic' | 'recommendation' | 'enrolled'>('register');

  // Registration state (for guest users)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [age, setAge] = useState<number>(13);
  const [disabilityCode, setDisabilityCode] = useState('asd');
  const [token, setToken] = useState<string | null>(authContextToken);

  // Diagnostic state
  const [diagnosticId, setDiagnosticId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<
    'registering' | 'loadingDiagnostic' | 'evaluatingDiagnostic' | 'enrolling' | null
  >(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const activeToken = token || authContextToken || localStorage.getItem('adaptai_access_token');

  // Sync token from AuthContext if present
  useEffect(() => {
    if (authContextToken) {
      setToken(authContextToken);
    }
  }, [authContextToken]);

  // Auto-launch enrollment test if arrived via registration redirect or autoStart is true
  const hasAutoStarted = React.useRef(false);
  useEffect(() => {
    if (autoStart && !hasAutoStarted.current && (isAuthenticated || activeToken) && step === 'register' && !diagnosticId && !loading) {
      hasAutoStarted.current = true;
      handleStartDiagnostic();
    }
  }, [autoStart, isAuthenticated, activeToken, step, diagnosticId, loading]);

  // 1. Submit Registration (Guest Users)
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLoadingAction('registering');
    setErrorMsg(null);

    try {
      await register({
        email,
        password,
        role: 'student',
        display_name: displayName,
        age,
        disability_type_code: disabilityCode,
      });

      const currentToken = localStorage.getItem('adaptai_access_token') || '';
      setToken(currentToken);

      // Fetch user profile to get student_id
      const meRes = await fetch('/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      const meData = await meRes.json();

      // Start Diagnostic
      await startDiagnostic(meData.student_id, currentToken);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
      setLoadingAction(null);
    }
  };

  // 2. Start Diagnostic for Already Signed-In Students
  const handleStartDiagnostic = async () => {
    const currentToken = activeToken;
    if (!currentToken) {
      setErrorMsg('Please sign in to take the diagnostic test.');
      return;
    }

    setLoading(true);
    setLoadingAction('loadingDiagnostic');
    setErrorMsg(null);

    try {
      let sId = user?.student_id;
      if (!sId) {
        const meRes = await fetch('/api/v1/auth/me', {
          headers: { Authorization: `Bearer ${currentToken}` },
        });
        if (!meRes.ok) throw new Error('Could not retrieve student profile.');
        const meData = await meRes.json();
        sId = meData.student_id;
        if (sId) {
          await refreshProfile();
        }
      }

      if (!sId) {
        throw new Error('Student profile not found. Please log in with a student account.');
      }

      await startDiagnostic(sId, currentToken);
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not initiate diagnostic test.');
    } finally {
      setLoading(false);
      setLoadingAction(null);
    }
  };

  // 3. Initiate Diagnostic Test via API
  const startDiagnostic = async (sId: string, authToken: string) => {
    setLoading(true);
    setLoadingAction('loadingDiagnostic');
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/v1/students/${sId}/diagnostic/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Could not initiate diagnostic test.');
      }

      const data = await res.json();
      setDiagnosticId(data.diagnostic_id);
      setQuestions(data.questions || []);
      setCurrentQuestionIndex(0);
      setAnswers({});
      setStep('diagnostic');
    } catch (err: any) {
      setErrorMsg(err.message || 'Error starting diagnostic test');
    } finally {
      setLoading(false);
      setLoadingAction(null);
    }
  };

  // 4. Record Answer for Current Question
  const handleSelectOption = (questionId: string, optionKey: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionKey }));
  };

  // 5. Submit Diagnostic Answers
  const handleSubmitDiagnostic = async () => {
    const currentToken = activeToken;
    if (!diagnosticId || !currentToken) return;
    setLoading(true);
    setLoadingAction('evaluatingDiagnostic');
    setErrorMsg(null);

    const submissions = Object.entries(answers).map(([qId, key]) => ({
      question_id: qId,
      selected_key: key,
      time_taken_ms: 3000,
    }));

    try {
      const res = await fetch(`/api/v1/diagnostic/${diagnosticId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentToken}`,
        },
        body: JSON.stringify({ answers: submissions }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to submit diagnostic answers.');
      }

      const data = await res.json();
      setResult(data);
      setStep('recommendation');
      if (refreshProfile) {
        try {
          await refreshProfile(currentToken);
        } catch {
          // Keep current profile if network error
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit diagnostic answers.');
    } finally {
      setLoading(false);
      setLoadingAction(null);
    }
  };

  // 6. Enrol in recommended course
  const handleEnrol = async () => {
    const currentToken = activeToken;
    if (!result?.recommended_course_id || !currentToken) return;
    setLoading(true);
    setLoadingAction('enrolling');
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/v1/courses/${result.recommended_course_id}/enrol`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Enrollment failed');
      }
      setStep('enrolled');
    } catch (err: any) {
      setErrorMsg(err.message || 'Enrollment failed');
    } finally {
      setLoading(false);
      setLoadingAction(null);
    }
  };

  // 7. Decline / Decide Later and browse available courses
  const handleDecline = async () => {
    if (refreshProfile) {
      try {
        await refreshProfile();
      } catch {
        // Continue
      }
    }
    onBackToHome();
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: 'var(--space-6) 0' }}>
      {/* Fullscreen loading during registration, evaluation, or initialization */}
      {loading && (
        <LoadingScreen
          preset={
            loadingAction === 'registering'
              ? 'authRegister'
              : loadingAction === 'evaluatingDiagnostic'
              ? 'evaluatingDiagnostic'
              : loadingAction === 'enrolling'
              ? 'savingData'
              : 'loadingCurriculum'
          }
          title={
            loadingAction === 'registering'
              ? 'Registering Student Profile in Database...'
              : loadingAction === 'evaluatingDiagnostic'
              ? 'Evaluating Enrollment Test...'
              : loadingAction === 'enrolling'
              ? 'Enrolling in Tailored Course...'
              : 'Preparing Enrollment Test...'
          }
          subtitle={
            loadingAction === 'registering'
              ? 'Saving your student credentials, age group, and sensory learning accommodations...'
              : loadingAction === 'evaluatingDiagnostic'
              ? 'Our engine is scoring your subject answers and finding the best course fit for your learning pace...'
              : loadingAction === 'enrolling'
              ? 'Linking course curriculum, video lessons, and practice to your account...'
              : 'Curating adaptive diagnostic questions tailored to your age and learning style...'
          }
          variant="fullscreen"
        />
      )}

      <button
        type="button"
        className="button-secondary"
        onClick={onBackToHome}
        style={{ marginBottom: 'var(--space-6)' }}
      >
        ← Back to Dashboard
      </button>

      {errorMsg && (
        <div
          role="alert"
          style={{
            background: 'var(--color-danger-bg)',
            color: 'var(--color-danger-text)',
            border: '1px solid var(--color-danger-border)',
            padding: 'var(--space-4)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--space-6)',
          }}
        >
          {errorMsg}
        </div>
      )}

      {/* Step 1: Registration or Diagnostic Launch */}
      {step === 'register' && (
        <section className="card">
          {isAuthenticated && user ? (
            /* Logged-In Student Experience: Do NOT re-ask credentials */
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                <span style={{ fontSize: '2rem' }}>🎯</span>
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>
                    Adaptive Enrollment Test
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', margin: 'var(--space-1) 0 0 0' }}>
                    A calm, 10-question assessment covering English, Science, Basic Reasoning, Maths, and Hindi to tailor your learning pace, sensory accommodations, and course enrollment.
                  </p>
                </div>
              </div>

              {/* Verified Account Information */}
              <div
                style={{
                  backgroundColor: 'var(--color-info-bg, #f0fdfa)',
                  color: 'var(--color-info-text, #0f766e)',
                  border: '1px solid var(--color-info-border, #99f6e4)',
                  padding: 'var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 'var(--space-6)',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-2)' }}>
                  Confirmed Student Profile
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)', fontSize: '0.9375rem' }}>
                  <div>
                    <span style={{ opacity: 0.85 }}>Student Name: </span>
                    <strong>{user.display_name}</strong>
                  </div>
                  <div>
                    <span style={{ opacity: 0.85 }}>Email: </span>
                    <span>{user.email}</span>
                  </div>
                  {user.age && (
                    <div>
                      <span style={{ opacity: 0.85 }}>Age: </span>
                      <strong>{user.age}</strong> {user.age_band ? ` • ${getStudentGroupName(user.age_band)}` : ' • Enrollment Pending'}
                    </div>
                  )}
                  <div>
                    <span style={{ opacity: 0.85 }}>Learning Preference: </span>
                    <strong>{user.disabilities?.[0]?.label || 'Standard / Adaptive Pace'}</strong>
                  </div>
                </div>
              </div>

              {/* Stress-Free Guarantees */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 'var(--space-3)',
                  marginBottom: 'var(--space-6)',
                  fontSize: '0.875rem',
                }}
              >
                <div style={{ padding: 'var(--space-3)', background: 'rgba(13, 148, 136, 0.08)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(13, 148, 136, 0.2)' }}>
                  <span style={{ fontWeight: 600, color: '#0d9488' }}>⏱️ No Timer Pressure</span>
                  <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>Take as much time as you need to think.</div>
                </div>
                <div style={{ padding: 'var(--space-3)', background: 'rgba(99, 102, 241, 0.08)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                  <span style={{ fontWeight: 600, color: '#6366f1' }}>🌿 Calm Questions</span>
                  <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>Clear choices without confusing trick wording.</div>
                </div>
                <div style={{ padding: 'var(--space-3)', background: 'rgba(245, 158, 11, 0.08)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                  <span style={{ fontWeight: 600, color: '#d97706' }}>🎓 Course Enrollment</span>
                  <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>Automatically recommends courses at your level.</div>
                </div>
              </div>

              <button
                type="button"
                className="button-primary"
                onClick={handleStartDiagnostic}
                disabled={loading}
                style={{ width: '100%', justifyContent: 'center', padding: '12px 24px', fontSize: '1.0625rem', fontWeight: 700 }}
              >
                {loading ? 'Starting Enrollment Test...' : 'Begin Adaptive Enrollment Test →'}
              </button>
            </div>
          ) : (
            /* Guest / Registration Experience (Only for unauthenticated users) */
            <>
              <h2 style={{ fontSize: '1.5rem', marginBottom: 'var(--space-2)' }}>
                Welcome to AdaptAI — Student & Parent Sign Up
              </h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-6)' }}>
                Tell us about yourself so we can tailor the sensory pacing, reading load, and scaffolding depth.
              </p>

              <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div>
                  <label htmlFor="student-name" style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                    Your Name
                  </label>
                  <input
                    id="student-name"
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g., Alex"
                    style={{ width: '100%', padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)' }}
                  />
                </div>

                <div>
                  <label htmlFor="student-email" style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                    Email Address
                  </label>
                  <input
                    id="student-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="student@example.com"
                    style={{ width: '100%', padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)' }}
                  />
                </div>

                <div>
                  <label htmlFor="student-password" style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                    Password (min. 6 characters)
                  </label>
                  <input
                    id="student-password"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{ width: '100%', padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 'var(--space-4)' }}>
                  <div>
                    <label htmlFor="student-age" style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                      Age
                    </label>
                    <input
                      id="student-age"
                      type="number"
                      min={7}
                      max={20}
                      value={age}
                      onChange={(e) => setAge(parseInt(e.target.value) || 12)}
                      style={{ width: '100%', padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)' }}
                    />
                  </div>

                  <div>
                    <label htmlFor="disability-type" style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                      Declared Learning Preference / Disability
                    </label>
                    <select
                      id="disability-type"
                      value={disabilityCode}
                      onChange={(e) => setDisabilityCode(e.target.value)}
                      style={{ width: '100%', padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)', background: 'var(--bg-surface)' }}
                    >
                      <option value="asd">Autism Spectrum Disorder (Predictable structure & sensory calm)</option>
                      <option value="adhd">ADHD (Concise, chunked feedback & bullet points)</option>
                      <option value="dyslexia">Dyslexia (Light reading load, simple sentences & audio)</option>
                      <option value="other_idd">Other Intellectual & Developmental Disability (Step-by-step ZPD)</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginTop: 'var(--space-4)' }}>
                  <button type="submit" className="button-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
                    {loading ? 'Setting Up...' : 'Begin Calm Diagnostic Assessment →'}
                  </button>
                </div>
              </form>
            </>
          )}
        </section>
      )}

      {/* Step 2: Diagnostic Assessment */}
      {step === 'diagnostic' && questions.length > 0 && (
        <section className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 'var(--space-3)' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--primary)' }}>
              Question {currentQuestionIndex + 1} of {questions.length}
            </span>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Take your time • No timer pressure
            </span>
          </div>

          <div style={{ minHeight: '220px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 'var(--space-6)', lineHeight: 1.5 }}>
              {questions[currentQuestionIndex].prompt}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {questions[currentQuestionIndex].options.map((opt) => {
                const isSelected = answers[questions[currentQuestionIndex].id] === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => handleSelectOption(questions[currentQuestionIndex].id, opt.key)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-4)',
                      padding: 'var(--space-4)',
                      borderRadius: 'var(--radius-md)',
                      border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-strong)',
                      background: isSelected ? 'var(--primary-light)' : 'var(--bg-surface)',
                      color: isSelected ? 'var(--primary)' : 'var(--text-primary)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      fontWeight: isSelected ? 600 : 400,
                    }}
                  >
                    <span
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        border: '1px solid currentColor',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '0.875rem',
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

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-8)' }}>
            <button
              type="button"
              className="button-secondary"
              disabled={currentQuestionIndex === 0}
              onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
            >
              ← Previous
            </button>

            {currentQuestionIndex < questions.length - 1 ? (
              <button
                type="button"
                className="button-primary"
                onClick={() => setCurrentQuestionIndex((prev) => prev + 1)}
              >
                Next Question →
              </button>
            ) : (
              <button
                type="button"
                className="button-primary"
                disabled={loading || Object.keys(answers).length < questions.length}
                onClick={handleSubmitDiagnostic}
              >
                {loading ? 'Evaluating...' : 'Complete Assessment & See Course Enrollment →'}
              </button>
            )}
          </div>
        </section>
      )}

      {/* Step 3: Course Enrollment Recommendation */}
      {step === 'recommendation' && result && (
        <section className="card">
          <div
            style={{
              background: 'var(--color-success-bg)',
              color: 'var(--color-success-text)',
              border: '1px solid var(--color-success-border)',
              padding: 'var(--space-4)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--space-6)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
            }}
          >
            <span style={{ fontSize: '1.25rem' }}>✓</span>
            <div>
              <strong>Enrollment Test Complete!</strong> Score: {result.score} / {result.max_score} ({Math.round(result.percentage ?? (result.max_score > 0 ? (result.score / result.max_score) * 100 : 0))}%)
            </div>
          </div>

          <h2 style={{ fontSize: '1.375rem', marginBottom: 'var(--space-2)' }}>
            Your Recommended Learning Path
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-6)' }}>
            {sanitizeStudentText(result.explanation)}
          </p>

          <div
            style={{
              border: '2px solid var(--primary)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-6)',
              background: 'var(--bg-surface-elevated)',
              marginBottom: 'var(--space-6)',
            }}
          >
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                background: 'var(--primary-light)',
                color: 'var(--primary)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
              }}
            >
              Recommended Enrollment
            </span>
            <h3 style={{ fontSize: '1.25rem', marginTop: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
              {result.recommended_course_title || 'Foundations of Science'}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>
              Includes topic-by-topic Daily Practice Problems, multimodal hints (text and audio), and timed chapter tests with reattempts.
            </p>
          </div>

          {/* Enrollment Choice Options */}
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', marginTop: 'var(--space-4)' }}>
            <button
              type="button"
              className="button-primary"
              onClick={handleEnrol}
              disabled={loading}
              style={{ flex: '1 1 240px', justifyContent: 'center', padding: '12px 20px', fontWeight: 700 }}
            >
              {loading ? 'Enrolling...' : '✓ Enrol in Suggested Course →'}
            </button>
            <button
              type="button"
              className="button-secondary"
              onClick={handleDecline}
              disabled={loading}
              style={{ flex: '1 1 240px', justifyContent: 'center', padding: '12px 20px', fontWeight: 600 }}
            >
              Explore Courses →
            </button>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', textAlign: 'center', marginTop: 'var(--space-3)', marginBottom: 0 }}>
            💡 You can always enrol in this suggested course later from the <strong>Explore Courses</strong> tab on your dashboard.
          </p>
        </section>
      )}

      {/* Step 4: Enrolled & Ready to Learn */}
      {step === 'enrolled' && (
        <section className="card" style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-4)' }}>🎉</div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: 'var(--space-2)' }}>
            You Are Successfully Enrolled!
          </h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '520px', margin: '0 auto var(--space-6)' }}>
            Your learning space is configured with your declared preferences. You can practice in Independent mode or with AI-Guided ZPD hints anytime.
          </p>
          <button type="button" className="button-primary" onClick={onBackToHome}>
            Go to Student Learning Dashboard →
          </button>
        </section>
      )}
    </div>
  );
};

export default StudentOnboarding;
