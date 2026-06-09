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

    // displayBoost 계산
    let displayBoost = 0;
    if (focusScore >= 11) {
      displayBoost = 7;
    } else if (focusScore >= 8) {
      displayBoost = 5;
    }

    const focus: DailyFocus = {
      key:                 entry.key,
      category:            entry.category,
      label:               entry.label,
      strength:            entry.strength,
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
