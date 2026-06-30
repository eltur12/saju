/**
 * Flow state model — derives a simple level + trend from a numeric score.
 * Used for both in-app sentence display and widget short label.
 * Does NOT touch the scoring engine.
 */

export type FlowLevel = "HIGH" | "MID" | "LOW";
export type FlowTrend = "RISING" | "FALLING" | "STABLE";

export interface FlowState {
  level: FlowLevel;
  trend: FlowTrend;
}

export function getFlowState(score: number, delta?: number): FlowState {
  const level: FlowLevel = score >= 70 ? "HIGH" : score >= 40 ? "MID" : "LOW";
  const d = delta ?? 0;
  const trend: FlowTrend = d > 5 ? "RISING" : d < -5 ? "FALLING" : "STABLE";
  return { level, trend };
}

// ── In-app sentence (1 sentence, calm, no score) ────────────────────────────

const SENTENCES: Record<FlowLevel, Record<FlowTrend, string>> = {
  HIGH: {
    RISING:  "흐름이 점점 올라오는 구간입니다",
    STABLE:  "오늘은 비교적 안정적인 흐름입니다",
    FALLING: "흐름이 조금 내려가는 중이에요",
  },
  MID: {
    RISING:  "서서히 흐름이 살아나는 구간입니다",
    STABLE:  "차분하게 이어지는 흐름입니다",
    FALLING: "기운이 조금 내려가는 구간입니다",
  },
  LOW: {
    RISING:  "서서히 회복되는 흐름입니다",
    STABLE:  "흐름이 다소 가라앉은 구간입니다",
    FALLING: "흐름이 다소 약해지는 구간입니다",
  },
};

export function getFlowSentence(state: FlowState): string {
  return SENTENCES[state.level][state.trend];
}

// ── Widget short label (noun-phrase, no punctuation, 2–4 words) ─────────────

const LABELS: Record<FlowLevel, Record<FlowTrend, string>> = {
  HIGH: {
    RISING:  "상승 흐름",
    STABLE:  "안정적인 흐름",
    FALLING: "하강 흐름",
  },
  MID: {
    RISING:  "회복 흐름",
    STABLE:  "차분한 흐름",
    FALLING: "하강 흐름",
  },
  LOW: {
    RISING:  "회복 흐름",
    STABLE:  "약한 흐름",
    FALLING: "약한 흐름",
  },
};

export function getFlowLabel(state: FlowState): string {
  return LABELS[state.level][state.trend];
}
