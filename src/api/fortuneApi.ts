/**
 * 캐시 관리 + 엔진 호출 통합
 */
import { FortuneAggregator, scoreToBadge, type MonthlyFortuneResult, type DailyFortune } from "../engines/aggregator";
import { calculateSajuProfile } from "../utils/sajuCalculator";
import { buildZiweiProfile } from "../utils/ziweiCalculator";
import { buildAstroProfile } from "../utils/astroCalculator";
import { normalizeBirthDateTimeByRegion } from "../utils/sajuTime";
import { refreshWidget } from "../plugins/widgetPlugin";
import { buildProfileInsight, type ProfileInsight } from "../engines/profileInsightLayer";
import { PERSISTED_SCHEMA_V } from "../engines/persistedDailyMapper";

export type { ProfileInsight };

/** Capacitor Preferences — 네이티브 환경에서만 동작, 웹에서는 no-op */
async function setPreference(key: string, value: string): Promise<void> {
  try {
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.set({ key, value });
  } catch {
    // 웹 브라우저 환경에서는 무시
  }
}

async function removePreference(key: string): Promise<void> {
  try {
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.remove({ key });
  } catch {
    // 웹 브라우저 환경에서는 무시
  }
}

async function listPreferenceKeys(): Promise<string[]> {
  try {
    const { Preferences } = await import("@capacitor/preferences");
    const { keys } = await Preferences.keys();
    return keys;
  } catch {
    return [];
  }
}

/** 위젯 캐시 전체 삭제
 *  - 전체 재계산/사용자 변경 시 호출하는 용도
 *  - 평소 월 조회 때는 호출하지 않음
 */
export async function clearWidgetCache(): Promise<void> {
  const keys = await listPreferenceKeys();
  const targets = keys.filter(
      (key) => key === "widget_data" || key.startsWith("widget_monthly_"),
  );

  await Promise.all(targets.map((key) => removePreference(key)));
  await refreshWidget();
}

/** 위젯에서 읽을 오늘의 운세를 SharedPreferences에 저장 */
export async function saveWidgetData(fortune: DailyFortune): Promise<void> {
  await setPreference("widget_data", JSON.stringify({
    score:     fortune.scores.overall,
    badge:     fortune.badge,
    date:      fortune.date,
    wealth:    fortune.scores.wealth,
    love:      fortune.scores.love,
    health:    fortune.scores.health,
    career:    fortune.scores.career,
    relations: fortune.scores.relations,
    study:     fortune.scores.study,
  }));

  await refreshWidget();
}

/** 달력 위젯에서 읽을 월간 운세 전체를 SharedPreferences에 저장 */
export async function saveWidgetMonthlyData(result: MonthlyFortuneResult): Promise<void> {
  const key = `widget_monthly_${result.year}_${result.month}`;

  const payload = {
    year:  result.year,
    month: result.month,
    daily_fortunes: result.daily_fortunes.map(f => ({
      score:      f.scores.overall,
      badge:      f.badge,
      summary:    f.summary,
      lunar_date: f.lunar_date,
      wealth:     f.scores.wealth,
      love:       f.scores.love,
      health:     f.scores.health,
      career:     f.scores.career,
      relations:  f.scores.relations,
      study:      f.scores.study,
    })),
  };

  await setPreference(key, JSON.stringify(payload));
}

/** 캐시 스키마 버전 — 필드 변경 시 올리면 캐시 무효화 (PersistedDailyModel 구조 변경 시 PERSISTED_SCHEMA_V 도 함께 올릴 것) */
const CACHE_VERSION = "v13-event-expansion"; // 도화살 + 12운성 7개 추가

export interface SajuUser {
  birth_year: number;
  birth_month: number;
  birth_day: number;
  birth_hour?: number;
  birth_minute?: number;
  /** 출생지 도시 id (BIRTH_REGIONS) — 진태양시 보정에 사용 */
  birth_region?: string;
  gender: "M" | "F";
  /** 인종법(引從法): 십성별 절종/병종 규칙 — 차트 분석 후 설정 */
  injong_rules?: Record<string, "jeoljong" | "byeongjong">;
}

