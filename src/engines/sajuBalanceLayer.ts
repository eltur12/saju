/**
 * 사주 오행 균형 보정 레이어 (Saju Balance Adjustment Layer)
 *
 * 실행 순서: SajuEngine.calculate() 이후, mergeScores() 이전
 * 활성화 여부: FortuneAggregator의 enableSajuBalanceAdjustment 플래그로 제어
 *
 * 내부 오행 표기: 사주 엔진 기존 규칙과 일치하도록 漢字 오행명("木","火","土","金","水") 사용
 */

import type { ScoreMap, SajuEngineProfile } from "./sajuEngine";
import { STEM_ELEMENT, BRANCH_ELEMENT } from "./sajuEngine";
import { JIJANGGAN } from "../lib/orrery/constants";

// ──────────────────────────────────────────────────────────────
// 내부 오행 타입 (STEM_ELEMENT / BRANCH_ELEMENT 값과 동일)
// ──────────────────────────────────────────────────────────────

type ChinaElement = "木" | "火" | "土" | "金" | "水";

const ALL_ELEMENTS: ChinaElement[] = ["木", "火", "土", "金", "水"];

/** 상생(生): A → B (A가 B를 생한다) */
const GENERATES: Record<ChinaElement, ChinaElement> = {
  "木": "火", "火": "土", "土": "金", "金": "水", "水": "木",
};

/** 상극(克): A → B (A가 B를 극한다) */
const CONTROLS: Record<ChinaElement, ChinaElement> = {
  "木": "土", "土": "水", "水": "火", "火": "金", "金": "木",
};

// ──────────────────────────────────────────────────────────────
// 공개 타입
// ──────────────────────────────────────────────────────────────

export type StrengthLevel = "very_weak" | "weak" | "balanced" | "strong" | "very_strong";

export interface SajuBalanceProfile {
  strength_level: StrengthLevel;
  favorable_elements: string[];
  unfavorable_elements: string[];
  element_distribution: Record<string, number>;
}

export interface SajuBalanceDebug {
  strength_level: StrengthLevel;
  favorable_elements: string[];
  unfavorable_elements: string[];
  element_distribution: Record<string, number>;
  imbalance_detected: boolean;
  deficient_elements: string[];
  excessive_elements: string[];
  applied_today_element: string;
  applied_multipliers: Record<keyof ScoreMap, number>;
  applied_additives: Record<keyof ScoreMap, number>;
}

export interface SajuBalanceResult {
  adjustedScores: ScoreMap;
  debug: SajuBalanceDebug;
}

// ──────────────────────────────────────────────────────────────
// Step 3: 원국 오행 분포 계산
// ──────────────────────────────────────────────────────────────

/**
 * 원국 오행 분포 계산 (0~1 정규화)
 *
 * 포함 항목:
 *   - 천간 3개: day_stem, month_stem, year_stem (weight 1.0 each)
 *     ※ SajuEngineProfile에 hour_stem이 없으므로 3개만 사용 (documented fallback)
 *   - 지지 4개: all branches (weight 1.0 each)
 *   - 지장간 정기 4개: 각 지지의 정기 천간 오행 (weight 0.5 each, simplified)
 */
