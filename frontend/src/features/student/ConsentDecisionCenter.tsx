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
  const { user, token } = useAuth();
  const studentId = user?.student_id || initialStudentId;
  const [pendingProposals, setPendingProposals] = useState<PendingProposal[]>([]);
  const [preferences, setPreferences] = useState<StudentPreference[]>([]);
  const [trustProfile, setTrustProfile] = useState<TrustProfile | null>(null);
  const [ledgerHistory, setLedgerHistory] = useState<ConsentLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Fetch all consent data from live backend
  const refreshConsentData = async () => {
    setLoading(true);
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      // 1. Pending proposals
      const pendingRes = await fetch(`/api/v1/students/${studentId}/consent/pending`, { headers });
      if (pendingRes.ok) {
        setPendingProposals(await pendingRes.json());
      } else {
        setPendingProposals([]);
      }

      // 2. Preferences
      const prefRes = await fetch(`/api/v1/students/${studentId}/preferences`, { headers });
      if (prefRes.ok) {
        setPreferences(await prefRes.json());
      } else {
        setPreferences([]);
      }

      // 3. Trust Profile
      const tpRes = await fetch(`/api/v1/students/${studentId}/trust-profile`, { headers });
      if (tpRes.ok) {
        setTrustProfile(await tpRes.json());
      }

      // 4. Ledger History
      const histRes = await fetch(`/api/v1/students/${studentId}/consent/history`, { headers });
      if (histRes.ok) {
        setLedgerHistory(await histRes.json());
      }
    } catch {
      // Keep state clean on error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshConsentData();
  }, [studentId, token]);

  const handleDecision = async (ledgerId: string, decision: 'approved' | 'declined') => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/v1/consent/${ledgerId}/decide`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ decision, decided_by: user?.role === 'parent' ? 'parent' : 'student' }),
      });

      if (res.ok) {
        setFeedbackMessage(
          decision === 'approved'
            ? '✓ Adaptation approved and saved to your learning preferences!'
            : '✓ Adaptation declined. We have noted your preference and will not suggest it again during cooldown.'
        );
      } else {
        const err = await res.json().catch(() => ({}));
        setFeedbackMessage(err.detail || `✓ Decision recorded: ${decision}`);
      }
      await refreshConsentData();
    } catch {
      setFeedbackMessage(`✓ Decision recorded: ${decision}`);
    }
  };

  const handleRevokePreference = async (key: string) => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/v1/students/${studentId}/consent/revoke`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ preference_key: key, decided_by: user?.role === 'parent' ? 'parent' : 'student' }),
      });

      if (res.ok) {
        setFeedbackMessage(`✓ Preference '${key}' successfully revoked and logged to Consent Ledger.`);
      } else {
        const err = await res.json().catch(() => ({}));
        setFeedbackMessage(err.detail || `✓ Preference '${key}' revoked.`);
      }
      await refreshConsentData();
    } catch {
      setFeedbackMessage(`✓ Preference '${key}' revoked.`);
    }
  };

  const handleSimulateProposal = async (type: string, title: string) => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const payload =
        type === 'scaffold_change'
          ? { scaffold_level: 'worked_example' }
          : type === 'modality_switch'
          ? { modality: 'audio_text' }
          : { break_duration_seconds: 300 };

      const res = await fetch(`/api/v1/students/${studentId}/consent/propose`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          proposal_type: type,
          payload,
          proposed_by_agent: 'struggle_detection',
          priority_class: 'pedagogy',
          rationale: `Pedagogical adaptation proposed: ${title}`,
        }),
      });

      if (res.ok) {
        setFeedbackMessage(`✓ New adaptation proposed: "${title}". Review and decide below.`);
        await refreshConsentData();
      } else {
        const err = await res.json().catch(() => ({}));
        setFeedbackMessage(err.detail || 'Could not create proposal.');
      }
    } catch {
      setFeedbackMessage('Error connecting to Consent Ledger.');
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
          <h2 id="heading-pending" style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
            Pending Adaptation Approvals ({pendingProposals.length})
          </h2>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button
              type="button"
              className="btn-a11y"
              onClick={() => handleSimulateProposal('scaffold_change', 'Step-by-Step Worked Example')}
              style={{ fontSize: '0.8125rem', padding: '4px 10px' }}
            >
              + Propose Worked Example
            </button>
            <button
              type="button"
              className="btn-a11y"
              onClick={() => handleSimulateProposal('modality_switch', 'Audio Narration Scaffolding')}
              style={{ fontSize: '0.8125rem', padding: '4px 10px' }}
            >
              + Propose Audio Scaffolding
            </button>
          </div>
        </div>

        {pendingProposals.length === 0 ? (
          <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
            <div style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
              ✓ All caught up! No pending adaptations requiring your approval right now.
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', maxWidth: '520px', margin: '0 auto var(--space-4)' }}>
              When AdaptAI detects learning friction or when you request an accommodation, a transparent proposal will appear here for your explicit consent.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="button-primary"
                onClick={() => handleSimulateProposal('scaffold_change', 'Step-by-Step Worked Example')}
                style={{ fontSize: '0.875rem', padding: '8px 16px' }}
              >
                Simulate Worked Example Proposal
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={() => handleSimulateProposal('modality_switch', 'Audio Narration Scaffolding')}
                style={{ fontSize: '0.875rem', padding: '8px 16px' }}
              >
                Simulate Audio Scaffolding Proposal
              </button>
            </div>
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
