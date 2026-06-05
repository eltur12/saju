/**
 * AI Interpretation Request V2 — types
 *
 * 설계 원칙:
 *  - Event = 원인 (canonical key + impact + polarity)
 *  - State  = 사용자 체감 신호 (V2StateKey + strength 0~1 + polarity)
 *  - Category = 체감 영역 (score + driver states)
 *  - profile/background 제외, 문장형 description 제외
 *  - timeFlow 제외 → significant 조건 충족 시 keyMoment 1개만
 */

// ── V2 State Keys (33개) ──────────────────────────────────────────────────────

export const V2_STATE_KEYS = [
  // Cognition
  "focus", "clarity", "curiosity", "reflection", "insight", "confusion",
  // Action / Will
  "initiative", "decision", "executionFlow", "adaptation", "persistence", "urgency",
  // Emotional / Inner
  "stability", "sensitivity", "emotionalAmplitude", "innerConflict", "longing", "optimism",
  // Social / Relational
  "connection", "distance", "misalignment", "boundaries",
  // Expression / Communication
  "expression", "recognition", "charm", "articulation", "creativity",
  // Grounding
  "securityNeed", "protectiveness",
  // Energy
  "energySustain", "needForRest", "fatigueLoad", "restlessness",
] as const;

export type V2StateKey = typeof V2_STATE_KEYS[number];

// ── Category key ─────────────────────────────────────────────────────────────

export type CategoryKey = "wealth" | "love" | "health" | "career" | "relations" | "study";

// ── STATE_META — V2StateKey 기준 기본 polarity ────────────────────────────────
// state가 활성화되었을 때의 의미적 방향성 (rawAcc 부호와 무관)

interface StateMeta { defaultPolarity: "positive" | "negative" | "mixed" }

export const STATE_META: Record<V2StateKey, StateMeta> = {
  // Cognition
  focus:              { defaultPolarity: "positive" },
  clarity:            { defaultPolarity: "positive" },
  curiosity:          { defaultPolarity: "positive" },
  reflection:         { defaultPolarity: "positive" },
  insight:            { defaultPolarity: "positive" },
  confusion:          { defaultPolarity: "negative" },
  // Action / Will
  initiative:         { defaultPolarity: "positive" },
  decision:           { defaultPolarity: "positive" },
  executionFlow:      { defaultPolarity: "positive" },
  adaptation:         { defaultPolarity: "positive" },
  persistence:        { defaultPolarity: "positive" },
  urgency:            { defaultPolarity: "mixed" },
  // Emotional / Inner
  stability:          { defaultPolarity: "positive" },
  sensitivity:        { defaultPolarity: "mixed" },
  emotionalAmplitude: { defaultPolarity: "mixed" },
  innerConflict:      { defaultPolarity: "negative" },
  longing:            { defaultPolarity: "mixed" },
  optimism:           { defaultPolarity: "positive" },
  // Social / Relational
  connection:         { defaultPolarity: "positive" },
  distance:           { defaultPolarity: "negative" },
  misalignment:       { defaultPolarity: "negative" },
  boundaries:         { defaultPolarity: "mixed" },
  // Expression / Communication
  expression:         { defaultPolarity: "positive" },
  recognition:        { defaultPolarity: "positive" },
  charm:              { defaultPolarity: "positive" },
  articulation:       { defaultPolarity: "positive" },
  creativity:         { defaultPolarity: "positive" },
  // Grounding
  securityNeed:       { defaultPolarity: "mixed" },
  protectiveness:     { defaultPolarity: "positive" },
  // Energy
  energySustain:      { defaultPolarity: "positive" },
  needForRest:        { defaultPolarity: "mixed" },
  fatigueLoad:        { defaultPolarity: "negative" },
  restlessness:       { defaultPolarity: "mixed" },
};

// ── Debug types ───────────────────────────────────────────────────────────────

export interface V2StateDebugEntry {
  key:                V2StateKey;
  rawAcc:             number;
  normalizedStrength: number;  // tanh(|rawAcc| / scale)
  defaultPolarity:    "positive" | "negative" | "mixed";
  finalPolarity:      "positive" | "negative" | "mixed";
}

export interface V2CatDriverDebug {
  state:       V2StateKey;
  catContrib:  number;   // rawAcc for this state (contribution to this category)
  polarity:    "positive" | "negative" | "mixed";
  aligns:      boolean;  // polarity direction consistent with cat score vs average
}

export interface V2BuildDebug {
  scale:             number;
  stateAccumulation: V2StateDebugEntry[];
  catAvgScore:       number;
  catDriverDetails:  Record<CategoryKey, V2CatDriverDebug[]>;
}

// ── V2 Request ───────────────────────────────────────────────────────────────

export interface AiInterpretationRequestV2 {
  /** YYYY-MM-DD */
  date: string;

  /** display overall score (NORM_67+5 적용됨) */
  overall: number;

  /** display category scores */
  scores: Record<CategoryKey, number>;

  /** majorEvents + minorEvents 합산, impact 절댓값 기준 최대 6개 (background 제외) */
  topEvents: Array<{
    key:      string;
    label:    string;
    impact:   number;
    polarity: "positive" | "negative" | "mixed";
  }>;

  /**
   * EventStateMap 누적 계산 결과, strength 절댓값 기준 최대 8개
   * strength: tanh(|rawAcc| / STATE_NORM_SCALE), 0~1
   * polarity: STATE_META.defaultPolarity 기준 (rawAcc 부호로 방향 반전 적용)
   */
  topStates: Array<{
    key:      V2StateKey;
    label:    string;
    strength: number;
    polarity: "positive" | "negative" | "mixed";
  }>;

  /** 6개 카테고리 전부 포함 */
  categoryHighlights: Record<CategoryKey, {
    score:   number;
    drivers: V2StateKey[];
  }>;

  monthlyPosition?: {
    rank:       number;
    totalDays:  number;
    percentile: number;
    flags:      string[];
  };

  dailyCompare?: {
    prevDiff: number;
    nextDiff: number;
    flags:    string[];
  };

  keyMoment?: {
    type:   "rise" | "drop" | "peak" | "caution";
    hour:   number;
    delta?: number;
  };

  /** Focus Catalog v2: 오늘 특별히 드러난 흐름 (선택적 강조 포인트) */
  focus?: Array<{
    category:     CategoryKey;
    label:        string;
    strength:     "medium" | "strong";
    sourceKeys:   string[];
    sourceLabels: string[];
  }>;

  /** Daily Highlight: 이번 달 흐름 대비 오늘 가장 눈에 띄는 변화 */
  dailyHighlight?: {
    category:  CategoryKey;
    direction: "up" | "down";
    strength:  "noticeable" | "strong";
  };
}
