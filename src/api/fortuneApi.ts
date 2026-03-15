/**
 * 캐시 관리 + 엔진 호출 통합
 */
import { FortuneAggregator, type MonthlyFortuneResult, type DailyFortune } from "../engines/aggregator";
import { calculateSajuProfile } from "../utils/sajuCalculator";
import { buildZiweiProfile } from "../utils/ziweiCalculator";
import { buildAstroProfile } from "../utils/astroCalculator";

/** Capacitor Preferences — 네이티브 환경에서만 동작, 웹에서는 no-op */
async function setPreference(key: string, value: string): Promise<void> {
  try {
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.set({ key, value });
  } catch {
    // 웹 브라우저 환경에서는 무시
  }
}

/** 위젯에서 읽을 오늘의 운세를 SharedPreferences에 저장 */
export async function saveWidgetData(fortune: DailyFortune): Promise<void> {
  await setPreference("widget_data", JSON.stringify({
    score:   fortune.scores.overall,
    badge:   fortune.badge,
    summary: fortune.summary,
    date:    fortune.date,
    wealth:  fortune.scores.wealth,
    love:    fortune.scores.love,
    health:  fortune.scores.health,
    career:  fortune.scores.career,
  }));
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
    })),
  };
  await setPreference(key, JSON.stringify(payload));
}

/** 캐시 스키마 버전 — 필드 변경 시 올리면 캐시 무효화 */
const CACHE_VERSION = "v4";

export interface SajuUser {
  birth_year: number;
  birth_month: number;
  birth_day: number;
  birth_hour?: number;
  gender: "M" | "F";
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

function saveCache(key: string, data: MonthlyFortuneResult): void {
  const cache = loadCache();
  cache[key] = data;
  localStorage.setItem("saju_cache", JSON.stringify(cache));
}

export async function getMonthlyFortune(
  user: SajuUser,
  year: number,
  month: number,
): Promise<MonthlyFortuneResult> {
  const key = getCacheKey(year, month);
  const cache = loadCache();
  if (cache[key]) {
    saveWidgetMonthlyData(cache[key]);
    return cache[key];
  }

  const hour = user.birth_hour ?? 12;
  const isMale = user.gender === "M";

  // 사주 (동기)
  const sajuProfile = calculateSajuProfile(
    user.birth_year, user.birth_month, user.birth_day, hour,
  );

  // 자미두수 (동기) — 성별 반영
  const ziweiProfile = buildZiweiProfile(
    user.birth_year, user.birth_month, user.birth_day, hour, year, isMale,
  );

  // 서양 점성술 (비동기 — Moshier 에페메리스)
  const astroProfile = await buildAstroProfile(
    user.birth_year, user.birth_month, user.birth_day, user.birth_hour,
  );

  const birthDate = new Date(user.birth_year, user.birth_month - 1, user.birth_day);
  const aggregator = new FortuneAggregator(
    sajuProfile, ziweiProfile, astroProfile, undefined, birthDate,
  );

  const result = aggregator.getMonthlyFortune(year, month);
  saveCache(key, result);
  saveWidgetMonthlyData(result); // 달력 위젯용 월간 데이터 저장
  return result;
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

export function clearUser(): void {
  localStorage.removeItem("saju_user");
  localStorage.removeItem("saju_cache");
}
