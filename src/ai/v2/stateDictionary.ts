/**
 * State Dictionary — V2 State Key → 사용자 체감 Label
 *
 * AI는 key가 아닌 label을 해석에 사용합니다.
 * key는 엔진 내부 식별자이며, label은 사용자가 이해할 수 있는 체감 표현입니다.
 */

import type { V2StateKey } from "./types";

export const STATE_LABELS: Record<V2StateKey, string> = {
  // Cognition (6)
  clarity:            "생각 정리",
  focus:              "집중",
  curiosity:          "관심 확장",
  reflection:         "돌아봄",
  insight:            "깨달음",
  confusion:          "혼란",

  // Action / Will (6)
  initiative:         "주도성",
  decision:           "결정력",
  executionFlow:      "실행 흐름",
  adaptation:         "유연한 대응",
  persistence:        "꾸준함",
  urgency:            "압박감",

  // Emotional / Inner (6)
  stability:          "안정감",
  sensitivity:        "예민함",
  emotionalAmplitude: "감정 기복",
  innerConflict:      "내적 갈등",
  longing:            "그리움",
  optimism:           "기대감",

  // Social / Relational (4)
  connection:         "연결감",
  distance:           "거리감",
  misalignment:       "엇갈림",
  boundaries:         "경계 의식",

  // Expression / Communication (5)
  expression:         "표현력",
  recognition:        "인정 욕구",
  charm:              "호감도",
  articulation:       "말의 전달력",
  creativity:         "창의성",

  // Grounding (2)
  securityNeed:       "안정 추구",
  protectiveness:     "보호 본능",

  // Energy (4)
  energySustain:      "체력 유지",
  needForRest:        "휴식 욕구",
  fatigueLoad:        "피로감",
  restlessness:       "들뜸",
};

// 검증: 33개 전체 정의 확인
const EXPECTED_COUNT = 33;
const actualCount = Object.keys(STATE_LABELS).length;
if (actualCount !== EXPECTED_COUNT) {
  console.warn(`[STATE_LABELS] Expected ${EXPECTED_COUNT} states, got ${actualCount}`);
}
