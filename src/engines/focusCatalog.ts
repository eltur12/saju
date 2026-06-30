/**
 * Focus Catalog v3
 *
 * "오늘의 특별한 흐름" 추출 시스템
 * - weak Focus 제외 (남발 방지)
 * - medium/strong Focus만 사용
 * - rawScore는 절대 수정하지 않음
 * - displayScore에만 boost 적용
 *
 * V3: polarity 3분류 도입 (positive / mixed / negative)
 * - Focus의 목적은 "좋은 날 보너스"가 아니라 "오늘 특징적인 조합" 노출
 * - mixed/negative는 경고가 아니라 "주의 깊게 볼 흐름" 톤으로 설계
 * - 동일 sourceKeys 조합(순서 무관)은 중복 등록 금지
 */

import type { ScoreMap } from "./sajuEngine";

export type FocusStrength = "medium" | "strong";
export type FocusPolarity = "positive" | "mixed" | "negative";

export interface FocusCatalogEntry {
  key:             string;        // e.g. "love.doHwa_spouse"
  category:        keyof ScoreMap;
  label:           string;        // e.g. "표현과 친밀감"
  strength:        FocusStrength;
  polarity:        FocusPolarity;
  sourceKeys:      string[];      // event keys that must all be present
  baseFocusScore:  number;        // 8 for medium, 11 for strong
}

/**
 * FOCUS_CATALOG_V2 (positive 17개 — V2에서 검증 완료)
 *
 * 검증 완료:
 * - 전체 발생률: 17.6% (이상적 범위 10~30%)
 * - Wealth Focus: 1.11% (정상 작동)
 * - Category Mean 왜곡: 최대 0.53점 (허용 범위)
 * - Wealth Focus 발생일 80+ 비율: 18.6% → 40.3%
 *
 * V3 추가분 (mixed 5개, negative 3개)은 파일 하단 참조.
 */
