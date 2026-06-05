/**
 * Monthly Baseline Layer v2
 *
 * 목적: "이번 달 평균과 비교했을 때 오늘 무엇이 더 눈에 띄는가"
 *
 * 차이점:
 * - Profile Baseline: 개인 특성 기준 (180일 평균)
 * - Monthly Baseline: 계절/월별 특성 기준 (해당 월 평균)
 *
 * 중요:
 * - rawScore, displayScore, 엔진 로직 수정 금지
 * - Monthly Baseline은 UX/AI 해석 참고용
 * - 점수 산출에는 절대 개입하지 않음
 */

import type { ScoreMap } from "./sajuEngine";
import type { SajuEngineProfile } from "./sajuEngine";
import type { ZiweiProfile } from "./ziweiEngine";
import type { AstroProfile } from "./astroEngine";
import { FortuneAggregator } from "./aggregator";
import type { CanonicalCategory, CategoryScores, CategoryDeltaFromBaseline, BaselineHighlights } from "./profileBaseline";

// ── Types ──────────────────────────────────────────────────────────────────

export type MonthlyBaseline = {
  engineVersion: string;
  generatedAt: string;
  baseYear: number;
  yearsToSample: number;

  // 1~12월별 통계
  monthlyMean: Record<number, CategoryScores>;
  monthlyStdDev: Record<number, CategoryScores>;
  monthlyMedian: Record<number, CategoryScores>;

  monthlyTop1Rate: Record<number, CategoryScores>;
  monthlyBottom1Rate: Record<number, CategoryScores>;

  sampleCountPerMonth: Record<number, number>;
};

// ── Constants ──────────────────────────────────────────────────────────────

const ENGINE_VERSION = "v2.0";
const CATEGORY_KEYS: CanonicalCategory[] = ["wealth", "love", "health", "career", "relations", "study"];
const MIN_STDDEV = 1.0;

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

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

// ── Main Functions ─────────────────────────────────────────────────────────

/**
 * generateMonthlyBaseline
 *
 * 월별 기준선을 생성한다.
 *
 * @param sajuProfile - Saju profile
 * @param ziweiProfile - Ziwei profile
 * @param astroProfile - Astro profile
 * @param baseYear - 기준 연도
 * @param yearsToSample - 샘플링할 연도 수 (기본 3년, ±1.5년)
 *
 * 규칙:
 * - baseYear 기준 과거/미래 각 yearsToSample/2년씩 샘플링
 * - 각 월의 모든 날짜 샘플링
 * - 예: 1월 = 3년 × 31일 = 93 samples
 * - categoryScores는 raw 기준 사용 (displayScores/focus 제외)
 */
