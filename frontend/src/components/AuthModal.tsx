import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: 'login' | 'register';
  defaultRole?: 'student' | 'teacher';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  defaultMode = 'login',
  defaultRole = 'student',
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

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register({
          email,
          password,
          role,
          display_name: displayName,
          age: role === 'student' ? age : undefined,
          disability_type_code: role === 'student' ? disabilityCode : undefined,
        });
      }
      onClose();
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
        if (e.target === e.currentTarget) onClose();
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
          {mode === 'login' ? 'Welcome Back to AdaptAI' : 'Join the AdaptAI Platform'}
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', marginBottom: 'var(--space-4)' }}>
          {mode === 'login'
            ? 'Sign in to access your customized learning space or educator analytics.'
            : 'Select your role to start your tailored neurodivergent learning journey.'}
        </p>

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
            {loading ? 'Processing...' : mode === 'login' ? 'Sign In' : `Register as ${role === 'student' ? 'Student' : 'Teacher'}`}
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
      </div>
    </div>
  );
};
