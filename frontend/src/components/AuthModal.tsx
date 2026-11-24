import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { LoadingScreen } from './LoadingScreen';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: 'login' | 'register';
  defaultRole?: 'student' | 'teacher';
  onSuccess?: (role?: 'student' | 'teacher', wasRegistration?: boolean) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  defaultMode = 'login',
  defaultRole = 'student',
  onSuccess,
}) => {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>(defaultMode);
  const [role, setRole] = useState<'student' | 'teacher'>(defaultRole);

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [age, setAge] = useState<number>(13);
  const [disabilityCode, setDisabilityCode] = useState('asd');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Redirection transition state after student registration
  const [isRedirectingToTest, setIsRedirectingToTest] = useState(false);
  const [countdown, setCountdown] = useState(3);

  const handleProceedToTest = () => {
    setIsRedirectingToTest(false);
    if (onSuccess) {
      onSuccess('student', true);
    }
    onClose();
  };

  // Synchronize internal mode and role whenever modal opens or defaultMode/defaultRole props change
  useEffect(() => {
    if (isOpen) {
      setMode(defaultMode);
      setRole(defaultRole);
      setErrorMsg(null);
      setPassword('');
      setIsRedirectingToTest(false);
      setCountdown(3);
    }
  }, [isOpen, defaultMode, defaultRole]);

  // Countdown timer for automatic test redirection
  useEffect(() => {
    if (!isRedirectingToTest) return;

    if (countdown <= 0) {
      handleProceedToTest();
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [isRedirectingToTest, countdown]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      if (mode === 'login') {
        await login(email, password);
        if (onSuccess) {
          onSuccess(role, false);
        }
        onClose();
      } else {
        await register({
          email,
          password,
          role,
          display_name: displayName,
          age: role === 'student' ? age : undefined,
          disability_type_code: role === 'student' ? disabilityCode : undefined,
        });

        if (role === 'student') {
          setIsRedirectingToTest(true);
          setCountdown(3);
        } else {
          if (onSuccess) {
            onSuccess(role, true);
          }
          onClose();
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
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
        if (e.target === e.currentTarget) {
          if (isRedirectingToTest) {
            handleProceedToTest();
          } else {
            onClose();
          }
        }
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: '480px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--border-strong)',
        }}
      >
        {isRedirectingToTest ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-6) var(--space-4)' }}>
            <div
              style={{
                width: '68px',
                height: '68px',
                borderRadius: '50%',
                background: 'var(--primary-light, #ccfbf1)',
                color: 'var(--primary, #0f766e)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem',
                margin: '0 auto var(--space-4)',
                boxShadow: '0 0 0 8px rgba(13, 148, 136, 0.12)',
              }}
            >
              🎯
            </div>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.8125rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                padding: '4px 14px',
                borderRadius: 'var(--radius-full)',
                background: 'var(--color-success-bg, #ecfdf5)',
                color: 'var(--color-success-text, #065f46)',
                border: '1px solid var(--color-success-border, #a7f3d0)',
                marginBottom: 'var(--space-3)',
              }}
            >
              <span>✓</span> Account Created Successfully
            </div>

            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 var(--space-2) 0', color: 'var(--text-primary)' }}>
              Welcome, {displayName || 'Student'}!
            </h2>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', lineHeight: 1.6, margin: '0 auto var(--space-6)', maxWidth: '420px' }}>
              Before opening your dashboard, you need to complete your <strong>Enrollment Test</strong>. This calm, 10-question assessment finds your exact level to assign your learning batch (<strong>Batch Alpha</strong>, <strong>Batch Beta</strong>, or <strong>Batch Gamma</strong>) and tailor your courses.
            </p>

            <div
              style={{
                background: 'var(--bg-muted, #f8fafc)',
                border: '1px solid var(--border-subtle, #e2e8f0)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-3)',
                marginBottom: 'var(--space-6)',
              }}
            >
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  border: '3px solid var(--border-subtle, #cbd5e1)',
                  borderTopColor: 'var(--primary, #0f766e)',
                  animation: 'spin 0.85s linear infinite',
                }}
              />
              <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Redirecting you to test in <strong>{countdown}s</strong>...
              </span>
            </div>

            <button
              type="button"
              className="button-primary"
              onClick={handleProceedToTest}
              style={{ width: '100%', justifyContent: 'center', padding: '12px 20px', fontSize: '1.0625rem', fontWeight: 700 }}
            >
              Start Enrollment Test Now →
            </button>
          </div>
        ) : loading ? (
          <div style={{ padding: 'var(--space-2) 0' }}>
            <LoadingScreen
              preset={mode === 'login' ? 'authLogin' : 'authRegister'}
              title={
                mode === 'login'
                  ? 'Signing In to AdaptAI...'
                  : `Creating ${role === 'student' ? 'Student' : 'Teacher'} Account...`
              }
              subtitle={
                mode === 'login'
                  ? 'Verifying your credentials and loading your personalized workspace...'
                  : 'Registering user in the database with your accommodation preferences...'
              }
              variant="inline"
            />
          </div>
        ) : (
          <>
            {/* Header with Mode Tabs */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button
              type="button"
              className={`btn-a11y ${mode === 'login' ? 'active' : ''}`}
              onClick={() => {
                setMode('login');
                setErrorMsg(null);
              }}
              style={{ padding: '6px 16px', fontWeight: 600 }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`btn-a11y ${mode === 'register' ? 'active' : ''}`}
              onClick={() => {
                setMode('register');
                setErrorMsg(null);
              }}
              style={{ padding: '6px 16px', fontWeight: 600 }}
            >
              Create Account
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.25rem',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: '4px 8px',
            }}
          >
            ✕
          </button>
        </div>

        <h2 id="auth-modal-title" style={{ fontSize: '1.375rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
          {mode === 'login' ? 'Sign In to AdaptAI' : 'Create an Account'}
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', marginBottom: 'var(--space-4)' }}>
          {mode === 'login'
            ? 'Sign in to access your customized learning space or educator analytics.'
            : 'Select your role to start your tailored neurodivergent learning journey.'}
        </p>

        {/* Quick Demo Credentials Autofill */}
        {mode === 'login' && (
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: 'var(--bg-subtle, #f1f5f9)',
              border: '1px solid var(--border-subtle, #e2e8f0)',
              borderRadius: 'var(--radius-sm)',
              marginBottom: 'var(--space-4)',
              fontSize: '0.8125rem',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
              ⚡ Quick Demo Sign In:
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button
                type="button"
                className="btn-a11y"
                onClick={() => {
                  setEmail('student@adaptai.edu');
                  setPassword('password123');
                  setErrorMsg(null);
                }}
                style={{ fontSize: '0.8125rem', padding: '6px 10px', flex: 1, textAlign: 'center' }}
              >
                🎓 Demo Student
              </button>
              <button
                type="button"
                className="btn-a11y"
                onClick={() => {
                  setEmail('teacher@adaptai.edu');
                  setPassword('password123');
                  setErrorMsg(null);
                }}
                style={{ fontSize: '0.8125rem', padding: '6px 10px', flex: 1, textAlign: 'center' }}
              >
                👩‍🏫 Demo Teacher
              </button>
            </div>
          </div>
        )}

        {/* Role Toggle for Registration */}
        {mode === 'register' && (
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: 'var(--space-2)' }}>
              I am joining as:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
              <button
                type="button"
                className={`btn-a11y ${role === 'student' ? 'active' : ''}`}
                onClick={() => setRole('student')}
                style={{ textAlign: 'center', padding: '10px' }}
              >
                🎓 Student / Parent
              </button>
              <button
                type="button"
                className={`btn-a11y ${role === 'teacher' ? 'active' : ''}`}
                onClick={() => setRole('teacher')}
                style={{ textAlign: 'center', padding: '10px' }}
              >
                👩‍🏫 Teacher / Educator
              </button>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div
            role="alert"
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

        <form onSubmit={handleSubmit}>
          {/* Display Name (Register only) */}
          {mode === 'register' && (
            <div style={{ marginBottom: 'var(--space-3)' }}>
              <label htmlFor="auth-name" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '4px' }}>
                Full Name or Display Name
              </label>
              <input
                id="auth-name"
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={role === 'student' ? 'e.g., Alex Johnson' : 'e.g., Dr. Jane Smith'}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-strong)',
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9375rem',
                }}
              />
            </div>
          )}

          {/* Email */}
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <label htmlFor="auth-email" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '4px' }}>
              Email Address
            </label>
            <input
              id="auth-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-strong)',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontSize: '0.9375rem',
              }}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label htmlFor="auth-password" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '4px' }}>
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-strong)',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontSize: '0.9375rem',
              }}
            />
          </div>

          {/* Student Specific Fields */}
          {mode === 'register' && role === 'student' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                <div>
                  <label htmlFor="auth-age" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '4px' }}>
                    Student Age
                  </label>
                  <input
                    id="auth-age"
                    type="number"
                    min={5}
                    max={25}
                    required
                    value={age}
                    onChange={(e) => setAge(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-strong)',
                      backgroundColor: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                      fontSize: '0.9375rem',
                    }}
                  />
                </div>

                <div>
                  <label htmlFor="auth-disability" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '4px' }}>
                    Learning Profile
                  </label>
                  <select
                    id="auth-disability"
                    value={disabilityCode}
                    onChange={(e) => setDisabilityCode(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-strong)',
                      backgroundColor: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                      fontSize: '0.9375rem',
                    }}
                  >
                    <option value="asd">Autism Spectrum (ASD)</option>
                    <option value="adhd">ADHD (Focus & Pacing)</option>
                    <option value="dyslexia">Dyslexia (Visual/Phonological)</option>
                    <option value="other_idd">Other Intellectual/Developmental</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className="button-primary"
            disabled={loading}
            style={{ width: '100%', padding: '12px', fontSize: '1rem', marginTop: 'var(--space-2)' }}
          >
            {loading ? 'Processing...' : mode === 'login' ? 'Sign In' : `Create ${role === 'student' ? 'Student' : 'Teacher'} Account`}
          </button>
        </form>

        <div style={{ marginTop: 'var(--space-4)', textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          {mode === 'login' ? (
            <span>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setErrorMsg(null);
                }}
                style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
              >
                Create one now
              </button>
            </span>
          ) : (
            <span>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMsg(null);
                }}
                style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
              >
                Sign in here
              </button>
            </span>
          )}
        </div>
          </>
        )}
      </div>
    </div>
  );
};
