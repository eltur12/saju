/**
 * Focus Builder
 *
 * Focus Catalog v2를 활용하여 DailyFocus를 생성하고 displayScores를 적용한다.
 */

import { FOCUS_CATALOG_V2 } from "./focusCatalog";
import type { DailyFocus } from "./persistedDailyMapper";
import type { ScoreMap } from "./sajuEngine";

/**
 * 월간 Top1 통계
 *
 * personalRarityBonus 계산에 사용
 */
export interface MonthlyTop1Stats {
  wealth:    number;
  love:      number;
  health:    number;
  career:    number;
  relations: number;
  study:     number;
}

/**
 * calculateRepresentativeCategory
 *
 * Focus의 대표 카테고리를 계산한다.
 * Focus의 category를 반환한다. (Focus는 이미 하나의 category로 생성됨)
 */
function calculateRepresentativeCategory(focus: DailyFocus): keyof ScoreMap {
  return focus.category;
}

/**
 * getFocusDisplayBoost — polarity별 displayScore 보정 정책 (V3.1)
 *
 * - positive: medium +5, strong +7 (기존 정책 유지)
 * - mixed:    0 (점수에 영향 없음 — 특징만 노출)
 * - negative: -3 (부드러운 하향 — 경고 아님)
 * - polarity 누락(구버전 캐시): positive로 간주
 *
 * rawScore에는 절대 적용하지 않는다. displayScores 전용.
 */
export function getFocusDisplayBoost(focus: Pick<DailyFocus, "polarity" | "strength">): number {
  if (focus.polarity === "mixed") return 0;
  if (focus.polarity === "negative") return -3;

  if (focus.strength === "strong") return 7;
  return 5;
}

/**
 * getFocusCategoryArrow — 대표 카테고리 화살표 표시 정책 (V3.1)
 *
 * - positive: "↑"
 * - mixed:    "" (화살표 없음)
 * - negative: "↓"
 * - polarity 누락(구버전 캐시): positive로 간주
 */
export function getFocusCategoryArrow(polarity: DailyFocus["polarity"]): string {
  if (polarity === "mixed") return "";
  if (polarity === "negative") return "↓";
  return "↑";
}

/**
 * buildDailyFocus
 *
 * 하루의 활성 이벤트와 raw 점수를 기반으로 Focus를 생성한다.
 *
 * 규칙:
 * 1. sourceKeys가 모두 activeEventKeys에 포함되면 후보로 활성
 * 2. 같은 category에서 여러 focus 활성 시 focusScore 높은 1개만 유지
 * 3. 하루 최대 2개 focus만 유지
 * 4. 정렬 우선순위:
 *    - focusScore 높은 순
 *    - 동점 시 strength (strong > medium)
 *    - 동점 시 displayBoost 큰 순
 *    - 동점 시 rawScore 낮은 순 (묻힌 특별함 우선)
 * 5. 각 Focus에 representativeCategory 설정
 */
export function buildDailyFocus(
  activeEventKeys: Set<string>,
  rawScores:       ScoreMap,
  monthlyTop1:     MonthlyTop1Stats
): DailyFocus[] {
  const candidateFocuses: DailyFocus[] = [];

  // Step 1: 모든 catalog entry 검사
  for (const entry of FOCUS_CATALOG_V2) {
    // sourceKeys가 모두 존재하는지 확인
    if (!entry.sourceKeys.every(k => activeEventKeys.has(k))) {
      continue;
    }

    // personalRarityBonus 계산
    const top1Count = entry.category === "overall" ? 0 : monthlyTop1[entry.category];
    let personalRarityBonus = 0;
    if (top1Count <= 2) {
      personalRarityBonus = 3;
    } else if (top1Count <= 4) {
      personalRarityBonus = 2;
    } else if (top1Count <= 7) {
      personalRarityBonus = 1;
    }

    const focusScore = entry.baseFocusScore + personalRarityBonus;

    // displayBoost: polarity별 정책 (V3.1) — positive +5/+7, mixed 0, negative -3
    const displayBoost = getFocusDisplayBoost(entry);

    const focus: DailyFocus = {
      key:                 entry.key,
      category:            entry.category,
      label:               entry.label,
      strength:            entry.strength,
      polarity:            entry.polarity,
      sourceKeys:          entry.sourceKeys,
      baseFocusScore:      entry.baseFocusScore,
      personalRarityBonus,
      focusScore,
      displayBoost,
    };

    candidateFocuses.push(focus);
  }

  // Step 2: 같은 category에서 focusScore 최고인 것만 유지
  const focusByCategory = new Map<keyof ScoreMap, DailyFocus>();

  for (const focus of candidateFocuses) {
    const existing = focusByCategory.get(focus.category);
    if (!existing || focus.focusScore > existing.focusScore) {
      focusByCategory.set(focus.category, focus);
    }
  }

  // Step 3: 정렬 후 최대 2개만 선택
  const selectedFocuses = Array.from(focusByCategory.values()).sort((a, b) => {
    // focusScore 높은 순
    if (a.focusScore !== b.focusScore) {
      return b.focusScore - a.focusScore;
    }

    // strength 우선 (strong > medium)
    const strengthOrder = { strong: 2, medium: 1 };
    if (strengthOrder[a.strength] !== strengthOrder[b.strength]) {
      return strengthOrder[b.strength] - strengthOrder[a.strength];
    }

    // displayBoost 큰 순
    if (a.displayBoost !== b.displayBoost) {
      return b.displayBoost - a.displayBoost;
    }

    // rawScore 낮은 순 (묻힌 특별함 우선)
    return rawScores[a.category] - rawScores[b.category];
  }).slice(0, 2);

  // Step 4: 각 Focus에 representativeCategory 설정
  for (const focus of selectedFocuses) {
    focus.representativeCategory = calculateRepresentativeCategory(focus);
  }

  return selectedFocuses;
}

