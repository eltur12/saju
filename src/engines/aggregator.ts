/**
 * 운세 통합 집계기 (Fortune Aggregator)
 */
import type { ScoreMap } from "./sajuEngine";
import { buildSajuEngineFromProfile, type SajuEngineProfile } from "./sajuEngine";
import { applySajuBalanceAdjustment, type SajuBalanceDebug } from "./sajuBalanceLayer";
import { buildZiweiEngineFromProfile, type ZiweiProfile } from "./ziweiEngine";
import { buildAstroEngineFromProfile, type AstroProfile } from "./astroEngine";
import { getLunarDate } from "../utils/lunarConverter";
import { generateTodos, generateSummary } from "./todoGenerator";
import { generateTimeSegments } from "./timeSegmentLayer";
import { generateNotificationHints } from "./notificationHintLayer";

/**
 * 도메인별 엔진 가중치 (규칙서 기준)
 * FIX 1: overall은 dead field이므로 제거 — 6개 영역 평균으로 후처리
 */
type DomainWeight = { saju: number; ziwei: number; astro: number };
const DOMAIN_WEIGHTS: Partial<Record<keyof ScoreMap, DomainWeight>> = {
  wealth:   { saju: 0.50, ziwei: 0.35, astro: 0.15 },
  love:     { saju: 0.40, ziwei: 0.35, astro: 0.25 },
  health:   { saju: 0.55, ziwei: 0.25, astro: 0.20 },
  career:   { saju: 0.50, ziwei: 0.30, astro: 0.20 },
  relations:{ saju: 0.45, ziwei: 0.30, astro: 0.25 },
  study:    { saju: 0.45, ziwei: 0.25, astro: 0.30 },
};

/** FIX 5: 극단 구간 소프트 압축 */
function softScale(score: number): number {
  if (score > 85) {
    return 85 + (score - 85) * 0.5;
  }
  if (score < 15) {
    return 15 - (15 - score) * 0.5;
  }
  return score;
}

const BASE = 60; // 기본 베이스 점수

export function scoreToBadge(score: number): string {
  if (score >= 80) return "대길";
  if (score >= 65) return "길";
  if (score >= 52) return "보통";
  return "주의";
}

export interface DailyFortune {
  date: string;
  lunar_date: string;
  scores: ScoreMap;
  badge: string;
  summary: string;
  todos: { do_list: string[]; dont_list: string[] };
  timeSegments?: Array<{
    startHour: number;
    endHour: number;
    score: number;
    tags: string[];
  }>;
  notificationHints?: Array<{
    type: "best_window" | "caution_window" | "next_rise";
    hour: number;
    score: number;
    label: string;
  }>;
}

export interface MonthlyFortuneResult {
  year: number;
  month: number;
  monthly_average: number;
  monthly_summary: string;
  peak_days: number[];
  caution_days: number[];
  daily_fortunes: DailyFortune[];
}

export class FortuneAggregator {
  private sajuEngine:      ReturnType<typeof buildSajuEngineFromProfile>;
  private ziweiEngine:     ReturnType<typeof buildZiweiEngineFromProfile>;
  private astroEngine:     ReturnType<typeof buildAstroEngineFromProfile>;
  private weights:         typeof DOMAIN_WEIGHTS;
  private birthDate:       Date;
  private sajuProfile:     SajuEngineProfile;
  private enableBalanceAdj: boolean;

  constructor(
    sajuProfile:              SajuEngineProfile,
    ziweiProfile:             ZiweiProfile,
    astroProfile:             AstroProfile,
    engineWeights             = DOMAIN_WEIGHTS,
    birthDate                 = new Date(1998, 0, 22),
    enableSajuBalanceAdjustment = false,
  ) {
    this.sajuEngine      = buildSajuEngineFromProfile(sajuProfile);
    this.ziweiEngine     = buildZiweiEngineFromProfile(ziweiProfile);
    this.astroEngine     = buildAstroEngineFromProfile(astroProfile);
    this.weights         = engineWeights;
    this.birthDate       = birthDate;
    this.sajuProfile     = sajuProfile;
    this.enableBalanceAdj = enableSajuBalanceAdjustment;
  }

