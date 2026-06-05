/**
 * Profile Baseline Layer v1
 *
 * 목적: "평소의 나와 비교했을 때 오늘 무엇이 더 눈에 띄는가"
 *
 * 중요:
 * - rawScore, displayScore, 엔진 로직 수정 금지
 * - Profile Baseline은 UX/AI 해석 참고용
 * - 점수 산출에는 절대 개입하지 않음
 */

import type { ScoreMap } from "./sajuEngine";
import type { SajuEngineProfile } from "./sajuEngine";
import type { ZiweiProfile } from "./ziweiEngine";
import type { AstroProfile } from "./astroEngine";
import { FortuneAggregator } from "./aggregator";

// ── Types ──────────────────────────────────────────────────────────────────

export type CanonicalCategory = "wealth" | "love" | "health" | "career" | "relations" | "study";

export type CategoryScores = {
  wealth: number;
  love: number;
  health: number;
  career: number;
  relations: number;
  study: number;
};

export type ProfileBaseline = {
  engineVersion: string;
  generatedAt: string;
  periodDays: number;

  categoryMean: CategoryScores;
  categoryStdDev: CategoryScores;
  categoryMedian: CategoryScores;

  top1Rate: CategoryScores;
  bottom1Rate: CategoryScores;

  sampleCount: number;
};

export type CategoryDeltaFromBaseline = {
  category: CanonicalCategory;
  todayScore: number;
  baselineMean: number;
  delta: number;
  zScore: number;
  label: "muchLower" | "lower" | "normal" | "higher" | "muchHigher";
};

export type BaselineHighlights = {
  stronger: CategoryDeltaFromBaseline[];
  weaker: CategoryDeltaFromBaseline[];
};

// ── Constants ──────────────────────────────────────────────────────────────

const ENGINE_VERSION = "v2.0";
const CATEGORY_KEYS: CanonicalCategory[] = ["wealth", "love", "health", "career", "relations", "study"];
const MIN_STDDEV = 1.0; // stdDev 최소값 (0 방어)

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

// ── Main Functions ─────────────────────────────────────────────────────────

/**
 * generateProfileBaseline
 *
 * 프로필의 기준선을 생성한다.
 *
 * @param profile - Saju profile
 * @param ziweiProfile - Ziwei profile
 * @param astroProfile - Astro profile
 * @param baseDate - 기준 날짜
 * @param periodDays - 샘플링 기간 (기본 180일)
 *
 * 규칙:
 * - baseDate 기준 과거 90일 + 미래 90일
 * - categoryScores는 raw 기준 사용 (displayScores/focus 제외)
 * - 180일의 categoryScores로 mean, median, stdDev 계산
 * - top1Rate / bottom1Rate 계산
 */
export async function generateProfileBaseline(
  sajuProfile: SajuEngineProfile,
  ziweiProfile: ZiweiProfile,
  astroProfile: AstroProfile,
  birthDate: Date,
  baseDate: Date,
  periodDays = 180,
): Promise<ProfileBaseline> {
  const halfPeriod = Math.floor(periodDays / 2);
  const startDate = new Date(baseDate);
  startDate.setDate(startDate.getDate() - halfPeriod);

  const agg = new FortuneAggregator(
    sajuProfile,
    ziweiProfile,
    astroProfile,
    undefined,
    birthDate,
    false, // balanceAdj 사용 안 함
  );

  // 데이터 수집
  const categoryArrays: Record<CanonicalCategory, number[]> = {
    wealth: [],
    love: [],
    health: [],
    career: [],
    relations: [],
    study: [],
  };

  const top1Counts: Record<CanonicalCategory, number> = {
    wealth: 0,
    love: 0,
    health: 0,
    career: 0,
    relations: 0,
    study: 0,
  };

  const bottom1Counts: Record<CanonicalCategory, number> = {
    wealth: 0,
    love: 0,
    health: 0,
    career: 0,
    relations: 0,
    study: 0,
  };

  for (let i = 0; i < periodDays; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);

    const fortune = agg.getDailyFortune(date);

    // IMPORTANT: raw categoryScores만 사용 (displayScores/focus 제외)
    const rawScores = fortune.scores;

    for (const cat of CATEGORY_KEYS) {
      categoryArrays[cat].push(rawScores[cat]);
    }

    // Top1 / Bottom1 계산
    const sorted = CATEGORY_KEYS.slice().sort((a, b) => rawScores[b] - rawScores[a]);
    top1Counts[sorted[0]]++;
    bottom1Counts[sorted[5]]++;
  }

  // 통계 계산
  const categoryMean: CategoryScores = {} as any;
  const categoryStdDev: CategoryScores = {} as any;
  const categoryMedian: CategoryScores = {} as any;
  const top1Rate: CategoryScores = {} as any;
  const bottom1Rate: CategoryScores = {} as any;

  for (const cat of CATEGORY_KEYS) {
    categoryMean[cat] = mean(categoryArrays[cat]);
    categoryStdDev[cat] = stdDev(categoryArrays[cat]);
    categoryMedian[cat] = median(categoryArrays[cat]);
    top1Rate[cat] = top1Counts[cat] / periodDays;
    bottom1Rate[cat] = bottom1Counts[cat] / periodDays;
  }

  return {
    engineVersion: ENGINE_VERSION,
    generatedAt: new Date().toISOString(),
    periodDays,
    categoryMean,
    categoryStdDev,
    categoryMedian,
    top1Rate,
    bottom1Rate,
    sampleCount: periodDays,
  };
}

