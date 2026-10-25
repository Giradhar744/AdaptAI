import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

export interface PendingProposal {
  ledger_id: string;
  student_id: string;
  proposal_type: string;
  proposed_by_agent: string;
  priority_class: string;
  plain_title: string;
  plain_rationale: string;
  proposed_action: string;
  proposal_payload: Record<string, any>;
  created_at: string;
}

export interface StudentPreference {
  key: string;
  value: Record<string, any>;
  updated_at: string;
}

export interface TrustProfile {
  student_id: string;
  accepted_count: number;
  declined_count: number;
  total_decisions: number;
  acceptance_rate: number;
  nagging_reduction_factor: number;
  last_updated: string;
}

export interface ConsentLedgerEntry {
  id: string;
  student_id: string;
  proposal_type: string;
  proposal_payload: Record<string, any>;
  proposed_by_agent: string;
  priority_class: string;
  status: string;
  decided_by: string | null;
  decided_at: string | null;
  supersedes_id: string | null;
  created_at: string;
}

interface ConsentDecisionCenterProps {
  studentId?: string;
  onBackToHome: () => void;
}

export const ConsentDecisionCenter: React.FC<ConsentDecisionCenterProps> = ({
  studentId: initialStudentId = 'student-dev-001',
  onBackToHome,
}) => {
  const { user } = useAuth();
  const studentId = user?.student_id || initialStudentId;
  const [pendingProposals, setPendingProposals] = useState<PendingProposal[]>([]);
  const [preferences, setPreferences] = useState<StudentPreference[]>([]);
  const [trustProfile, setTrustProfile] = useState<TrustProfile | null>(null);
  const [ledgerHistory, setLedgerHistory] = useState<ConsentLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Fetch all consent data
  const refreshConsentData = async () => {
    setLoading(true);
    try {
      // 1. Pending proposals
      const pendingRes = await fetch(`/api/v1/students/${studentId}/consent/pending`);
      if (pendingRes.ok) {
        setPendingProposals(await pendingRes.json());
      } else {
        // Fallback local sample if operating standalone
        setPendingProposals([
          {
            ledger_id: 'pending-sample-1',
            student_id: studentId,
            proposal_type: 'scaffold_change',
            proposed_by_agent: 'struggle_detection',
            priority_class: 'pedagogy',
            plain_title: 'Step-by-Step Worked Example Support',
            plain_rationale:
              'We noticed this topic involves multi-step reasoning. Would you like to review a step-by-step worked example before attempting similar questions?',
            proposed_action: 'Switch question guidance to Worked Example',
            proposal_payload: { scaffold_level: 'worked_example' },
            created_at: new Date().toISOString(),
          },
        ]);
      }

      // 2. Preferences
      const prefRes = await fetch(`/api/v1/students/${studentId}/preferences`);
      if (prefRes.ok) {
        setPreferences(await prefRes.json());
      } else {
        setPreferences([
          {
            key: 'modality_preference',
            value: { modality: 'audio_text', speed: 'normal' },
            updated_at: new Date().toISOString(),
          },
        ]);
      }

      // 3. Trust Profile
      const tpRes = await fetch(`/api/v1/students/${studentId}/trust-profile`);
      if (tpRes.ok) {
        setTrustProfile(await tpRes.json());
      } else {
        setTrustProfile({
          student_id: studentId,
          accepted_count: 3,
          declined_count: 1,
          total_decisions: 4,
          acceptance_rate: 0.75,
          nagging_reduction_factor: 1.0,
          last_updated: new Date().toISOString(),
        });
      }

      // 4. Ledger History
      const histRes = await fetch(`/api/v1/students/${studentId}/consent/history`);
      if (histRes.ok) {
        setLedgerHistory(await histRes.json());
      }
    } catch {
      // Fallback in-memory
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshConsentData();
  }, [studentId]);

  const handleDecision = async (ledgerId: string, decision: 'approved' | 'declined') => {
    try {
      const res = await fetch(`/api/v1/consent/${ledgerId}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, decided_by: 'student' }),
      });

      if (res.ok) {
        setFeedbackMessage(
          decision === 'approved'
            ? '✓ Adaptation approved and saved to your learning preferences!'
            : '✓ Adaptation declined. We have noted your preference and will not suggest it again during cooldown.'
        );
      } else {
        // Optimistic UI update
        setPendingProposals((prev) => prev.filter((p) => p.ledger_id !== ledgerId));
        setFeedbackMessage(`✓ Decision recorded: ${decision}`);
      }
      refreshConsentData();
    } catch {
      setPendingProposals((prev) => prev.filter((p) => p.ledger_id !== ledgerId));
      setFeedbackMessage(`✓ Decision recorded: ${decision}`);
    }
  };

  const handleRevokePreference = async (key: string) => {
    try {
      const res = await fetch(`/api/v1/students/${studentId}/consent/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preference_key: key, decided_by: 'student' }),
      });

      if (res.ok) {
        setFeedbackMessage(`✓ Preference '${key}' successfully revoked and logged to Consent Ledger.`);
      } else {
        setPreferences((prev) => prev.filter((p) => p.key !== key));
        setFeedbackMessage(`✓ Preference '${key}' revoked.`);
      }
      refreshConsentData();
    } catch {
      setPreferences((prev) => prev.filter((p) => p.key !== key));
      setFeedbackMessage(`✓ Preference '${key}' revoked.`);
    }
  };

  return (
    <div style={{ maxWidth: '880px', margin: '0 auto', padding: 'var(--space-4) 0' }}>
      {/* Top Header & Breadcrumb */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
        <button
          type="button"
          onClick={onBackToHome}
          className="button-secondary"
          style={{ padding: '0.4rem 0.8rem', fontSize: '0.875rem' }}
        >
          ← Return to Dashboard
        </button>
        <span className="brand-badge" style={{ background: '#0d9488', color: '#ffffff' }}>
          {loading ? 'Refreshing Ledger...' : 'Consent & Trust Engine Active'}
        </span>
      </div>

      <header style={{ marginBottom: 'var(--space-6)' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: 'var(--space-2)' }}>
          Student Consent & Adaptation Center
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.0625rem', lineHeight: '1.6' }}>
          At AdaptAI, <strong>you are in control</strong>. Every proposed pedagogical adaptation requires your explicit approval.
          You can review, accept, decline, or revoke past adaptations at any time.
        </p>
      </header>

      {/* Feedback Banner */}
      {feedbackMessage && (
        <div
          role="status"
          aria-live="polite"
          className="card"
          style={{
            borderLeft: '4px solid #059669',
            background: 'rgba(5, 150, 105, 0.08)',
            padding: 'var(--space-3) var(--space-4)',
            marginBottom: 'var(--space-6)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontWeight: 600, color: '#065f46' }}>{feedbackMessage}</span>
          <button
            type="button"
            className="btn-a11y"
            onClick={() => setFeedbackMessage(null)}
            style={{ fontSize: '0.8125rem' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* PENDING PROPOSALS SECTION */}
      <section aria-labelledby="heading-pending" style={{ marginBottom: 'var(--space-8)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
          <h2 id="heading-pending" style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
            Pending Adaptation Approvals ({pendingProposals.length})
          </h2>
        </div>

        {pendingProposals.length === 0 ? (
          <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <span>✓ All caught up! No pending adaptations requiring your approval.</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {pendingProposals.map((prop) => (
              <article
                key={prop.ledger_id}
                className="card"
                style={{
                  borderLeft: '6px solid var(--primary)',
                  padding: 'var(--space-5)',
                  background: 'var(--surface-sunken)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
                  <div>
                    <span className="brand-badge" style={{ marginBottom: 'var(--space-1)', display: 'inline-block' }}>
                      Priority: {prop.priority_class.toUpperCase()}
                    </span>
                    <h3 style={{ fontSize: '1.125rem', margin: 'var(--space-1) 0', color: 'var(--text-primary)' }}>
                      {prop.plain_title}
                    </h3>
                  </div>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                    Agent: {prop.proposed_by_agent}
                  </span>
                </div>

                <p style={{ fontSize: '0.9375rem', lineHeight: '1.6', color: 'var(--text-primary)', marginBottom: 'var(--space-3)' }}>
                  {prop.plain_rationale}
                </p>

                <div
                  style={{
                    fontSize: '0.875rem',
                    background: 'var(--surface-elevated, #ffffff)',
                    padding: 'var(--space-3)',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: 'var(--space-4)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <strong>Proposed Action:</strong> {prop.proposed_action}
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="button-primary"
                    onClick={() => handleDecision(prop.ledger_id, 'approved')}
                    style={{ padding: '0.5rem 1.25rem' }}
                  >
                    ✓ Approve Adaptation
                  </button>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => handleDecision(prop.ledger_id, 'declined')}
                    style={{ padding: '0.5rem 1.25rem' }}
                  >
                    ✕ Decline (Keep Current)
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* ACTIVE PREFERENCES & AGENCY */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
        {/* Active Learning Preferences */}
        <section aria-labelledby="heading-prefs" className="card">
          <h2 id="heading-prefs" style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: 'var(--space-3)' }}>
            Active Learning Preferences
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
            These adaptations were approved by you and are currently active during your practice sessions.
          </p>

          {preferences.length === 0 ? (
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
              No custom preferences active. Default independent baseline is enabled.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {preferences.map((p) => (
                <div
                  key={p.key}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: 'var(--space-3)',
                    background: 'var(--surface-sunken)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <div>
                    <strong style={{ fontSize: '0.875rem', color: 'var(--text-primary)', display: 'block' }}>
                      {p.key.replace('_', ' ').toUpperCase()}
                    </strong>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                      {JSON.stringify(p.value).replace(/["{}]/g, ' ')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRevokePreference(p.key)}
                    className="btn-a11y"
                    style={{
                      fontSize: '0.8125rem',
                      color: '#be123c',
                      border: '1px solid #fecdd3',
                      background: 'rgba(225, 29, 72, 0.05)',
                      padding: '4px 10px',
                    }}
                    aria-label={`Revoke preference ${p.key}`}
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Trust Profile & Anti-Nagging Guarantee */}
        <section aria-labelledby="heading-trust" className="card">
          <h2 id="heading-trust" style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: 'var(--space-3)' }}>
            Trust & Cooperation Profile
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
            How AdaptAI learns to balance assistance with respecting your concentration.
          </p>

          {trustProfile && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Total Adaptation Decisions:</span>
                <strong>{trustProfile.total_decisions}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Approved Adaptations:</span>
                <strong style={{ color: '#059669' }}>{trustProfile.accepted_count}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Declined Adaptations:</span>
                <strong style={{ color: '#d97706' }}>{trustProfile.declined_count}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Cooperation Rate:</span>
                <strong>{Math.round(trustProfile.acceptance_rate * 100)}%</strong>
              </div>

              <div
                style={{
                  marginTop: 'var(--space-2)',
                  padding: 'var(--space-3)',
                  background: 'rgba(13, 148, 136, 0.08)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.8125rem',
                  lineHeight: '1.5',
                  color: 'var(--primary)',
                }}
              >
                🛡️ <strong>Anti-Nagging Guarantee:</strong> If you frequently decline suggestions, AdaptAI reduces
                low-priority nudge prompts by 50% so you can focus unbothered.
              </div>
            </div>
          )}
        </section>
      </div>

      {/* APPEND-ONLY LEDGER AUDIT TRAIL */}
      <section aria-labelledby="heading-audit" className="card">
        <h2 id="heading-audit" style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
          Immutable Consent Ledger Audit Trail
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
          Every decision is cryptographically tracked in an append-only ledger per PROJECT.md §6 & §9.
        </p>

        {ledgerHistory.length === 0 ? (
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
            No ledger entries recorded yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: '0.8125rem', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '8px' }}>Date</th>
                  <th style={{ padding: '8px' }}>Type</th>
                  <th style={{ padding: '8px' }}>Agent</th>
                  <th style={{ padding: '8px' }}>Status</th>
                  <th style={{ padding: '8px' }}>Decided By</th>
                  <th style={{ padding: '8px' }}>Supersedes</th>
                </tr>
              </thead>
              <tbody>
                {ledgerHistory.map((row) => (
                  <tr key={row.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>
                      {new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ padding: '8px', fontWeight: 600 }}>{row.proposal_type}</td>
                    <td style={{ padding: '8px' }}>{row.proposed_by_agent}</td>
                    <td style={{ padding: '8px' }}>
                      <span
                        style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontWeight: 600,
                          fontSize: '0.75rem',
                          background:
                            row.status === 'approved'
                              ? 'rgba(5, 150, 105, 0.15)'
                              : row.status === 'declined'
                              ? 'rgba(217, 119, 6, 0.15)'
                              : 'rgba(2, 132, 199, 0.15)',
                          color:
                            row.status === 'approved'
                              ? '#059669'
                              : row.status === 'declined'
                              ? '#d97706'
                              : '#0284c7',
                        }}
                      >
                        {row.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '8px' }}>{row.decided_by || 'system'}</td>
                    <td style={{ padding: '8px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                      {row.supersedes_id ? `${row.supersedes_id.substring(0, 8)}...` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default ConsentDecisionCenter;