/**
 * applyMonthlyFocusFrequencyCap — Focus Frequency Cap (Policy B)
 *
 * 동일 focus key가 같은 월 안에서 maxPerKey회까지만 노출되도록 제한한다.
 * - 날짜순 선착순 maxPerKey회 유지, 초과분 제거
 * - polarity/strength 예외 없음 (positive/mixed/negative 모두 적용)
 * - 하루의 다른 focus는 유지, 모두 제거되면 빈 배열
 * - rawScore / dailyHighlight / baseline은 일절 건드리지 않음
 *
 * 호출 위치: aggregator.getMonthlyFortune의 월 dailyList 생성 이후.
 * daily builder(buildDailyFocus)는 순수 후보 생성 역할을 유지한다.
 *
 * cap으로 focus가 제거된 날은 persisted.displayScores를 재계산하고
 * aiRequestV2.focus도 동기화한다 (persisted.focus와 1:1 순서 매핑).
 *
 * @returns 제거된 focus 인스턴스 수
 */
export function applyMonthlyFocusFrequencyCap(
  dailyList: Array<{
    scores: ScoreMap;
    persisted?: { focus?: DailyFocus[]; displayScores?: ScoreMap };
    aiRequestV2?: { focus?: unknown[] };
  }>,
  maxPerKey = 3,
): number {
  const countByKey = new Map<string, number>();
  let removed = 0;

  for (const day of dailyList) {
    const focuses = day.persisted?.focus;
    if (!focuses || focuses.length === 0) continue;

    const keptIdx: number[] = [];
    focuses.forEach((f, i) => {
      const n = countByKey.get(f.key) ?? 0;
      if (n < maxPerKey) {
        countByKey.set(f.key, n + 1);
        keptIdx.push(i);
      } else {
        removed++;
      }
    });

    const kept = keptIdx.length === focuses.length ? focuses : keptIdx.map(i => focuses[i]);
    if (keptIdx.length !== focuses.length) {
      day.persisted!.focus = kept; // 기존 정렬 순서 유지
      if (day.aiRequestV2?.focus) {
        day.aiRequestV2.focus = day.aiRequestV2.focus.filter((_, i) => keptIdx.includes(i));
      }
    }
    // displayScores는 항상 재계산 — daily 빌드 후 월 보정(순위 고착 방지)으로
    // raw가 조정된 날에도 "조정된 raw + 정책 boost"로 일치하도록 보장
    day.persisted!.displayScores = kept.length > 0 ? applyFocusBoost(day.scores, kept) : undefined;
  }

  return removed;
}

/**
 * applyFocusBoost
 *
 * categoryScores(raw)에 focus boost를 적용하여 displayScores를 생성한다.
 *
 * 규칙:
 * - categoryScores는 변경하지 않음 (새 객체 생성)
 * - 각 category는 1회만 boost 적용
 * - 0~100 clamp
 */
export function applyFocusBoost(
  categoryScores: ScoreMap,
  focuses:        DailyFocus[]
): ScoreMap {
  // 새 객체 생성 (원본 보존)
  const displayScores: ScoreMap = { ...categoryScores };

  // Focus boost 적용
  for (const focus of focuses) {
    const boosted = displayScores[focus.category] + focus.displayBoost;
    displayScores[focus.category] = Math.min(Math.max(boosted, 0), 100);
  }

  return displayScores;
}