/**
 * buildCategoryBaselineDeltas
 *
 * 오늘 점수와 Baseline을 비교한다.
 *
 * @param todayScores - 오늘의 raw categoryScores
 * @param baseline - ProfileBaseline
 *
 * 계산:
 * - delta = todayScore - baseline.categoryMean[category]
 * - zScore = delta / baseline.categoryStdDev[category]
 *
 * label 기준:
 * - zScore >= 1.2: muchHigher
 * - zScore >= 0.6: higher
 * - zScore <= -1.2: muchLower
 * - zScore <= -0.6: lower
 * - else: normal
 *
 * 정렬: abs(zScore) DESC, abs(delta) DESC
 */
export function buildCategoryBaselineDeltas(
  todayScores: ScoreMap,
  baseline: ProfileBaseline,
): CategoryDeltaFromBaseline[] {
  const deltas: CategoryDeltaFromBaseline[] = [];

  for (const cat of CATEGORY_KEYS) {
    const todayScore = todayScores[cat];
    const baselineMean = baseline.categoryMean[cat];
    const baselineStdDev = Math.max(MIN_STDDEV, baseline.categoryStdDev[cat]);

    const delta = todayScore - baselineMean;
    const zScore = delta / baselineStdDev;

    let label: CategoryDeltaFromBaseline["label"];
    if (zScore >= 1.2) {
      label = "muchHigher";
    } else if (zScore >= 0.6) {
      label = "higher";
    } else if (zScore <= -1.2) {
      label = "muchLower";
    } else if (zScore <= -0.6) {
      label = "lower";
    } else {
      label = "normal";
    }

    deltas.push({
      category: cat,
      todayScore,
      baselineMean,
      delta,
      zScore,
      label,
    });
  }

  // 정렬: abs(zScore) DESC, abs(delta) DESC
  deltas.sort((a, b) => {
    const absZA = Math.abs(a.zScore);
    const absZB = Math.abs(b.zScore);
    if (absZA !== absZB) return absZB - absZA;
    return Math.abs(b.delta) - Math.abs(a.delta);
  });

  return deltas;
}

/**
 * getBaselineHighlights
 *
 * UX용 대표 변화를 추출한다.
 *
 * 규칙:
 * - stronger: label higher 또는 muchHigher, 최대 2개
 * - weaker: label lower 또는 muchLower, 최대 1개
 * - abs(delta) >= 2 AND abs(zScore) >= 0.6
 */
export function getBaselineHighlights(
  deltas: CategoryDeltaFromBaseline[],
): BaselineHighlights {
  const stronger: CategoryDeltaFromBaseline[] = [];
  const weaker: CategoryDeltaFromBaseline[] = [];

  for (const d of deltas) {
    // 필터: abs(delta) >= 2 AND abs(zScore) >= 0.6
    if (Math.abs(d.delta) < 2 || Math.abs(d.zScore) < 0.6) {
      continue;
    }

    if ((d.label === "higher" || d.label === "muchHigher") && stronger.length < 2) {
      stronger.push(d);
    } else if ((d.label === "lower" || d.label === "muchLower") && weaker.length < 1) {
      weaker.push(d);
    }
  }

  return { stronger, weaker };
}

/**
 * shouldRegenerateBaseline
 *
 * Baseline 재생성이 필요한지 판단한다.
 *
 * 재생성 조건:
 * 1. baseline이 없는 경우
 * 2. engineVersion 변경
 * 3. sampleCount !== periodDays (기간 변경)
 */
export function shouldRegenerateBaseline(
  baseline: ProfileBaseline | null | undefined,
  currentEngineVersion: string,
  periodDays: number,
): boolean {
  if (!baseline) return true;
  if (baseline.engineVersion !== currentEngineVersion) return true;
  if (baseline.sampleCount !== periodDays) return true;
  return false;
}
