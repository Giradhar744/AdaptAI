import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

interface CoursePurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  course: {
    id: string;
    title: string;
    subject: string;
    age_band_label?: string;
    fee: number;
    teacher_name?: string;
  } | null;
  onEnrollSuccess: (courseId: string) => void;
}

export const CoursePurchaseModal: React.FC<CoursePurchaseModalProps> = ({
  isOpen,
  onClose,
  course,
  onEnrollSuccess,
}) => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !course) return null;

  const handleConfirmEnroll = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/v1/courses/${course.id}/enrol`, {
        method: 'POST',
        headers,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Could not join course. Please try again.');
      }

      onEnrollSuccess(course.id);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 'var(--space-4)',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="enroll-modal-title"
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '520px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-strong)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
          padding: 'var(--space-6)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <span className="brand-badge" style={{ background: '#059669', color: '#ffffff' }}>
            Free Course Demo
          </span>
          <button
            type="button"
            onClick={onClose}
            className="btn-a11y"
            aria-label="Close dialog"
            style={{ fontSize: '1.25rem', padding: '2px 8px' }}
          >
            ✕
          </button>
        </div>

        <h2 id="enroll-modal-title" style={{ fontSize: '1.375rem', fontWeight: 800, marginBottom: 'var(--space-2)' }}>
          Join Course: {course.title}
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', marginBottom: 'var(--space-4)' }}>
          Subject: <strong>{course.subject}</strong> · Age Group: <strong>{course.age_band_label || 'All Ages'}</strong>
        </p>

        {/* Pricing Summary Card */}
        <div
          style={{
            background: 'var(--surface-sunken)',
            padding: 'var(--space-4)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            marginBottom: 'var(--space-4)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)' }}>Course Fee:</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {course.fee > 0 ? `$${course.fee.toFixed(2)}` : 'Free'}
            </span>
          </div>

          <div
            style={{
              fontSize: '0.8125rem',
              color: '#059669',
              background: 'rgba(5, 150, 105, 0.1)',
              padding: '6px 10px',
              borderRadius: 'var(--radius-sm)',
              marginTop: 'var(--space-2)',
            }}
          >
            ✨ <strong>Free Learning Demo:</strong> No credit card or real payment is needed. Click confirm below to unlock all lessons, videos, and AI practice questions immediately!
          </div>
        </div>

        {error && (
          <div
            style={{
              padding: 'var(--space-3)',
              marginBottom: 'var(--space-4)',
              background: 'rgba(225, 29, 72, 0.1)',
              color: '#be123c',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.875rem',
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-6)' }}>
          <button
            type="button"
            className="button-secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="button-primary"
            onClick={handleConfirmEnroll}
            disabled={loading}
            style={{ minWidth: '150px' }}
          >
            {loading ? 'Joining Course...' : 'Confirm & Start Learning →'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CoursePurchaseModal;