function getCacheKey(year: number, month: number): string {
  return `${CACHE_VERSION}:${year}-${String(month).padStart(2, "0")}`;
}

function loadCache(): Record<string, MonthlyFortuneResult> {
  try {
    const raw = localStorage.getItem("saju_cache");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function stripRuntimeFields(fortune: DailyFortune): DailyFortune {
  const f = { ...fortune } as Record<string, unknown>;
  delete f["stateAtomDebug"];
  delete f["reasonSources"];
  delete f["balance_debug"];
  delete f["aiRequestV2"]; // V2 request는 runtime only, cache에 저장 안 함
  return f as unknown as DailyFortune;
}

function saveCache(key: string, data: MonthlyFortuneResult): void {
  const cache = loadCache();
  cache[key] = { ...data, daily_fortunes: data.daily_fortunes.map(stripRuntimeFields) };
  localStorage.setItem("saju_cache", JSON.stringify(cache));
}

function getTodayLocalString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * 캐시 무효화 (V1 → V2 마이그레이션 시 사용)
 * CACHE_VERSION이 변경되면 자동으로 무효화되지만,
 * 수동으로 즉시 클리어하고 싶을 때 사용
 */
export function clearFortuneCache(): void {
  console.log("[CACHE] 🗑️ Clearing all fortune cache");
  localStorage.removeItem("saju_cache");
}

// NORM_67+5: per-profile monthly normalization applied at display time
const NORM_TARGET  = 67;
const NORM_MAX_OFF = 6;
const DISPLAY_ADD  = 5;

function computeMonthlyFlowType(displayScores: number[]): string {
  const n = displayScores.length;
  if (n < 2) return "안정형";

  const first10 = displayScores.slice(0, Math.min(10, n));
  const last10  = displayScores.slice(Math.max(0, n - 10));
  const avg10 = (arr: number[]) => arr.reduce((s, x) => s + x, 0) / arr.length;
  const trend = avg10(last10) - avg10(first10);

  if (trend >= 6)  return "상승형";
  if (trend <= -6) return "하강형";

  const goldCount = displayScores.filter(s => s >= 85).length;
  if (goldCount / n >= 0.15) return "집중형";

  const mean = displayScores.reduce((s, x) => s + x, 0) / n;
  const std  = Math.sqrt(displayScores.reduce((s, x) => s + (x - mean) ** 2, 0) / n);
  if (std < 7) return "안정형";

  return "변화형";
}

const NORM_CAT_KEYS = ["wealth", "love", "health", "career", "relations", "study"] as const;

function segTags(score: number): string[] {
  if (score >= 75) return ["집중", "추진"];
  if (score >= 60) return ["정리", "무난"];
  if (score >= 45) return ["신중", "유지"];
  return ["휴식", "주의"];
}

function applyDisplayNorm(result: MonthlyFortuneResult): MonthlyFortuneResult {
  const raws = result.daily_fortunes.map(f => f.scores.overall as number);
  if (raws.length === 0) return result;
  const avg = raws.reduce((s, x) => s + x, 0) / raws.length;
  const off = Math.max(-NORM_MAX_OFF, Math.min(NORM_MAX_OFF, NORM_TARGET - avg));
  const norm = (raw: number) => Math.round(Math.max(0, Math.min(100, raw + off + DISPLAY_ADD)));

  const normalized = result.daily_fortunes.map(f => {
    // overall + 6 categories
    const display = norm(f.scores.overall as number);
    const catScores = Object.fromEntries(
      NORM_CAT_KEYS.map(cat => [cat, norm(f.scores[cat] as number)])
    ) as Pick<typeof f.scores, typeof NORM_CAT_KEYS[number]>;

    // time segments
    const timeSegments = f.timeSegments?.map(seg => {
      const s = norm(seg.score);
      return { ...seg, score: s, tags: segTags(s) };
    });

    // timeSegmentSummary — re-derive best/worst from normalized segments; keep deltas unchanged
    let timeSegmentSummary = f.timeSegmentSummary;
    if (timeSegmentSummary && timeSegments && timeSegments.length > 0) {
      const best  = timeSegments.reduce((a, b) => b.score > a.score ? b : a);
      const worst = timeSegments.reduce((a, b) => b.score < a.score ? b : a);
      timeSegmentSummary = {
        ...timeSegmentSummary,
        best:  { startHour: best.startHour,  score: best.score  },
        worst: { startHour: worst.startHour, score: worst.score },
      };
    }

    // notificationHints — normalize stored scores for consistency
    const notificationHints = f.notificationHints?.map(h => ({ ...h, score: norm(h.score) }));

    return {
      ...f,
      scores: { ...f.scores, ...catScores, overall: display },
      badge: scoreToBadge(display),
      timeSegments,
      timeSegmentSummary,
      notificationHints,
    };
  });

  const displayScores = normalized.map(f => f.scores.overall as number);
  return {
    ...result,
    monthly_average:   Math.round(displayScores.reduce((s, x) => s + x, 0) / displayScores.length),
    daily_fortunes:    normalized,
    monthly_flow_type: computeMonthlyFlowType(displayScores),
  };
}

export async function getMonthlyFortune(
    user: SajuUser,
    year: number,
    month: number,
): Promise<MonthlyFortuneResult> {
  const key = getCacheKey(year, month);
  const cache = loadCache();

  if (cache[key]) {
    const samplePersisted = cache[key].daily_fortunes[0]?.persisted;
    if (samplePersisted && samplePersisted._v !== PERSISTED_SCHEMA_V) {
      console.warn("[CACHE] persisted._v mismatch — bump CACHE_VERSION + PERSISTED_SCHEMA_V when schema changes");
    }
    console.log(`[FORTUNE_API] 📦 Using CACHE: ${key}, persisted._v=${samplePersisted?._v}, PERSISTED_SCHEMA_V=${PERSISTED_SCHEMA_V}`);
    const cached = applyDisplayNorm(cache[key]);
    await saveWidgetMonthlyData(cached);

    const todayStr = getTodayLocalString();
    const todayFortune = cached.daily_fortunes.find(d => d.date === todayStr);

    if (todayFortune) {
      await saveWidgetData(todayFortune);
    } else {
      await refreshWidget();
    }

    return cached;
  }

  const isMale = user.gender === "M";

  // 출생지 경도 기반 진태양시 보정
  const normalizedBirth = normalizeBirthDateTimeByRegion({
    year:     user.birth_year,
    month:    user.birth_month,
    day:      user.birth_day,
    hour:     user.birth_hour  ?? 12,
    minute:   user.birth_minute ?? 0,
    regionId: user.birth_region ?? "seoul",
  });

  // 사주 (동기) — 성별 반영 (대운 순역방향)
  const sajuProfile = calculateSajuProfile(
      normalizedBirth.year, normalizedBirth.month, normalizedBirth.day,
      normalizedBirth.hour, user.gender, user.injong_rules, normalizedBirth.minute,
  );

  // 자미두수 (동기) — 성별 반영 (minute 미지원, 보정된 hour만 전달)
  const ziweiProfile = buildZiweiProfile(
      normalizedBirth.year, normalizedBirth.month, normalizedBirth.day,
      normalizedBirth.hour, year, isMale,
  );

  // 서양 점성술 (비동기 — Moshier 에페메리스)
  const astroProfile = await buildAstroProfile(
      normalizedBirth.year, normalizedBirth.month, normalizedBirth.day,
      normalizedBirth.hour, undefined, undefined, normalizedBirth.minute,
  );

  const birthDate = new Date(user.birth_year, user.birth_month - 1, user.birth_day);
  const aggregator = new FortuneAggregator(
      sajuProfile, ziweiProfile, astroProfile, undefined, birthDate, true,
  );

  const result = aggregator.getMonthlyFortune(year, month);

  // Debug: Check V2 persisted data
  const sampleDay = result.daily_fortunes[0];
  console.log(`[FORTUNE_API] 🆕 NEW CALCULATION: ${key}`);
  console.log(`[FORTUNE_API]   Sample day: ${sampleDay.date}, overall=${sampleDay.scores.overall}`);
  console.log(`[FORTUNE_API]   persisted._v=${sampleDay.persisted?._v}, topStates count=${sampleDay.persisted?.topStates.length ?? 0}`);
  if (sampleDay.persisted?.topStates && sampleDay.persisted.topStates.length > 0) {
    console.log(`[FORTUNE_API]   Sample topStates:`, sampleDay.persisted.topStates.slice(0, 3).map(s => s.key));
  }

  saveCache(key, result);

  const normalized = applyDisplayNorm(result);
  await saveWidgetMonthlyData(normalized);

  const todayStr = getTodayLocalString();
  const todayFortune = normalized.daily_fortunes.find(d => d.date === todayStr);

  if (todayFortune) {
    await saveWidgetData(todayFortune);
  } else {
    await refreshWidget();
  }

  return normalized;
}

export function getUser(): SajuUser | null {
  try {
    const raw = localStorage.getItem("saju_user");
    if (!raw) return null;
    const user = JSON.parse(raw);
    // 구버전 데이터 마이그레이션 — gender 없으면 기본값 남성
    if (!user.gender) user.gender = "M";
    return user as SajuUser;
  } catch {
    return null;
  }
}

export function saveUser(user: SajuUser): void {
  localStorage.setItem("saju_user", JSON.stringify(user));
}

export async function getProfileInsight(user: SajuUser): Promise<ProfileInsight> {
  const cacheKey = "saju_profile_v2";
  try {
    const raw = localStorage.getItem(cacheKey);
    if (raw) return JSON.parse(raw) as ProfileInsight;
  } catch { /* ignore */ }

  const insight = await buildProfileInsight(user);
  try {
    localStorage.setItem(cacheKey, JSON.stringify(insight));
  } catch { /* ignore */ }
  return insight;
}

// ──────────────────────────────────────────────
// Ziwei 구조 실험 비교
// ──────────────────────────────────────────────

import {
  DEFAULT_ZIWEI_FLAGS, EXPERIMENT_ZIWEI_FLAGS,
  EXPERIMENT_ZIWEI_FLAGS_0, EXPERIMENT_ZIWEI_FLAGS_01,
  type ZiweiExperimentFlags,
} from "../engines/ziweiEngine";

export interface ZiweiExpStats {
  overall: { avg: number; min: number; max: number; stddev: number };
  categories: Record<string, { avg: number; stddev: number }>;
  /** topEvents 중 ziwei.* 비율 (%) */
  ziweiRatio: number;
  /** canonical key → 출현 횟수, 상위 20개 */
  topLabels: [string, number][];
}

export interface ZiweiExperimentReport {
  days: number;
  months: string[];
  /** DEFAULT: 현행 설정 */
  DEFAULT:    ZiweiExpStats;
  /** EXP_0: 일 활성궁만 (monthly weight=0) */
  EXP_0:      ZiweiExpStats;
  /** EXP_01: 일 활성궁 + monthly weight=0.1 */
  EXP_01:     ZiweiExpStats;
  /** EXP_02: 일 활성궁 + monthly weight=0.2 */
  EXP_02:     ZiweiExpStats;
}

export async function runZiweiExperiment(
  user: SajuUser,
  anchorYear: number,
  anchorMonth: number,
): Promise<ZiweiExperimentReport> {
  const isMale = user.gender === "M";

  const normalizedBirth = normalizeBirthDateTimeByRegion({
    year:     user.birth_year,
    month:    user.birth_month,
    day:      user.birth_day,
    hour:     user.birth_hour   ?? 12,
    minute:   user.birth_minute ?? 0,
    regionId: user.birth_region ?? "seoul",
  });

  const sajuProfile = calculateSajuProfile(
    normalizedBirth.year, normalizedBirth.month, normalizedBirth.day,
    normalizedBirth.hour, user.gender, user.injong_rules, normalizedBirth.minute,
  );
  const ziweiProfile = buildZiweiProfile(
    normalizedBirth.year, normalizedBirth.month, normalizedBirth.day,
    normalizedBirth.hour, anchorYear, isMale,
  );
  const astroProfile = await buildAstroProfile(
    normalizedBirth.year, normalizedBirth.month, normalizedBirth.day,
    normalizedBirth.hour, undefined, undefined, normalizedBirth.minute,
  );

  const birthDate = new Date(user.birth_year, user.birth_month - 1, user.birth_day);

  // 앵커 월 기준 ±1개월 (3개월 창)
  const monthWindow: { year: number; month: number }[] = [];
  for (let offset = -1; offset <= 1; offset++) {
    let m = anchorMonth + offset;
    let y = anchorYear;
    if (m < 1)  { m += 12; y--; }
    if (m > 12) { m -= 12; y++; }
    monthWindow.push({ year: y, month: m });
  }

  function runMonths(flags: ZiweiExperimentFlags): DailyFortune[] {
    const agg = new FortuneAggregator(sajuProfile, ziweiProfile, astroProfile, undefined, birthDate, true);
    const all: DailyFortune[] = [];
    for (const { year, month } of monthWindow) {
      all.push(...agg.getMonthlyFortune(year, month, flags).daily_fortunes);
    }
    return all;
  }

  const CAT_KEYS = ["wealth", "love", "health", "career", "relations", "study"] as const;

  function buildStats(days: DailyFortune[]): ZiweiExpStats {
    const overallVals = days.map(d => d.scores.overall);
    const n = overallVals.length;
    const oAvg = overallVals.reduce((a, b) => a + b, 0) / n;
    const oVar = overallVals.reduce((a, v) => a + (v - oAvg) ** 2, 0) / n;

    const categories: Record<string, { avg: number; stddev: number }> = {};
    for (const cat of CAT_KEYS) {
      const vals = days.map(d => d.scores[cat]);
      const avg  = vals.reduce((a, b) => a + b, 0) / n;
      const vari = vals.reduce((a, v) => a + (v - avg) ** 2, 0) / n;
      categories[cat] = { avg: r1(avg), stddev: r1(Math.sqrt(vari)) };
    }

    let total = 0, ziweiCnt = 0;
    const labelMap: Record<string, number> = {};
    for (const day of days) {
      for (const ev of day.persisted?.topEvents ?? []) {
        total++;
        if (ev.key.startsWith("ziwei.")) ziweiCnt++;
        labelMap[ev.key] = (labelMap[ev.key] ?? 0) + 1;
      }
    }

    const topLabels = Object.entries(labelMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20) as [string, number][];

    return {
      overall:   { avg: r1(oAvg), min: Math.min(...overallVals), max: Math.max(...overallVals), stddev: r1(Math.sqrt(oVar)) },
      categories,
      ziweiRatio: total > 0 ? r1(ziweiCnt / total * 100) : 0,
      topLabels,
    };
  }

  const [defaultDays, exp0Days, exp01Days, exp02Days] = [
    runMonths(DEFAULT_ZIWEI_FLAGS),
    runMonths(EXPERIMENT_ZIWEI_FLAGS_0),
    runMonths(EXPERIMENT_ZIWEI_FLAGS_01),
    runMonths(EXPERIMENT_ZIWEI_FLAGS),
  ];

  return {
    days:    defaultDays.length,
    months:  monthWindow.map(m => `${m.year}-${String(m.month).padStart(2, "0")}`),
    DEFAULT: buildStats(defaultDays),
    EXP_0:   buildStats(exp0Days),
    EXP_01:  buildStats(exp01Days),
    EXP_02:  buildStats(exp02Days),
  };
}

function r1(v: number) { return Math.round(v * 10) / 10; }

export function clearUser(): void {
  localStorage.removeItem("saju_user");
  localStorage.removeItem("saju_cache");
  localStorage.removeItem("saju_profile_v1");
  localStorage.removeItem("saju_profile_v2");
}