export function computeElementDistribution(profile: SajuEngineProfile): Record<string, number> {
  const counts: Record<string, number> = { "木": 0, "火": 0, "土": 0, "金": 0, "水": 0 };

  // 천간 (3개)
  for (const stem of [profile.day_stem, profile.month_stem, profile.year_stem ?? ""].filter(Boolean)) {
    const e = STEM_ELEMENT[stem];
    if (e && e in counts) { counts[e] += 1; }
  }

  // 지지 (4개)
  const branches = [profile.hour_branch, profile.day_branch, profile.month_branch, profile.year_branch];
  for (const branch of branches) {
    const e = BRANCH_ELEMENT[branch];
    if (e && e in counts) { counts[e] += 1; }
  }

  // 지장간 정기 (simplified: 각 지지의 마지막 비공백 천간 → 오행, weight 0.5)
  for (const branch of branches) {
    const jijang = JIJANGGAN[branch] ?? "";
    const jeonggi = jijang.replace(/ /g, "").slice(-1);
    if (jeonggi) {
      const e = STEM_ELEMENT[jeonggi];
      if (e && e in counts) { counts[e] += 0.5; }
    }
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const dist: Record<string, number> = {};
  for (const el of ALL_ELEMENTS) {
    dist[el] = total > 0 ? counts[el] / total : 0.2;
  }
  return dist;
}

// ──────────────────────────────────────────────────────────────
// Step 1: 일간 강약 분류
// ──────────────────────────────────────────────────────────────

function analyzeDayMasterStrength(profile: SajuEngineProfile): StrengthLevel {
  const dayElem = STEM_ELEMENT[profile.day_stem] as ChinaElement | undefined;
  if (!dayElem) { return "balanced"; }

  // 일간을 생하는 오행(인성) / 일간을 극하는 오행(관성) / 일간이 생하는 오행(식상)
  const generatesMeElem = (Object.entries(GENERATES) as [ChinaElement, ChinaElement][])
    .find(([, b]) => b === dayElem)?.[0];
  const controlsMeElem = (Object.entries(CONTROLS) as [ChinaElement, ChinaElement][])
    .find(([, b]) => b === dayElem)?.[0];
  const myDrainElem = GENERATES[dayElem]; // 식상: 일간이 生하는 오행 → 일간 에너지 소모

  // 계절 지원: 월지 오행 == 일간 오행, 또는 월지 오행이 일간을 생하는 경우
  const monthBranchElem = BRANCH_ELEMENT[profile.month_branch] as ChinaElement | undefined;
  const seasonSupport =
    monthBranchElem === dayElem ||
    monthBranchElem === generatesMeElem;

  // 원국 항목 수집 (일간 자신 제외한 나머지 천간 + 전체 지지 + 지장간 정기)
  const items: Array<{ elem: string; weight: number }> = [];

  // 천간 (day_stem 제외)
  for (const stem of [profile.month_stem, profile.year_stem ?? ""].filter(Boolean)) {
    const e = STEM_ELEMENT[stem];
    if (e) { items.push({ elem: e, weight: 1 }); }
  }

  // 지지
  const branches = [profile.hour_branch, profile.day_branch, profile.month_branch, profile.year_branch];
  for (const branch of branches) {
    const e = BRANCH_ELEMENT[branch];
    if (e) { items.push({ elem: e, weight: 1 }); }
  }

  // 지장간 정기 (weight 0.5)
  for (const branch of branches) {
    const jeonggi = (JIJANGGAN[branch] ?? "").replace(/ /g, "").slice(-1);
    if (jeonggi) {
      const e = STEM_ELEMENT[jeonggi];
      if (e) { items.push({ elem: e, weight: 0.5 }); }
    }
  }

  let supportScore = 0;
  let opposingScore = 0;

  for (const { elem, weight } of items) {
    if (elem === dayElem) {
      supportScore += weight;          // 비겁 (旺身)
    } else if (elem === generatesMeElem) {
      supportScore += weight * 0.8;    // 인성 (生身)
    } else if (elem === controlsMeElem) {
      opposingScore += weight;         // 관성 (克身)
    } else if (elem === myDrainElem) {
      opposingScore += weight * 0.5;   // 식상 (泄身 — 약한 손상)
    }
  }

  if (seasonSupport && supportScore >= 4) { return "very_strong"; }
  if (seasonSupport && supportScore >= 2) { return "strong"; }
  if (!seasonSupport && supportScore <= 1 && opposingScore >= 2) { return "very_weak"; }
  if (!seasonSupport && supportScore <= 2 && opposingScore >= 1) { return "weak"; }
  return "balanced";
}

// ──────────────────────────────────────────────────────────────
// Step 2: 용신(用神) / 기신(忌神) 오행 도출
// ──────────────────────────────────────────────────────────────

function deriveFavorableElements(
  dayElem: ChinaElement,
  strength: StrengthLevel,
): { favorable: string[]; unfavorable: string[] } {
  // 나를 극하는 오행(관성), 내가 生하는 오행(식상), 나를 生하는 오행(인성), 나와 같은 오행(비겁)
  const controlsMeElem = (Object.entries(CONTROLS) as [ChinaElement, ChinaElement][])
    .find(([, b]) => b === dayElem)?.[0];
  const myDrainElem    = GENERATES[dayElem];
  const generatesMeElem = (Object.entries(GENERATES) as [ChinaElement, ChinaElement][])
    .find(([, b]) => b === dayElem)?.[0];

  if (strength === "strong" || strength === "very_strong") {
    // 용신: 나를 극하는 오행(관성) + 나의 에너지를 소모하는 오행(식상)
    // 기신: 나를 더 강화하는 오행(비겁, 인성)
    return {
      favorable:   [controlsMeElem!, myDrainElem].filter(Boolean) as string[],
      unfavorable: [dayElem, generatesMeElem!].filter(Boolean) as string[],
    };
  }

  if (strength === "weak" || strength === "very_weak") {
    // 용신: 나와 같은 오행(비겁) + 나를 생하는 오행(인성)
    // 기신: 나를 극하는 오행(관성) + 나를 소모하는 오행(식상)
    return {
      favorable:   [dayElem, generatesMeElem!].filter(Boolean) as string[],
      unfavorable: [controlsMeElem!, myDrainElem].filter(Boolean) as string[],
    };
  }

  // balanced: 보수적 — 인성만 약하게 유리, 기신 없음
  return {
    favorable:   [generatesMeElem!].filter(Boolean) as string[],
    unfavorable: [],
  };
}

// ──────────────────────────────────────────────────────────────
// 진입점: 보정 레이어 적용
// ──────────────────────────────────────────────────────────────

/**
 * 사주 오행 균형 보정 레이어 적용
 *
 * @param rawSajuScores - SajuEngine.calculate().scores (변경하지 않음)
 * @param profile       - 원국 프로파일
 * @param factors       - SajuEngine.calculate().factors (target_stem 포함)
 * @returns             - 보정된 sajuScores + 디버그 정보
 */
export function applySajuBalanceAdjustment(
  rawSajuScores: ScoreMap,
  profile: SajuEngineProfile,
  factors: Record<string, unknown>,
): SajuBalanceResult {
  const dayElem = STEM_ELEMENT[profile.day_stem] as ChinaElement | undefined;

  // Step 1: 강약 분류
  const strength = analyzeDayMasterStrength(profile);

  // Step 2: 용신 / 기신 도출
  const { favorable, unfavorable } = dayElem
    ? deriveFavorableElements(dayElem, strength)
    : { favorable: [], unfavorable: [] };

  // Step 3: 오행 분포
  const dist = computeElementDistribution(profile);
  const deficientElements  = ALL_ELEMENTS.filter(e => dist[e] < 0.1);
  const excessiveElements  = ALL_ELEMENTS.filter(e => dist[e] > 0.4);
  const imbalanceDetected  = deficientElements.length > 0 || excessiveElements.length > 0;

  // 오늘 일진 천간 오행 (SajuEngine factors에서 추출)
  const todayStem = (factors["target_stem"] as string) ?? "";
  const todayElem = STEM_ELEMENT[todayStem] ?? "";

  // Step 4-A: 강약 기반 보정값 초기화 (모든 배수는 1.0, 가산은 0)
  const multipliers: Record<keyof ScoreMap, number> = {
    overall: 1.0, wealth: 1.0, love: 1.0, health: 1.0,
    career: 1.0, relations: 1.0, study: 1.0,
  };
  const additives: Record<keyof ScoreMap, number> = {
    overall: 0, wealth: 0, love: 0, health: 0,
    career: 0, relations: 0, study: 0,
  };

  // A. 강약 기반 배수 적용
  if (strength === "strong" || strength === "very_strong") {
    multipliers.wealth *= 1.05;
    multipliers.career *= 1.05;
    multipliers.health *= 0.95;
  } else if (strength === "weak" || strength === "very_weak") {
    multipliers.wealth *= 0.90;
    multipliers.health *= 1.05;
  }
  // balanced: 변경 없음

  // B. 오늘 오행 상호작용 (Task 4: 카테고리별 차등 배수)
  const domainKeys: (keyof ScoreMap)[] = ["wealth", "love", "health", "career", "relations", "study"];
  const FAVORABLE_MULTS:   Record<string, number> = {
    love: 1.06, relations: 1.06, health: 1.05, wealth: 1.03, career: 1.03, study: 1.03,
  };
  const UNFAVORABLE_MULTS: Record<string, number> = {
    love: 0.93, relations: 0.93, health: 0.95, wealth: 0.97, career: 0.97, study: 0.97,
  };
  if (todayElem && favorable.includes(todayElem)) {
    for (const d of domainKeys) { multipliers[d] *= FAVORABLE_MULTS[d as string] ?? 1.05; }
  } else if (todayElem && unfavorable.includes(todayElem)) {
    for (const d of domainKeys) { multipliers[d] *= UNFAVORABLE_MULTS[d as string] ?? 0.95; }
  }

  // C. 오행 불균형 보정
  for (const defElem of deficientElements) {
    if (todayElem === defElem) {
      additives.health += 3;
      // overall은 아래에서 6개 도메인 평균으로 재계산하므로 직접 가산 생략
    }
  }
  for (const exElem of excessiveElements) {
    if (todayElem === exElem) {
      additives.relations -= 2;
      additives.health    -= 2;
    }
  }

  // Step 5: 보정 적용 (원본 변경 없이 새 객체 생성)
  // 순서: 1) 배수 적용, 2) 가산 적용, 3) 도메인별 클램프
  const adjusted: ScoreMap = { ...rawSajuScores };

  for (const d of domainKeys) {
    const v = Math.round(adjusted[d] * multipliers[d] + additives[d]);
    adjusted[d] = Math.max(0, Math.min(100, v));
  }

  // overall 재계산 — 기존 프로젝트 규칙과 일치 (6개 도메인 단순 평균)
  adjusted.overall = Math.max(0, Math.min(100, Math.round(
    (adjusted.wealth + adjusted.love + adjusted.health +
      adjusted.career + adjusted.relations + adjusted.study) / 6,
  )));

  return {
    adjustedScores: adjusted,
    debug: {
      strength_level:       strength,
      favorable_elements:   favorable,
      unfavorable_elements: unfavorable,
      element_distribution: dist,
      imbalance_detected:   imbalanceDetected,
      deficient_elements:   deficientElements,
      excessive_elements:   excessiveElements,
      applied_today_element: todayElem,
      applied_multipliers:  multipliers,
      applied_additives:    additives,
    },
  };
}
