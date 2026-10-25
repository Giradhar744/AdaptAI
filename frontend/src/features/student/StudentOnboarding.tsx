import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

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

export const StudentOnboarding: React.FC<{ onBackToHome: () => void }> = ({ onBackToHome }) => {
  const { user, token: authContextToken, refreshProfile } = useAuth();
  const [step, setStep] = useState<'register' | 'diagnostic' | 'recommendation' | 'enrolled'>('register');

  // Registration state
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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync token from AuthContext if present
  useEffect(() => {
    if (authContextToken) {
      setToken(authContextToken);
    }
  }, [authContextToken]);

  // 1. Submit Registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          role: 'student',
          display_name: displayName,
          age,
          disability_type_code: disabilityCode,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Registration failed');
      }

      const data = await res.json();
      const accessToken = data.access_token;
      localStorage.setItem('adaptai_access_token', accessToken);
      setToken(accessToken);
      await refreshProfile();

      // Fetch user profile to get student_id
      const meRes = await fetch('/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const meData = await meRes.json();

      // Start Diagnostic
      await startDiagnostic(meData.student_id, accessToken);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 2. Start Diagnostic Test
  const startDiagnostic = async (sId: string, authToken: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/students/${sId}/diagnostic/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) throw new Error('Could not initiate diagnostic test.');

      const data = await res.json();
      setDiagnosticId(data.diagnostic_id);
      setQuestions(data.questions || []);
      setCurrentQuestionIndex(0);
      setStep('diagnostic');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 3. Record Answer for Current Question
  const handleSelectOption = (questionId: string, optionKey: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionKey }));
  };

  // 4. Submit Diagnostic Answers
  const handleSubmitDiagnostic = async () => {
    if (!diagnosticId || !token) return;
    setLoading(true);

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
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ answers: submissions }),
      });
      if (!res.ok) throw new Error('Failed to submit diagnostic answers.');

      const data = await res.json();
      setResult(data);
      setStep('recommendation');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 5. Enrol in recommended course
  const handleEnrol = async () => {
    if (!result?.recommended_course_id || !token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/courses/${result.recommended_course_id}/enrol`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Enrollment failed');
      setStep('enrolled');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: 'var(--space-6) 0' }}>
      <button
        type="button"
        className="button-secondary"
        onClick={onBackToHome}
        style={{ marginBottom: 'var(--space-6)' }}
      >
        ← Back to Overview
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

      {/* Step 1: Registration & Disability Declaration */}
      {step === 'register' && (
        <section className="card">
          <h2 style={{ fontSize: '1.5rem', marginBottom: 'var(--space-2)' }}>
            Welcome to AdaptAI — Student & Parent Sign Up
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-6)' }}>
            Tell us about yourself so we can tailor the sensory pacing, reading load, and scaffolding depth.
          </p>

          {user?.student_id && token && (
            <div
              style={{
                backgroundColor: 'var(--color-info-bg)',
                color: 'var(--color-info-text)',
                border: '1px solid var(--color-info-border)',
                padding: 'var(--space-4)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 'var(--space-6)',
              }}
            >
              <p style={{ fontWeight: 600, marginBottom: 'var(--space-2)', fontSize: '0.9375rem' }}>
                👋 Signed in as <strong>{user.display_name}</strong> ({user.email})
              </p>
              <p style={{ fontSize: '0.875rem', marginBottom: 'var(--space-3)' }}>
                You can begin your adaptive placement diagnostic immediately with your account.
              </p>
              <button
                type="button"
                className="button-primary"
                onClick={() => startDiagnostic(user.student_id!, token)}
                disabled={loading}
                style={{ padding: '8px 16px', fontSize: '0.9375rem' }}
              >
                {loading ? 'Starting Diagnostic...' : 'Launch Placement Diagnostic Now →'}
              </button>
            </div>
          )}

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
                {loading ? 'Evaluating...' : 'Complete Assessment & See Course Placement →'}
              </button>
            )}
          </div>
        </section>
      )}

      {/* Step 3: Course Placement Recommendation */}
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
              <strong>Diagnostic Complete!</strong> Score: {result.score} / {result.max_score} ({result.percentage.toFixed(0)}%)
            </div>
          </div>

          <h2 style={{ fontSize: '1.375rem', marginBottom: 'var(--space-2)' }}>
            Your Recommended Learning Path
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-6)' }}>
            {result.explanation}
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
              Recommended Placement
            </span>
            <h3 style={{ fontSize: '1.25rem', marginTop: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
              {result.recommended_course_title || 'Foundations of Science'}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>
              Includes topic-by-topic Daily Practice Problems, multimodal hints (text and audio), and timed chapter tests with reattempts.
            </p>
          </div>

          <button
            type="button"
            className="button-primary"
            onClick={handleEnrol}
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {loading ? 'Enrolling...' : 'Accept Placement & Enrol in Course →'}
          </button>
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
