/**
 * V2 State → Category Weight Mapping
 *
 * 각 state가 각 category score에 미치는 영향도
 * Positive: 해당 state 활성화 시 category score 상승
 * Negative: 해당 state 활성화 시 category score 하락
 *
 * 사용: baseCategoryScore + stateCategoryDelta * strength
 */

import type { V2StateKey, CategoryKey } from "./types";

export const V2_STATE_TO_CATEGORY_WEIGHT: Record<V2StateKey, Partial<Record<CategoryKey, number>>> = {
  // ── Cognition (6) ──────────────────────────────────────────────────────────

  clarity: {
    wealth:    0.5,
    career:    0.8,
    study:     1.2,
    relations: 0.3,
  },

  focus: {
    wealth:    0.6,
    career:    0.9,
    study:     1.0,
    health:    0.3,
  },

  curiosity: {
    study:     0.8,
    career:    0.4,
    relations: 0.3,
  },

  reflection: {
    study:     0.7,
    health:    0.4,
    relations: 0.3,
  },

  insight: {
    study:     0.8,
    career:    0.5,
    wealth:    0.4,
  },

  confusion: {
    wealth:    -0.6,
    career:    -0.7,
    study:     -1.0,
    health:    -0.4,
  },

  // ── Action / Will (6) ──────────────────────────────────────────────────────

  initiative: {
    wealth:    0.8,
    career:    1.0,
    love:      0.4,
    relations: 0.5,
  },

  decision: {
    wealth:    0.5,
    career:    0.8,
    health:    0.3,
    study:     0.4,
  },

  executionFlow: {
    wealth:    0.7,
    career:    1.0,
    study:     0.5,
    health:    0.4,
  },

  adaptation: {
    wealth:    0.5,
    career:    0.6,
    relations: 0.6,
    study:     0.4,
  },

  persistence: {
    wealth:    0.6,
    career:    0.7,
    study:     0.6,
    health:    0.4,
  },

  urgency: {
    career:    0.3,
    health:    -0.4,
    love:      -0.3,
  },

  // ── Emotional / Inner (6) ──────────────────────────────────────────────────

  stability: {
    wealth:    0.8,
    health:    0.8,
    career:    0.5,
    love:      0.4,
    relations: 0.5,
    study:     0.4,
  },

  sensitivity: {
    love:      0.5,
    health:    -0.3,
    relations: 0.4,
  },

  emotionalAmplitude: {
    love:      0.5,
    health:    -0.4,
    relations: 0.3,
  },

  innerConflict: {
    wealth:    -0.5,
    love:      -0.6,
    health:    -0.7,
    career:    -0.6,
    relations: -0.5,
    study:     -0.5,
  },

  longing: {
    love:      0.7,
    relations: 0.3,
  },

  optimism: {
    wealth:    0.4,
    love:      0.5,
    career:    0.5,
    relations: 0.4,
  },

  // ── Social / Relational (4) ────────────────────────────────────────────────

  connection: {
    love:      1.0,
    relations: 1.0,
    career:    0.3,
    wealth:    0.3,
  },

  distance: {
    love:      -0.7,
    relations: -0.8,
  },

  misalignment: {
    love:      -0.8,
    relations: -1.0,
    career:    -0.4,
  },

  boundaries: {
    relations: 0.3,
    health:    0.3,
  },

  // ── Expression / Communication (5) ─────────────────────────────────────────

  expression: {
    love:      0.5,
    relations: 0.7,
    career:    0.4,
  },

  recognition: {
    career:    0.6,
    love:      0.3,
  },

  charm: {
    love:      0.8,
    relations: 0.6,
    career:    0.3,
  },

  articulation: {
    relations: 0.8,
    career:    0.5,
    study:     0.4,
  },

  creativity: {
    career:    0.5,
    study:     0.5,
    wealth:    0.3,
  },

  // ── Grounding (2) ──────────────────────────────────────────────────────────

  securityNeed: {
    wealth:    1.2,
    health:    0.5,
  },

  protectiveness: {
    health:    0.6,
    relations: 0.3,
  },

  // ── Energy (4) ─────────────────────────────────────────────────────────────

  energySustain: {
    health:    1.2,
    career:    0.6,
    wealth:    0.4,
    study:     0.4,
  },

  needForRest: {
    health:    -0.4,
    career:    -0.3,
  },

  fatigueLoad: {
    health:    -1.0,
    career:    -0.5,
    study:     -0.4,
  },

  restlessness: {
    health:    -0.5,
    study:     -0.4,
    love:      0.3,  // 들뜸은 애정에는 약간 긍정적일 수 있음
  },
};

// 검증: 모든 state가 최소 1개 category에 매핑되어야 함
const TOTAL_STATES = 33;
const mappedStates = Object.keys(V2_STATE_TO_CATEGORY_WEIGHT).length;
if (mappedStates !== TOTAL_STATES) {
  console.warn(`[STATE_CATEGORY_WEIGHT] Expected ${TOTAL_STATES} states, got ${mappedStates}`);
}
