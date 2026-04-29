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
import { buildReasonSources, type ReasonSources } from "./reasonLayer";
import { SCORE_GOLD, SCORE_MINT, SCORE_GRAY } from "../constants/scoreThresholds";

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

/** Task 2: 카테고리별 일별 민감도 배수 */
const DAILY_SENSITIVITY: Partial<Record<keyof ScoreMap, number>> = {
  love: 1.25, relations: 1.10, health: 1.15, wealth: 1.10, study: 1.08, career: 0.90,
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
  if (score >= SCORE_GOLD) return "대길";
  if (score >= SCORE_MINT) return "길";
  if (score >= SCORE_GRAY) return "보통";
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
  reasonSources?: ReasonSources;
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

      // FIX 6: daily_delta = 각 엔진의 BASE 편차를 가중 합산 (base 성분은 BASE 하나로 고정)
      const dailyDelta = (sSoft - BASE) * w.saju + (zSoft - BASE) * w.ziwei + (aSoft - BASE) * w.astro;

      // Task 5: 음수 daily_delta 상한 -12 (패널티 누적 방지, BASE 절대값 개입 없음)
      const clampedDelta = Math.max(-12, dailyDelta);

      // Task 2: 카테고리별 민감도 — daily_delta에만 적용
      const sens = DAILY_SENSITIVITY[cat] ?? 1.0;

      // FIX 7: 최종 클램프 (float 유지 — 최종 반올림은 getDailyFortune에서 1회 적용)
      merged[cat] = Math.max(0, Math.min(100, BASE + clampedDelta * sens));
    }

    const domainCats: (keyof ScoreMap)[] = ["wealth", "love", "health", "career", "relations", "study"];

    // Task 1: Base 스프레드 압축 — 카테고리 평균 기준 편차를 0.65 배율로 압축
    const catAvg = domainCats.reduce((s, c) => s + (merged[c] as number), 0) / domainCats.length;
    for (const c of domainCats) {
      merged[c] = Math.max(0, Math.min(100, catAvg + (merged[c] - catAvg) * 0.65));
    }

    // FIX 7: overall = 6개 영역 단순 평균 후 클램프 (float 유지)
    merged.overall = Math.max(0, Math.min(100,
      (merged.wealth + merged.love + merged.health + merged.career + merged.relations + merged.study) / 6
    ));

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

    // Task 6: Love 점수 안정화 — love < 카테고리 평균 - 5 일 때만 보정
    {
      const dc: (keyof ScoreMap)[] = ["wealth", "love", "health", "career", "relations", "study"];
      const avg6 = dc.reduce((s, c) => s + merged[c], 0) / dc.length;
      if (merged.love < avg6 - 5) {
        const tenGodDay = sajuResult.factors.ten_god_of_day as string | undefined;
        const exprBoost = (tenGodDay === "食神" || tenGodDay === "傷官") ? 30 * 0.15 : 0;
        const boost = merged.relations * 0.20 + exprBoost;
        merged.love = Math.min(100, merged.love + Math.min(8, boost));
        merged.overall = Math.max(0, Math.min(100,
          dc.reduce((s, c) => s + merged[c], 0) / dc.length));
      }
      // Task 9: Relation stabilization — activates only when love is above average
      const avg6r = dc.reduce((s, c) => s + merged[c], 0) / dc.length;
      if (merged.relations < avg6r - 5 && merged.love > avg6r) {
        const relBoost = Math.min(12, merged.love * 0.20);
        merged.relations = Math.min(100, merged.relations + relBoost);
        merged.overall = Math.max(0, Math.min(100,
          dc.reduce((s, c) => s + merged[c], 0) / dc.length));
      }
    }

    // 최종 반올림 — 모든 중간 연산 완료 후 1회만 적용
    const allCats: (keyof ScoreMap)[] = ["wealth", "love", "health", "career", "relations", "study", "overall"];
    for (const c of allCats) {
      merged[c] = Math.max(0, Math.min(100, Math.round(merged[c])));
    }

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
      reasonSources: buildReasonSources(
        sajuResult.factors,  ziweiResult.factors,  astroResult.factors,
        sajuResult.contributions, ziweiResult.contributions, astroResult.contributions,
      ),
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

    // Task 7: 순위 고착 방지 — 카테고리 자체 일별 신호 조건 충족 시에만 보정
    {
      const rc: (keyof ScoreMap)[] = ["wealth", "love", "health", "career", "relations", "study"];
      let topStreak = { cat: "" as keyof ScoreMap, count: 0 };
      let botStreak = { cat: "" as keyof ScoreMap, count: 0 };

      for (let i = 0; i < dailyList.length; i++) {
        const d    = dailyList[i];
        const prev = dailyList[i - 1];
        const sorted = [...rc].sort((a, b) => d.scores[b] - d.scores[a]);
        const top = sorted[0];
        const bot = sorted[sorted.length - 1];

        topStreak = top === topStreak.cat
          ? { cat: top, count: topStreak.count + 1 } : { cat: top, count: 1 };
        botStreak = bot === botStreak.cat
          ? { cat: bot, count: botStreak.count + 1 } : { cat: bot, count: 1 };

        // 1위 보정: 연속 3일+ AND 해당 카테고리의 일별 변화량이 약할 때만
        if (topStreak.count >= 3) {
          const topDayDelta = prev ? Math.abs(d.scores[top] - prev.scores[top]) : 0;
          if (topDayDelta < 5) {
            const adj = topDayDelta < 3 ? 4 : 2;
            d.scores[top] = Math.max(0, d.scores[top] - adj);
            d.scores.overall = Math.max(0, Math.min(100,
              Math.round(rc.reduce((s, c) => s + d.scores[c], 0) / rc.length)));
          }
        }

        // 꼴찌 보정: 연속 3일+ AND 해당 카테고리의 오늘 신호가 양수(전일 대비 상승)일 때만
        if (botStreak.count >= 3) {
          const botDayDelta = prev ? d.scores[bot] - prev.scores[bot] : 0;
          if (botDayDelta > 0) {
            const adj = botDayDelta > 3 ? 4 : 2;
            d.scores[bot] = Math.min(100, d.scores[bot] + adj);
            d.scores.overall = Math.max(0, Math.min(100,
              Math.round(rc.reduce((s, c) => s + d.scores[c], 0) / rc.length)));
          }
        }
      }
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
