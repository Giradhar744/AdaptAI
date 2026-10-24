/**
 * Frontend Behavioural Telemetry Instrumentation (PROJECT.md §6, §10.5, §13).
 * Captures response latency, input hesitation, error patterns, and hint requests.
 */

export interface TelemetrySignal {
  session_ref: string;
  signal_type: 'response_latency' | 'input_hesitation' | 'error_pattern' | 'hint_request';
  value: Record<string, any>;
}

export interface ProposalPayload {
  agent: string;
  type: string;
  priority_class: 'safety' | 'consent' | 'pedagogy' | 'nudge';
  payload: Record<string, any>;
  requires_consent: boolean;
  rationale: string;
  confidence: number;
}

export interface StruggleAssessmentEvent {
  id: string;
  student_id: string;
  score: number;
  risk_level: 'low' | 'medium' | 'high';
  features: Record<string, any>;
  contributing_factors: string[];
  proposals: ProposalPayload[];
  recorded_at: string;
}

export class BehaviourTracker {
  private questionStartTime: number = Date.now();
  private firstInteractionTime: number | null = null;
  private optionChangeCount: number = 0;
  private hintsRequestedCount: number = 0;
  private sessionRef: string;
  private studentId: string;
  private ws: WebSocket | null = null;
  private onStruggleDetected?: (assessment: StruggleAssessmentEvent) => void;

  constructor(sessionRef: string, studentId: string, onStruggleDetected?: (assessment: StruggleAssessmentEvent) => void) {
    this.sessionRef = sessionRef;
    this.studentId = studentId;
    this.onStruggleDetected = onStruggleDetected;
  }

  public getStudentId(): string {
    return this.studentId;
  }

  public initQuestion(_questionId?: string) {
    this.questionStartTime = Date.now();
    this.firstInteractionTime = null;
    this.optionChangeCount = 0;
    this.hintsRequestedCount = 0;
  }

  public recordFirstInteraction() {
    if (this.firstInteractionTime === null) {
      this.firstInteractionTime = Date.now();
    }
  }

  public recordOptionChange() {
    this.recordFirstInteraction();
    this.optionChangeCount += 1;
  }

  public recordHintRequest(depthLevel: number) {
    this.recordFirstInteraction();
    this.hintsRequestedCount += 1;

    // Immediately emit hint signal
    const signal: TelemetrySignal = {
      session_ref: this.sessionRef,
      signal_type: 'hint_request',
      value: {
        hints_used: this.hintsRequestedCount,
        depth_level: depthLevel,
        escalated: depthLevel > 1,
        timestamp: Date.now(),
      },
    };
    this.dispatchSignal(signal);
  }

  public async recordQuestionCompleted(
    questionId: string,
    isCorrect: boolean,
    totalSeconds: number
  ): Promise<StruggleAssessmentEvent | null> {
    const idleTimeMs = this.firstInteractionTime
      ? Math.max(0, this.firstInteractionTime - this.questionStartTime)
      : totalSeconds * 1000;

    const signals: TelemetrySignal[] = [
      {
        session_ref: this.sessionRef,
        signal_type: 'response_latency',
        value: {
          question_id: questionId,
          time_taken_ms: totalSeconds * 1000,
        },
      },
      {
        session_ref: this.sessionRef,
        signal_type: 'input_hesitation',
        value: {
          question_id: questionId,
          idle_time_ms: idleTimeMs,
          option_changes: this.optionChangeCount,
        },
      },
      {
        session_ref: this.sessionRef,
        signal_type: 'error_pattern',
        value: {
          question_id: questionId,
          is_correct: isCorrect,
        },
      },
    ];

    // Dispatch telemetry signals and trigger real-time struggle assessment
    try {
      // 1. Post telemetry signals
      await fetch('/api/v1/telemetry/signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signals }),
      });

      // 2. Request proactive struggle evaluation
      const assessRes = await fetch('/api/v1/struggle/assess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_ref: this.sessionRef,
        }),
      });

      if (assessRes.ok) {
        const assessment: StruggleAssessmentEvent = await assessRes.json();
        if (this.onStruggleDetected) {
          this.onStruggleDetected(assessment);
        }
        return assessment;
      }
    } catch (err) {
      console.warn('Telemetry submission fell back:', err);
    }

    return null;
  }

  private dispatchSignal(signal: TelemetrySignal) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'signal', ...signal }));
    } else {
      fetch('/api/v1/telemetry/signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signals: [signal] }),
      }).catch(() => {});
    }
  }

  public connectWebSocket(token: string) {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/v1/ws/session`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.ws?.send(JSON.stringify({ token }));
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'struggle_assessment' && data.data && this.onStruggleDetected) {
            this.onStruggleDetected(data.data);
          }
        } catch {
          // parse error
        }
      };
    } catch {
      // WS unsupported or offline
    }
  }

  public disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
