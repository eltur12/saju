/**
 * 캐시 관리 + 엔진 호출 통합
 */
import { FortuneAggregator, type MonthlyFortuneResult, type DailyFortune } from "../engines/aggregator";
import { calculateSajuProfile } from "../utils/sajuCalculator";
import { buildZiweiProfile } from "../utils/ziweiCalculator";
import { buildAstroProfile } from "../utils/astroCalculator";
import { refreshWidget } from "../plugins/widgetPlugin";
import { buildProfileInsight, type ProfileInsight } from "../engines/profileInsightLayer";

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

/** 캐시 스키마 버전 — 필드 변경 시 올리면 캐시 무효화 */
const CACHE_VERSION = "v7";

export interface SajuUser {
  birth_year: number;
  birth_month: number;
  birth_day: number;
  birth_hour?: number;
  birth_minute?: number;
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

function saveCache(key: string, data: MonthlyFortuneResult): void {
  const cache = loadCache();
  cache[key] = data;
  localStorage.setItem("saju_cache", JSON.stringify(cache));
}

function getTodayLocalString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function getMonthlyFortune(
    user: SajuUser,
    year: number,
    month: number,
): Promise<MonthlyFortuneResult> {
  const key = getCacheKey(year, month);
  const cache = loadCache();

  if (cache[key]) {
    await saveWidgetMonthlyData(cache[key]);

    const todayStr = getTodayLocalString();
    const todayFortune = cache[key].daily_fortunes.find(d => d.date === todayStr);

    if (todayFortune) {
      await saveWidgetData(todayFortune);
    } else {
      await refreshWidget();
    }

    return cache[key];
  }

  const hour = user.birth_hour ?? 12;
  const isMale = user.gender === "M";

  // 사주 (동기) — 성별 반영 (대운 순역방향)
  const sajuProfile = calculateSajuProfile(
      user.birth_year, user.birth_month, user.birth_day, hour, user.gender,
      user.injong_rules,
  );

  // 자미두수 (동기) — 성별 반영
  const ziweiProfile = buildZiweiProfile(
      user.birth_year, user.birth_month, user.birth_day, hour, year, isMale,
  );

  // 서양 점성술 (비동기 — Moshier 에페메리스)
  const astroProfile = await buildAstroProfile(
      user.birth_year, user.birth_month, user.birth_day, user.birth_hour,
      undefined, undefined, user.birth_minute,
  );

  const birthDate = new Date(user.birth_year, user.birth_month - 1, user.birth_day);
  const aggregator = new FortuneAggregator(
      sajuProfile, ziweiProfile, astroProfile, undefined, birthDate, true,
  );

  const result = aggregator.getMonthlyFortune(year, month);
  saveCache(key, result);

  await saveWidgetMonthlyData(result);

  const todayStr = getTodayLocalString();
  const todayFortune = result.daily_fortunes.find(d => d.date === todayStr);

  if (todayFortune) {
    await saveWidgetData(todayFortune);
  } else {
    await refreshWidget();
  }

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

export function clearUser(): void {
  localStorage.removeItem("saju_user");
  localStorage.removeItem("saju_cache");
  localStorage.removeItem("saju_profile_v1");
  localStorage.removeItem("saju_profile_v2");
}