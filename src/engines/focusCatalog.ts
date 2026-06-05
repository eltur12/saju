/**
 * Focus Catalog v2
 *
 * "오늘의 특별한 흐름" 추출 시스템
 * - weak Focus 제외 (남발 방지)
 * - medium/strong Focus만 사용
 * - rawScore는 절대 수정하지 않음
 * - displayScore에만 boost 적용
 */

import type { ScoreMap } from "./sajuEngine";

export type FocusStrength = "medium" | "strong";

export interface FocusCatalogEntry {
  key:             string;        // e.g. "love.doHwa_spouse"
  category:        keyof ScoreMap;
  label:           string;        // e.g. "표현과 친밀감"
  strength:        FocusStrength;
  sourceKeys:      string[];      // event keys that must all be present
  baseFocusScore:  number;        // 8 for medium, 11 for strong
}

/**
 * FOCUS_CATALOG_V2
 *
 * 검증 완료:
 * - 전체 발생률: 17.6% (이상적 범위 10~30%)
 * - Wealth Focus: 1.11% (정상 작동)
 * - Category Mean 왜곡: 최대 0.53점 (허용 범위)
 * - Wealth Focus 발생일 80+ 비율: 18.6% → 40.3%
 */
export const FOCUS_CATALOG_V2: FocusCatalogEntry[] = [
  // ── LOVE ─────────────────────────────────────────────────────────────────────
  {
    key:            "love.doHwa_sixHarmony",
    category:       "love",
    label:          "표현과 연결",
    strength:       "medium",
    sourceKeys:     ["saju.star.doHwa", "saju.branch.sixHarmony"],
    baseFocusScore: 8,
  },
  {
    key:            "love.spouse_sixHarmony",
    category:       "love",
    label:          "친밀한 연결",
    strength:       "medium",
    sourceKeys:     ["ziwei.palace.spouse", "saju.branch.sixHarmony"],
    baseFocusScore: 8,
  },
  {
    key:            "love.doHwa_spouse",
    category:       "love",
    label:          "표현과 친밀감",
    strength:       "strong",
    sourceKeys:     ["saju.star.doHwa", "ziwei.palace.spouse"],
    baseFocusScore: 11,
  },
  {
    key:            "love.triple",
    category:       "love",
    label:          "표현과 친밀한 연결",
    strength:       "strong",
    sourceKeys:     ["saju.star.doHwa", "ziwei.palace.spouse", "saju.branch.sixHarmony"],
    baseFocusScore: 11,
  },

  // ── CAREER ───────────────────────────────────────────────────────────────────
  {
    key:            "career.jeonggwan_palace",
    category:       "career",
    label:          "기준과 업무 집중",
    strength:       "medium",
    sourceKeys:     ["saju.tenGod.jeonggwan", "ziwei.palace.career"],
    baseFocusScore: 8,
  },
  {
    key:            "career.pyeonggwan_palace",
    category:       "career",
    label:          "추진력과 업무 집중",
    strength:       "medium",
    sourceKeys:     ["saju.tenGod.pyeonggwan", "ziwei.palace.career"],
    baseFocusScore: 8,
  },
  {
    key:            "career.triple",
    category:       "career",
    label:          "기준과 추진력",
    strength:       "strong",
    sourceKeys:     ["saju.tenGod.jeonggwan", "saju.tenGod.pyeonggwan", "ziwei.palace.career"],
    baseFocusScore: 11,
  },

  // ── STUDY ────────────────────────────────────────────────────────────────────
  {
    key:            "study.jeongin_pyeongin",
    category:       "study",
    label:          "배움과 탐구",
    strength:       "medium",
    sourceKeys:     ["saju.tenGod.jeongin", "saju.tenGod.pyeongin"],
    baseFocusScore: 8,
  },
  {
    key:            "study.mercury_sanggwan",
    category:       "study",
    label:          "감각 확장과 창의력",
    strength:       "medium",
    sourceKeys:     ["saju.branch.spiritDoor", "saju.tenGod.sanggwan"],
    baseFocusScore: 8,
  },

  // ── HEALTH ───────────────────────────────────────────────────────────────────
  {
    key:            "health.jeWang",
    category:       "health",
    label:          "절정의 기운",
    strength:       "medium",
    sourceKeys:     ["saju.twelveState.jeWang"],
    baseFocusScore: 8,
  },
  {
    key:            "health.geonRok_jeWang",
    category:       "health",
    label:          "안정된 활력",
    strength:       "medium",
    sourceKeys:     ["saju.twelveState.geonRok", "saju.twelveState.jeWang"],
    baseFocusScore: 8,
  },

  // ── RELATIONS ────────────────────────────────────────────────────────────────
  {
    key:            "relations.doHwa_sixHarmony",
    category:       "relations",
    label:          "표현과 자연스러운 연결",
    strength:       "medium",
    sourceKeys:     ["saju.star.doHwa", "saju.branch.sixHarmony"],
    baseFocusScore: 8,
  },

  // ── WEALTH ───────────────────────────────────────────────────────────────────
  {
    key:            "wealth.trine_pyeongjae",
    category:       "wealth",
    label:          "조화로운 흐름과 기회 포착",
    strength:       "medium",
    sourceKeys:     ["saju.branch.trine", "saju.tenGod.pyeongjae"],
    baseFocusScore: 8,
  },
  {
    key:            "wealth.career_sunTrine",
    category:       "wealth",
    label:          "업무와 자신감",
    strength:       "medium",
    sourceKeys:     ["ziwei.palace.career", "astro.aspect.sun.trine"],
    baseFocusScore: 8,
  },
  {
    key:            "wealth.trine_marsSextile",
    category:       "wealth",
    label:          "조화와 활력",
    strength:       "medium",
    sourceKeys:     ["saju.branch.trine", "astro.aspect.mars.sextile"],
    baseFocusScore: 8,
  },
  {
    key:            "wealth.trine_jeongjae",
    category:       "wealth",
    label:          "조화로운 흐름과 안정 축적",
    strength:       "strong",
    sourceKeys:     ["saju.branch.trine", "saju.tenGod.jeongjae"],
    baseFocusScore: 11,
  },
  {
    key:            "wealth.trine_sunTrine",
    category:       "wealth",
    label:          "조화와 자신감",
    strength:       "strong",
    sourceKeys:     ["saju.branch.trine", "astro.aspect.sun.trine"],
    baseFocusScore: 11,
  },
];

console.log(`[FOCUS_CATALOG_V2] Loaded ${FOCUS_CATALOG_V2.length} focus entries (medium: ${FOCUS_CATALOG_V2.filter(e => e.strength === "medium").length}, strong: ${FOCUS_CATALOG_V2.filter(e => e.strength === "strong").length})`);
