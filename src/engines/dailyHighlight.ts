/**
 * Daily Highlight Layer
 *
 * 목적: "이번 달 흐름 대비 오늘 가장 눈에 띄는 변화"
 *
 * 중요:
 * - rawScore, displayScore, 엔진 로직 수정 금지
 * - Daily Highlight는 UX/AI 해석 참고용
 * - 점수 산출에는 절대 개입하지 않음
 * - 상승/하락 모두 highlight 후보
 * - abs(delta), abs(zScore) 기준으로 선정
 */

import type { ScoreMap } from "./sajuEngine";
import type { CanonicalCategory, CategoryScores } from "./profileBaseline";

// ── Types ──────────────────────────────────────────────────────────────────

export type MonthlyCategoryStats = {
  period: string; // "2026-06"
  categoryMean: CategoryScores;
  categoryStdDev: CategoryScores;
  categoryMedian?: CategoryScores;
  sampleCount: number;
};

export type DailyHighlight = {
  category: CanonicalCategory;
  todayScore: number;
  monthlyMean: number;
  delta: number;
  zScore: number;
  direction: "up" | "down";
  strength: "noticeable" | "strong";
};

// ── Constants ──────────────────────────────────────────────────────────────

const MIN_STDDEV = 1.0;
const CATEGORY_KEYS: CanonicalCategory[] = ["wealth", "love", "health", "career", "relations", "study"];

// ── Main Functions ─────────────────────────────────────────────────────────

/**
 * buildDailyHighlight
 *
 * 오늘 점수와 월 평균을 비교하여 가장 눈에 띄는 변화를 찾는다.
 *
 * @param todayScores - 오늘의 raw categoryScores
 * @param monthlyStats - 이번 달 통계
 * @returns 가장 눈에 띄는 변화 1개, 없으면 null
 *
 * 규칙:
 * 1. 각 카테고리별 delta = todayScore - monthlyMean
 * 2. zScore = delta / max(monthlyStdDev, 1)
 * 3. 후보 조건: abs(delta) >= 2 AND abs(zScore) >= 0.6
 * 4. 정렬: abs(zScore) DESC, abs(delta) DESC
 * 5. 가장 높은 후보 1개 반환
 * 6. 상승/하락 모두 후보
 */
export function buildDailyHighlight(
  todayScores: ScoreMap,
  monthlyStats: MonthlyCategoryStats,
): DailyHighlight | null {
  interface Candidate {
    category: CanonicalCategory;
    todayScore: number;
    monthlyMean: number;
    delta: number;
    zScore: number;
    absDelta: number;
    absZScore: number;
  }

  const candidates: Candidate[] = [];

  for (const cat of CATEGORY_KEYS) {
    const todayScore = todayScores[cat];
    const monthlyMean = monthlyStats.categoryMean[cat];
    const monthlyStdDev = Math.max(MIN_STDDEV, monthlyStats.categoryStdDev[cat]);

    const delta = todayScore - monthlyMean;
    const zScore = delta / monthlyStdDev;

    const absDelta = Math.abs(delta);
    const absZScore = Math.abs(zScore);

    // 후보 조건 (C. 권장 강화)
    if (absDelta < 3 || absZScore < 0.9) {
      continue;
    }

    candidates.push({
      category: cat,
      todayScore,
      monthlyMean,
      delta,
      zScore,
      absDelta,
      absZScore,
    });
  }

  if (candidates.length === 0) {
    return null;
  }

  // 정렬: abs(zScore) DESC, abs(delta) DESC
  candidates.sort((a, b) => {
    if (a.absZScore !== b.absZScore) {
      return b.absZScore - a.absZScore;
    }
    return b.absDelta - a.absDelta;
  });

  const top = candidates[0];

  // direction
  const direction: "up" | "down" = top.delta > 0 ? "up" : "down";

  // strength
  let strength: "noticeable" | "strong";
  if (top.absZScore >= 1.2 && top.absDelta >= 5) {
    strength = "strong";
  } else {
    strength = "noticeable";
  }

  return {
    category: top.category,
    todayScore: top.todayScore,
    monthlyMean: top.monthlyMean,
    delta: top.delta,
    zScore: top.zScore,
    direction,
    strength,
  };
}

/**
 * generateMonthlyCategoryStats
 *
 * 해당 월의 모든 날짜 raw categoryScores를 기반으로 통계를 생성한다.
 *
 * @param dailyScores - 해당 월의 모든 날짜별 raw categoryScores
 * @param period - "2026-06" 형식
 * @returns MonthlyCategoryStats
 *
 * 주의:
 * - raw categoryScores만 사용 (displayScores/focus 제외)
 * - stdDev 0 방어
 */
export function generateMonthlyCategoryStats(
  dailyScores: ScoreMap[],
  period: string,
): MonthlyCategoryStats {
  if (dailyScores.length === 0) {
    throw new Error("dailyScores cannot be empty");
  }

  const categoryArrays: Record<CanonicalCategory, number[]> = {
    wealth: [],
    love: [],
    health: [],
    career: [],
    relations: [],
    study: [],
  };

  for (const scores of dailyScores) {
    for (const cat of CATEGORY_KEYS) {
      categoryArrays[cat].push(scores[cat]);
    }
  }

  const categoryMean: CategoryScores = {} as CategoryScores;
  const categoryStdDev: CategoryScores = {} as CategoryScores;
  const categoryMedian: CategoryScores = {} as CategoryScores;

  for (const cat of CATEGORY_KEYS) {
    const arr = categoryArrays[cat];
    categoryMean[cat] = mean(arr);
    categoryStdDev[cat] = stdDev(arr);
    categoryMedian[cat] = median(arr);
  }

  return {
    period,
    categoryMean,
    categoryStdDev,
    categoryMedian,
    sampleCount: dailyScores.length,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = arr.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function stdDev(arr: number[]): number {
  if (arr.length === 0) return MIN_STDDEV;
  const m = mean(arr);
  const variance = arr.reduce((sum, val) => sum + Math.pow(val - m, 2), 0) / arr.length;
  return Math.max(MIN_STDDEV, Math.sqrt(variance));
}