  private mergeScores(sajuScores: ScoreMap, ziweiScores: ScoreMap, astroScores: ScoreMap): ScoreMap {
    const cats = Object.keys(sajuScores) as (keyof ScoreMap)[];
    const merged = {} as ScoreMap;

    for (const cat of cats) {
      if (cat === "overall") {
        // overall은 나머지 6개 영역 평균으로 후처리
        continue;
      }
      const w = this.weights[cat]!;
      const s = sajuScores[cat]  ?? BASE;
      const z = ziweiScores[cat] ?? 0;
      const a = astroScores[cat] ?? 0;

      // FIX 2: 자미·점성 델타 상한 적용
      const zCapped = Math.max(-30, Math.min(30, z));
      const aCapped = Math.max(-25, Math.min(25, a));
      const zScore  = BASE + zCapped;
      const aScore  = BASE + aCapped;

      // FIX 4: 병합 전 하드 클램프
      const sClamped = Math.max(0, Math.min(100, s));
      const zClamped = Math.max(0, Math.min(100, zScore));
      const aClamped = Math.max(0, Math.min(100, aScore));

      // FIX 5: 소프트 스케일
      const sSoft = softScale(sClamped);
      const zSoft = softScale(zClamped);
      const aSoft = softScale(aClamped);

      // FIX 6: 기존 가중치 그대로 병합
      const combined = sSoft * w.saju + zSoft * w.ziwei + aSoft * w.astro;

      // FIX 7: 최종 클램프
      merged[cat] = Math.max(0, Math.min(100, Math.round(combined)));
    }

    // FIX 7: overall = 6개 영역 단순 평균 후 클램프
    merged.overall = Math.round(
      (merged.wealth + merged.love + merged.health + merged.career + merged.relations + merged.study) / 6
    );
    merged.overall = Math.max(0, Math.min(100, merged.overall));

    return merged;
  }

  getDailyFortune(targetDate: Date): DailyFortune & { balance_debug?: SajuBalanceDebug } {
    const sajuResult  = this.sajuEngine.calculate(targetDate);
    const ziweiResult = this.ziweiEngine.calculate(targetDate);
    const astroResult = this.astroEngine.calculate(targetDate, this.birthDate);

    let sajuScoresForMerge = sajuResult.scores;
    let balanceDebug: SajuBalanceDebug | undefined;
    if (this.enableBalanceAdj) {
      const balanceResult = applySajuBalanceAdjustment(
        sajuResult.scores, this.sajuProfile, sajuResult.factors,
      );
      sajuScoresForMerge = balanceResult.adjustedScores;
      balanceDebug = balanceResult.debug;
    }

    const merged  = this.mergeScores(sajuScoresForMerge, ziweiResult.scores, astroResult.scores);
    const badge   = scoreToBadge(merged.overall);
    const lunar   = getLunarDate(targetDate);
    const summary = generateSummary(merged, sajuResult.factors, ziweiResult.factors);
    const todos   = generateTodos(merged, sajuResult.factors, badge, targetDate);

    const fortune: DailyFortune & { balance_debug?: SajuBalanceDebug } = {
      date:          `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, "0")}-${String(targetDate.getDate()).padStart(2, "0")}`,
      lunar_date:    lunar,
      scores:        merged,
      badge,
      summary,
      todos,
      balance_debug: balanceDebug,
    };
    fortune.timeSegments = generateTimeSegments(fortune);
    fortune.notificationHints = generateNotificationHints(fortune);
    return fortune;
  }

  getMonthlyFortune(year: number, month: number): MonthlyFortuneResult {
    const daysInMonth = new Date(year, month, 0).getDate();
    const dailyList: DailyFortune[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      dailyList.push(this.getDailyFortune(new Date(year, month - 1, day)));
    }

    const overallScores = dailyList.map(d => d.scores.overall);
    const avgScore = overallScores.reduce((a, b) => a + b, 0) / overallScores.length;

    const sorted = [...Array(daysInMonth).keys()].map(i => i + 1)
      .sort((a, b) => dailyList[b - 1].scores.overall - dailyList[a - 1].scores.overall);

    const peakDays    = sorted.slice(0, 5);
    const cautionDays = [...sorted].reverse().slice(0, 3);

    return {
      year,
      month,
      monthly_average:  Math.round(avgScore),
      monthly_summary:  buildMonthlySummary(avgScore, peakDays),
      peak_days:        peakDays,
      caution_days:     cautionDays,
      daily_fortunes:   dailyList,
    };
  }
}

function buildMonthlySummary(avg: number, peakDays: number[]): string {
  const peakStr = peakDays.slice(0, 3).map(d => `${d}일`).join("·");
  if (avg >= 70) return `전반적으로 흐름이 좋은 달이에요. 특히 ${peakStr}이 주목할 만한 날이에요.`;
  if (avg >= 60) return `안정적인 흐름 속 기복이 있는 달이에요. ${peakStr}을 잘 활용해 보세요.`;
  return `에너지 소모가 많은 달이에요. ${peakStr}에 집중하고 나머지는 차분하게 이어가세요.`;
}
