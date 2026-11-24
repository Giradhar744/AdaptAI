import React from 'react';

export type LoadingPreset =
  | 'authLogin'
  | 'authRegister'
  | 'evaluatingTest'
  | 'evaluatingDiagnostic'
  | 'aiGenerating'
  | 'loadingCurriculum'
  | 'savingData';

export interface LoadingScreenProps {
  preset?: LoadingPreset;
  title?: string;
  subtitle?: string;
  icon?: string;
  steps?: string[];
  variant?: 'fullscreen' | 'card' | 'inline';
  accentColor?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  variant = 'card',
  accentColor = 'var(--primary, #0d9488)',
}) => {
  const content = (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '32px 16px',
        margin: '0 auto',
        background: 'transparent',
        border: 'none',
        boxShadow: 'none',
      }}
    >
      {/* Simple Rotating Circle */}
      <div
        style={{
          width: '42px',
          height: '42px',
          borderRadius: '50%',
          border: '3.5px solid var(--border-subtle, rgba(0, 0, 0, 0.1))',
          borderTopColor: accentColor,
          animation: 'spin 0.85s linear infinite',
        }}
      />
      {/* Just the word Loading */}
      <span
        style={{
          fontSize: '0.9375rem',
          fontWeight: 600,
          color: 'var(--text-secondary, #64748b)',
          letterSpacing: '0.02em',
        }}
      >
        Loading...
      </span>
    </div>
  );

  if (variant === 'fullscreen') {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '16px',
        }}
      >
        {content}
      </div>
    );
  }

  return content;
};

export default LoadingScreen;