export const FOCUS_CATALOG_V2: FocusCatalogEntry[] = [
  // ── LOVE ─────────────────────────────────────────────────────────────────────
  {
    key:            "love.doHwa_sixHarmony",
    category:       "love",
    label:          "표현과 연결",
    strength:       "medium",
    polarity:       "positive",
    sourceKeys:     ["saju.star.doHwa", "saju.branch.sixHarmony"],
    baseFocusScore: 8,
  },
  {
    key:            "love.spouse_sixHarmony",
    category:       "love",
    label:          "친밀한 연결",
    strength:       "medium",
    polarity:       "positive",
    sourceKeys:     ["ziwei.palace.spouse", "saju.branch.sixHarmony"],
    baseFocusScore: 8,
  },
  {
    key:            "love.doHwa_spouse",
    category:       "love",
    label:          "표현과 친밀감",
    strength:       "strong",
    polarity:       "positive",
    sourceKeys:     ["saju.star.doHwa", "ziwei.palace.spouse"],
    baseFocusScore: 11,
  },
  {
    key:            "love.triple",
    category:       "love",
    label:          "표현과 친밀한 연결",
    strength:       "strong",
    polarity:       "positive",
    sourceKeys:     ["saju.star.doHwa", "ziwei.palace.spouse", "saju.branch.sixHarmony"],
    baseFocusScore: 11,
  },

  // ── CAREER ───────────────────────────────────────────────────────────────────
  {
    key:            "career.jeonggwan_palace",
    category:       "career",
    label:          "기준과 업무 집중",
    strength:       "medium",
    polarity:       "positive",
    sourceKeys:     ["saju.tenGod.jeonggwan", "ziwei.palace.career"],
    baseFocusScore: 8,
  },
  {
    key:            "career.pyeonggwan_palace",
    category:       "career",
    label:          "추진력과 업무 집중",
    strength:       "medium",
    polarity:       "positive",
    sourceKeys:     ["saju.tenGod.pyeonggwan", "ziwei.palace.career"],
    baseFocusScore: 8,
  },
  {
    key:            "career.triple",
    category:       "career",
    label:          "기준과 추진력",
    strength:       "strong",
    polarity:       "positive",
    sourceKeys:     ["saju.tenGod.jeonggwan", "saju.tenGod.pyeonggwan", "ziwei.palace.career"],
    baseFocusScore: 11,
  },

  // ── STUDY ────────────────────────────────────────────────────────────────────
  {
    key:            "study.jeongin_pyeongin",
    category:       "study",
    label:          "배움과 탐구",
    strength:       "medium",
    polarity:       "positive",
    sourceKeys:     ["saju.tenGod.jeongin", "saju.tenGod.pyeongin"],
    baseFocusScore: 8,
  },
  {
    key:            "study.mercury_sanggwan",
    category:       "study",
    label:          "감각 확장과 창의력",
    strength:       "medium",
    polarity:       "positive",
    sourceKeys:     ["saju.branch.spiritDoor", "saju.tenGod.sanggwan"],
    baseFocusScore: 8,
  },

  // ── HEALTH ───────────────────────────────────────────────────────────────────
  {
    key:            "health.jeWang",
    category:       "health",
    label:          "절정의 기운",
    strength:       "medium",
    polarity:       "positive",
    sourceKeys:     ["saju.twelveState.jeWang"],
    baseFocusScore: 8,
  },
  {
    key:            "health.geonRok_jeWang",
    category:       "health",
    label:          "안정된 활력",
    strength:       "medium",
    polarity:       "positive",
    sourceKeys:     ["saju.twelveState.geonRok", "saju.twelveState.jeWang"],
    baseFocusScore: 8,
  },

  // ── RELATIONS ────────────────────────────────────────────────────────────────
  // V3.3 제거: relations.doHwa_sixHarmony
  //   — love.doHwa_sixHarmony와 sourceKeys 동일(도화+육합)하여 두 카테고리에서
  //     동시 발생(180일 기준 138일, 7.7%)하는 반복감의 원인.
  //     도화+육합은 표현/호감 의미라 love가 자연스럽고, relations는 mixed/negative가 담당.

  // ── WEALTH ───────────────────────────────────────────────────────────────────
  {
    key:            "wealth.trine_pyeongjae",
    category:       "wealth",
    label:          "조화로운 흐름과 기회 포착",
    strength:       "medium",
    polarity:       "positive",
    sourceKeys:     ["saju.branch.trine", "saju.tenGod.pyeongjae"],
    baseFocusScore: 8,
  },
  {
    key:            "wealth.career_sunTrine",
    category:       "wealth",
    label:          "업무와 자신감",
    strength:       "medium",
    polarity:       "positive",
    sourceKeys:     ["ziwei.palace.career", "astro.aspect.sun.trine"],
    baseFocusScore: 8,
  },
  {
    key:            "wealth.trine_marsSextile",
    category:       "wealth",
    label:          "조화와 활력",
    strength:       "medium",
    polarity:       "positive",
    sourceKeys:     ["saju.branch.trine", "astro.aspect.mars.sextile"],
    baseFocusScore: 8,
  },
  {
    key:            "wealth.trine_jeongjae",
    category:       "wealth",
    label:          "조화로운 흐름과 안정 축적",
    strength:       "strong",
    polarity:       "positive",
    sourceKeys:     ["saju.branch.trine", "saju.tenGod.jeongjae"],
    baseFocusScore: 11,
  },
  {
    key:            "wealth.trine_sunTrine",
    category:       "wealth",
    label:          "조화와 자신감",
    strength:       "strong",
    polarity:       "positive",
    sourceKeys:     ["saju.branch.trine", "astro.aspect.sun.trine"],
    baseFocusScore: 11,
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // V3 신규: MIXED — 장점과 부담이 함께 있는 흐름
  // 보류: career.pyeonggwan_career (기존 career.pyeonggwan_palace와 sourceKeys 동일)
  // ══════════════════════════════════════════════════════════════════════════════
  {
    key:            "relations.hostility_doHwa",
    category:       "relations",
    label:          "거리감 속 표현",
    strength:       "medium",
    polarity:       "mixed",
    sourceKeys:     ["saju.branch.hostility", "saju.star.doHwa"],
    baseFocusScore: 8,
  },
  {
    key:            "love.hostility_spouse",
    category:       "love",
    label:          "조심스러운 친밀감",
    strength:       "medium",
    polarity:       "mixed",
    sourceKeys:     ["saju.branch.hostility", "ziwei.palace.spouse"],
    baseFocusScore: 8,
  },
  {
    key:            "career.clash_pyeonggwan",
    category:       "career",
    label:          "긴장 속 추진",
    strength:       "medium",
    polarity:       "mixed",
    sourceKeys:     ["saju.branch.clash", "saju.tenGod.pyeonggwan"],
    baseFocusScore: 8,
  },
  {
    key:            "study.spiritDoor_jeongin",
    category:       "study",
    label:          "깊어진 생각",
    strength:       "medium",
    polarity:       "mixed",
    sourceKeys:     ["saju.branch.spiritDoor", "saju.tenGod.jeongin"],
    baseFocusScore: 8,
  },
  {
    key:            "health.penalty_jeWang",
    category:       "health",
    label:          "예민한 활력",
    strength:       "medium",
    polarity:       "mixed",
    sourceKeys:     ["saju.branch.penalty", "saju.twelveState.jeWang"],
    baseFocusScore: 8,
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // V3 신규: NEGATIVE — 주의 깊게 볼 흐름 (경고/공포 표현 아님)
  // 보류: health.clash_pyeonggwan (신규 career.clash_pyeonggwan과 sourceKeys 동일)
  // 보류: love.hostility_harm   (신규 relations.hostility_harm과 sourceKeys 동일)
  // V3.1 제거: relations.hostility_harm, relations.clash_penalty
  //   — 원진·해·충·형은 일상적으로 흔한 지지 관계 이벤트라 2-key 조합으로는
  //     희귀성이 없어 발생률 폭증(29.9%→67.2%)의 주원인이 됨
  // ══════════════════════════════════════════════════════════════════════════════
  {
    key:            "career.huaJi_clash",
    category:       "career",
    label:          "계획의 흔들림",
    strength:       "medium",
    polarity:       "negative",
    sourceKeys:     ["ziwei.transform.huaJi", "saju.branch.clash"],
    baseFocusScore: 8,
  },

  // ── V3.3 신규 NEGATIVE ──────────────────────────────────────────────────────
  // 재설계 원칙: 흔한 branch-negative끼리 2-key 조합 금지 (V3 발생률 폭증 원인).
  //   부정/긴장 키 + 희소하거나 맥락이 강한 키 조합만 허용. 목표 비중 5~15%.
  // 제거: relations.harm_spiritDoor (해+귀문) — 180일 감사에서 318회(전체 22.8%)로
  //   과다 발생, negative 비중 26.7%로 FAIL 기준(>25%) 초과하여 규칙에 따라 제거.
  // 예비 후보 C (health.penalty_pyeonggwan): negative 0~3%면 추가 검토.
  {
    key:            "career.clash_career",
    category:       "career",
    label:          "업무의 흔들림",
    strength:       "medium",
    polarity:       "negative",
    sourceKeys:     ["saju.branch.clash", "ziwei.palace.career"],
    baseFocusScore: 8,
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // V4.1 1차 투입 (사화 복구 후 재감사 기반 선정 — positive 3 / mixed 2 / negative 2)
  // ══════════════════════════════════════════════════════════════════════════════
  {
    key:            "wealth.pyeongjae_wealthPalace",
    category:       "wealth",
    label:          "기회 포착의 흐름",
    strength:       "medium",
    polarity:       "positive",
    sourceKeys:     ["saju.tenGod.pyeongjae", "ziwei.palace.wealth"],
    baseFocusScore: 8,
  },
  {
    key:            "career.gwanDae_jeonggwan",
    category:       "career",
    label:          "책임과 인정",
    strength:       "medium",
    polarity:       "positive",
    sourceKeys:     ["saju.twelveState.gwanDae", "saju.tenGod.jeonggwan"],
    baseFocusScore: 8,
  },
  {
    key:            "love.siksin_spouse",
    category:       "love",
    label:          "다정한 온기",
    strength:       "medium",
    polarity:       "positive",
    sourceKeys:     ["saju.tenGod.siksin", "ziwei.palace.spouse"],
    baseFocusScore: 8,
  },
  {
    key:            "career.pyeonggwan_jeWang",
    category:       "career",
    label:          "강한 추진과 부담",
    strength:       "medium",
    polarity:       "mixed",
    sourceKeys:     ["saju.tenGod.pyeonggwan", "saju.twelveState.jeWang"],
    baseFocusScore: 8,
  },
  {
    key:            "love.huaJi_doHwa",
    category:       "love",
    label:          "표현의 엇박",
    strength:       "medium",
    polarity:       "mixed",
    sourceKeys:     ["ziwei.transform.huaJi", "saju.star.doHwa"],
    baseFocusScore: 8,
  },
  {
    key:            "love.harm_spouse",
    category:       "love",
    label:          "어긋나는 마음",
    strength:       "medium",
    polarity:       "negative",
    sourceKeys:     ["saju.branch.harm", "ziwei.palace.spouse"],
    baseFocusScore: 8,
  },
  {
    key:            "relations.hostility_friends",
    category:       "relations",
    label:          "불편한 자리",
    strength:       "medium",
    polarity:       "negative",
    sourceKeys:     ["saju.branch.hostility", "ziwei.palace.friends"],
    baseFocusScore: 8,
  },
];

console.log(`[FOCUS_CATALOG_V3] Loaded ${FOCUS_CATALOG_V2.length} focus entries (medium: ${FOCUS_CATALOG_V2.filter(e => e.strength === "medium").length}, strong: ${FOCUS_CATALOG_V2.filter(e => e.strength === "strong").length} | positive: ${FOCUS_CATALOG_V2.filter(e => e.polarity === "positive").length}, mixed: ${FOCUS_CATALOG_V2.filter(e => e.polarity === "mixed").length}, negative: ${FOCUS_CATALOG_V2.filter(e => e.polarity === "negative").length})`);
