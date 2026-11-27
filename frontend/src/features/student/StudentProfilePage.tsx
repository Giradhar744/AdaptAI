import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getStudentGroupName } from '../../utils/studentGroup';

interface StudentProfilePageProps {
  onBack: () => void;
  onLaunchDiagnostic?: () => void;
  onOpenConsentCenter?: () => void;
  onLogout: () => void;
}

export const StudentProfilePage: React.FC<StudentProfilePageProps> = ({
  onBack,
  onLogout,
}) => {
  const { user } = useAuth();
  const [showSignOutModal, setShowSignOutModal] = useState(false);

  const studentBatch = user?.age_band
    ? getStudentGroupName(user.age_band)
    : 'Batch Alpha';

  const initialLetter = user?.display_name ? user.display_name.charAt(0).toUpperCase() : 'S';

  return (
    <div style={{ width: '100%', margin: '0 auto', padding: 'var(--space-2) 0 var(--space-8) 0' }}>
      {/* Top Navigation Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '28px',
          paddingTop: '4px',
        }}
      >
        <button
          type="button"
          onClick={onBack}
          className="button-secondary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 18px',
            fontSize: '0.875rem',
            fontWeight: 600,
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            background: '#ffffff',
            color: '#334155',
            cursor: 'pointer',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
          }}
        >
          <span style={{ fontSize: '1.05rem', lineHeight: 1 }}>←</span> Return to Dashboard
        </button>

        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: '#f0fdfa',
            color: '#0f766e',
            border: '1px solid #ccfbf1',
            padding: '6px 14px',
            borderRadius: '9999px',
            fontSize: '0.8125rem',
            fontWeight: 600,
          }}
        >
          <span>🎓</span> {user?.role === 'teacher' ? 'Educator Profile' : 'Student Learning Profile'}
        </span>
      </div>

      {/* Main Profile Hero Card */}
      <div
        className="card"
        style={{
          padding: '28px 32px',
          marginBottom: '24px',
          border: '1px solid var(--border-subtle, #e2e8f0)',
          background: 'var(--bg-surface-elevated, #ffffff)',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)',
          borderRadius: '16px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 'var(--space-4)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #0d9488 0%, #2563eb 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.75rem',
                fontWeight: 800,
                boxShadow: '0 4px 12px rgba(13, 148, 136, 0.2)',
                flexShrink: 0,
              }}
            >
              {initialLetter}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                  {user?.display_name || 'Student'}
                </h1>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    padding: '3px 10px',
                    borderRadius: '9999px',
                    background: '#f1f5f9',
                    color: '#475569',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  {user?.role === 'teacher' ? 'Teacher' : 'Student'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Card: Learner Information (Clean 4-Item Grid) */}
      <div
        className="card"
        style={{
          padding: '28px 32px',
          marginBottom: '24px',
          border: '1px solid var(--border-subtle, #e2e8f0)',
          background: 'var(--bg-surface-elevated, #ffffff)',
          borderRadius: '16px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: '#f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.9375rem',
            }}
          >
            👤
          </div>
          <h2
            style={{
              fontSize: '1.125rem',
              fontWeight: 700,
              margin: 0,
              color: 'var(--text-primary)',
              letterSpacing: '-0.01em',
            }}
          >
            Learner Information
          </h2>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '14px',
            fontSize: '0.9375rem',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '14px 18px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
            <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Full Name</span>
            <strong style={{ fontSize: '0.9375rem', color: '#0f172a', fontWeight: 600 }}>{user?.display_name || 'Not provided'}</strong>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '14px 18px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
            <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Email Address</span>
            <strong style={{ fontSize: '0.9375rem', color: '#0f172a', fontWeight: 600 }}>{user?.email}</strong>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '14px 18px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
            <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Age</span>
            <strong style={{ fontSize: '0.9375rem', color: '#0f172a', fontWeight: 600 }}>{user?.age ? `${user.age} years old` : 'Not specified'}</strong>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '14px 18px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
            <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Performance Batch</span>
            <strong style={{ fontSize: '0.9375rem', color: '#0d9488', fontWeight: 600 }}>{studentBatch}</strong>
          </div>
        </div>
      </div>

      {/* Card: Minimal Sign Out Section */}
      <div
        className="card"
        style={{
          padding: '18px 32px',
          background: 'var(--bg-surface-elevated, #ffffff)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderRadius: '16px',
          border: '1px solid var(--border-subtle, #e2e8f0)',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#10b981',
              display: 'inline-block',
            }}
          />
          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary, #64748b)' }}>
            Current Session: <strong style={{ color: '#0f172a', fontWeight: 600 }}>Active</strong>
          </span>
        </div>

        <button
          type="button"
          onClick={() => setShowSignOutModal(true)}
          style={{
            color: '#dc2626',
            border: '1px solid #fecaca',
            background: '#fef2f2',
            padding: '8px 20px',
            fontWeight: 600,
            fontSize: '0.875rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            borderRadius: '8px',
            transition: 'background-color 0.15s ease',
          }}
        >
          <span>🚪</span> Sign Out
        </button>
      </div>

      {/* Confirmation Sign Out Modal */}
      {showSignOutModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="signout-dialog-title"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 'var(--space-4)',
          }}
          onClick={() => setShowSignOutModal(false)}
        >
          <div
            className="card"
            style={{
              maxWidth: '440px',
              width: '100%',
              padding: '28px 32px',
              background: 'var(--bg-surface-elevated, #ffffff)',
              borderRadius: '16px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
              border: '1px solid var(--border-subtle, #e2e8f0)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  background: '#fef2f2',
                  border: '1px solid #fee2e2',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.25rem',
                  flexShrink: 0,
                }}
              >
                🚪
              </div>
              <h3 id="signout-dialog-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                Sign Out of AdaptAI?
              </h3>
            </div>

            <p style={{ color: 'var(--text-secondary, #64748b)', fontSize: '0.9375rem', margin: '0 0 24px 0', lineHeight: 1.5 }}>
              Are you sure you want to leave? Your study session progress is safely saved.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                className="button-secondary"
                onClick={() => setShowSignOutModal(false)}
                style={{
                  padding: '9px 18px',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#334155',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                className="button-primary"
                onClick={() => {
                  setShowSignOutModal(false);
                  onLogout();
                }}
                style={{
                  background: '#dc2626',
                  borderColor: '#dc2626',
                  color: '#ffffff',
                  padding: '9px 20px',
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  borderRadius: '8px',
                  cursor: 'pointer',
                }}
              >
                Yes, Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
