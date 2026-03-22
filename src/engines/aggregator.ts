/**
 * 운세 통합 집계기 (Fortune Aggregator)
 */
import type { ScoreMap } from "./sajuEngine";
import { buildSajuEngineFromProfile, type SajuEngineProfile } from "./sajuEngine";
import { buildZiweiEngineFromProfile, type ZiweiProfile } from "./ziweiEngine";
import { buildAstroEngineFromProfile, type AstroProfile } from "./astroEngine";
import { getLunarDate } from "../utils/lunarConverter";
import { generateTodos, generateSummary } from "./todoGenerator";

const ENGINE_WEIGHTS = { saju: 0.45, ziwei: 0.35, astro: 0.20 };

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
  private sajuEngine: ReturnType<typeof buildSajuEngineFromProfile>;
  private ziweiEngine: ReturnType<typeof buildZiweiEngineFromProfile>;
  private astroEngine: ReturnType<typeof buildAstroEngineFromProfile>;
  private weights: typeof ENGINE_WEIGHTS;
  private birthDate: Date;

  constructor(
    sajuProfile: SajuEngineProfile,
    ziweiProfile: ZiweiProfile,
    astroProfile: AstroProfile,
    engineWeights = ENGINE_WEIGHTS,
    birthDate = new Date(1998, 0, 22),
  ) {
    this.sajuEngine  = buildSajuEngineFromProfile(sajuProfile);
    this.ziweiEngine = buildZiweiEngineFromProfile(ziweiProfile);
    this.astroEngine = buildAstroEngineFromProfile(astroProfile);
    this.weights     = engineWeights;
    this.birthDate   = birthDate;
  }

  private mergeScores(sajuScores: ScoreMap, ziweiScores: ScoreMap, astroScores: ScoreMap): ScoreMap {
    const cats: (keyof ScoreMap)[] = ["overall","wealth","love","health","career"];
    const merged = {} as ScoreMap;
    for (const cat of cats) {
      const s = sajuScores[cat] ?? 50;
      const z = ziweiScores[cat] ?? 0;
      const a = astroScores[cat] ?? 0;
      const combined = s * this.weights.saju + (50 + z) * this.weights.ziwei + (50 + a) * this.weights.astro;
      merged[cat] = Math.max(20, Math.min(100, Math.round(combined)));
    }
    return merged;
  }

  getDailyFortune(targetDate: Date): DailyFortune {
    const sajuResult  = this.sajuEngine.calculate(targetDate);
    const ziweiResult = this.ziweiEngine.calculate(targetDate);
    const astroResult = this.astroEngine.calculate(targetDate, this.birthDate);

    const merged = this.mergeScores(sajuResult.scores, ziweiResult.scores, astroResult.scores);
    const badge   = scoreToBadge(merged.overall);
    const lunar   = getLunarDate(targetDate);
    const summary = generateSummary(merged, sajuResult.factors, ziweiResult.factors);
    const todos   = generateTodos(merged, sajuResult.factors, badge, targetDate);

    return {
      date:       `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, "0")}-${String(targetDate.getDate()).padStart(2, "0")}`,
      lunar_date: lunar,
      scores:     merged,
      badge,
      summary,
      todos,
    };
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
  if (avg >= 70) return `전반적으로 에너지가 상승하는 달. 특히 ${peakStr}이 최고 길일.`;
  if (avg >= 60) return `안정적인 흐름 속 기복이 있는 달. ${peakStr}을 공략하세요.`;
  return `에너지 소모가 많은 달. ${peakStr}에 집중하고 나머지는 수성에 집중.`;
}