export async function generateMonthlyBaseline(
  sajuProfile: SajuEngineProfile,
  ziweiProfile: ZiweiProfile,
  astroProfile: AstroProfile,
  birthDate: Date,
  baseYear: number,
  yearsToSample = 3,
): Promise<MonthlyBaseline> {
  const halfYears = Math.floor(yearsToSample / 2);
  const startYear = baseYear - halfYears;
  const endYear = baseYear + halfYears;

  const agg = new FortuneAggregator(
    sajuProfile,
    ziweiProfile,
    astroProfile,
    undefined,
    birthDate,
    false,
  );

  // 월별 데이터 수집
  const monthlyData: Record<number, {
    categoryArrays: Record<CanonicalCategory, number[]>;
    top1Counts: Record<CanonicalCategory, number>;
    bottom1Counts: Record<CanonicalCategory, number>;
    sampleCount: number;
  }> = {};

  for (let month = 1; month <= 12; month++) {
    monthlyData[month] = {
      categoryArrays: {
        wealth: [], love: [], health: [], career: [], relations: [], study: [],
      },
      top1Counts: {
        wealth: 0, love: 0, health: 0, career: 0, relations: 0, study: 0,
      },
      bottom1Counts: {
        wealth: 0, love: 0, health: 0, career: 0, relations: 0, study: 0,
      },
      sampleCount: 0,
    };
  }

  // 샘플링
  for (let year = startYear; year <= endYear; year++) {
    for (let month = 1; month <= 12; month++) {
      const daysInMonth = getDaysInMonth(year, month);

      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month - 1, day);
        const fortune = agg.getDailyFortune(date);
        const rawScores = fortune.scores;

        const data = monthlyData[month];

        for (const cat of CATEGORY_KEYS) {
          data.categoryArrays[cat].push(rawScores[cat]);
        }

        const sorted = CATEGORY_KEYS.slice().sort((a, b) => rawScores[b] - rawScores[a]);
        data.top1Counts[sorted[0]]++;
        data.bottom1Counts[sorted[5]]++;
        data.sampleCount++;
      }
    }
  }

  // 통계 계산
  const monthlyMean: Record<number, CategoryScores> = {};
  const monthlyStdDev: Record<number, CategoryScores> = {};
  const monthlyMedian: Record<number, CategoryScores> = {};
  const monthlyTop1Rate: Record<number, CategoryScores> = {};
  const monthlyBottom1Rate: Record<number, CategoryScores> = {};
  const sampleCountPerMonth: Record<number, number> = {};

  for (let month = 1; month <= 12; month++) {
    const data = monthlyData[month];

    monthlyMean[month] = {} as CategoryScores;
    monthlyStdDev[month] = {} as CategoryScores;
    monthlyMedian[month] = {} as CategoryScores;
    monthlyTop1Rate[month] = {} as CategoryScores;
    monthlyBottom1Rate[month] = {} as CategoryScores;

    for (const cat of CATEGORY_KEYS) {
      monthlyMean[month][cat] = mean(data.categoryArrays[cat]);
      monthlyStdDev[month][cat] = stdDev(data.categoryArrays[cat]);
      monthlyMedian[month][cat] = median(data.categoryArrays[cat]);
      monthlyTop1Rate[month][cat] = data.top1Counts[cat] / data.sampleCount;
      monthlyBottom1Rate[month][cat] = data.bottom1Counts[cat] / data.sampleCount;
    }

    sampleCountPerMonth[month] = data.sampleCount;
  }

  return {
    engineVersion: ENGINE_VERSION,
    generatedAt: new Date().toISOString(),
    baseYear,
    yearsToSample,
    monthlyMean,
    monthlyStdDev,
    monthlyMedian,
    monthlyTop1Rate,
    monthlyBottom1Rate,
    sampleCountPerMonth,
  };
}

/**
 * buildMonthlyBaselineDeltas
 *
 * 오늘 점수와 해당 월 Baseline을 비교한다.
 *
 * @param todayScores - 오늘의 raw categoryScores
 * @param monthlyBaseline - MonthlyBaseline
 * @param month - 비교할 월 (1~12)
 *
 * 계산:
 * - delta = todayScore - monthlyBaseline.monthlyMean[month][category]
 * - zScore = delta / monthlyBaseline.monthlyStdDev[month][category]
 */
export function buildMonthlyBaselineDeltas(
  todayScores: ScoreMap,
  monthlyBaseline: MonthlyBaseline,
  month: number,
): CategoryDeltaFromBaseline[] {
  const deltas: CategoryDeltaFromBaseline[] = [];

  const monthMean = monthlyBaseline.monthlyMean[month];
  const monthStdDev = monthlyBaseline.monthlyStdDev[month];

  for (const cat of CATEGORY_KEYS) {
    const todayScore = todayScores[cat];
    const baselineMean = monthMean[cat];
    const baselineStdDev = Math.max(MIN_STDDEV, monthStdDev[cat]);

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

  deltas.sort((a, b) => {
    const absZA = Math.abs(a.zScore);
    const absZB = Math.abs(b.zScore);
    if (absZA !== absZB) return absZB - absZA;
    return Math.abs(b.delta) - Math.abs(a.delta);
  });

  return deltas;
}

/**
 * getMonthlyBaselineHighlights
 *
 * UX용 대표 변화를 추출한다. (Profile Baseline과 동일한 규칙)
 */
export function getMonthlyBaselineHighlights(
  deltas: CategoryDeltaFromBaseline[],
): BaselineHighlights {
  const stronger: CategoryDeltaFromBaseline[] = [];
  const weaker: CategoryDeltaFromBaseline[] = [];

  for (const d of deltas) {
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
 * shouldRegenerateMonthlyBaseline
 *
 * Monthly Baseline 재생성이 필요한지 판단한다.
 */
export function shouldRegenerateMonthlyBaseline(
  baseline: MonthlyBaseline | null | undefined,
  currentEngineVersion: string,
  baseYear: number,
  yearsToSample: number,
): boolean {
  if (!baseline) return true;
  if (baseline.engineVersion !== currentEngineVersion) return true;
  if (baseline.baseYear !== baseYear) return true;
  if (baseline.yearsToSample !== yearsToSample) return true;
  return false;
}
