import { LocalNotifications } from "@capacitor/local-notifications";
import { Preferences } from "@capacitor/preferences";
import type { DailyFortune } from "../engines/aggregator";

const PREF_KEY_PREFIX = "fortune_notification_";

const HINT_TITLES: Record<string, string> = {
  best_window:    "좋은 흐름이 시작돼요",
  caution_window: "조금 조심하면 좋은 시간이에요",
};

/** 알림 권한 요청 — 앱 시작 시 1회 호출 */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const { display } = await LocalNotifications.requestPermissions();
    return display === "granted";
  } catch {
    return false;
  }
}

/** 날짜 문자열(YYYY-MM-DD) 기준으로 예약된 알림 id 목록을 저장/로드 */
async function loadScheduledIds(dateKey: string): Promise<number[]> {
  const { value } = await Preferences.get({ key: PREF_KEY_PREFIX + dateKey });
  if (!value) return [];
  try { return JSON.parse(value) as number[]; } catch { return []; }
}

async function saveScheduledIds(dateKey: string, ids: number[]): Promise<void> {
  await Preferences.set({ key: PREF_KEY_PREFIX + dateKey, value: JSON.stringify(ids) });
}

const DEFAULT_START = 7;
const DEFAULT_END   = 22;

export async function getNotificationAllowedStartHour(): Promise<number> {
  const { value } = await Preferences.get({ key: "notification_allowed_start_hour" });
  const n = value !== null ? parseInt(value) : NaN;
  return isNaN(n) ? DEFAULT_START : n;
}

export async function getNotificationAllowedEndHour(): Promise<number> {
  const { value } = await Preferences.get({ key: "notification_allowed_end_hour" });
  const n = value !== null ? parseInt(value) : NaN;
  return isNaN(n) ? DEFAULT_END : n;
}

export async function setNotificationAllowedHours(start: number, end: number): Promise<void> {
  await Preferences.set({ key: "notification_allowed_start_hour", value: String(start) });
  await Preferences.set({ key: "notification_allowed_end_hour",   value: String(end)   });
}

/**
 * 오늘의 운세에서 best_window / caution_window 힌트를 로컬 알림으로 예약.
 * - 이미 지난 시각은 스킵
 * - 같은 날 중복 예약 방지
 * - 최대 2개
 */
export async function scheduleDailyFortuneNotifications(
  fortune: DailyFortune,
  date: string,
): Promise<void> {
  try {
    const hints = fortune.notificationHints;
    if (!hints || hints.length === 0) return;

    const now = new Date();
    const existingIds = await loadScheduledIds(date);

    // 이미 이 날짜에 예약 완료된 경우 스킵
    if (existingIds.length >= 2) return;

    const targets = hints.filter(h =>
      h.type === "best_window" || h.type === "caution_window"
    ).slice(0, 2);

    const newIds: number[] = [];
    let bestWindowHour: number | null = null;

    for (const hint of targets) {
      // caution_window 추가 필터
      if (hint.type === "caution_window") {
        // score >= 50 이면 스킵
        if (hint.score >= 50) continue;
        // quiet hours: 0~5시 스킵
        if (hint.hour >= 0 && hint.hour <= 5) continue;
        // best_window 와 2시간 이내면 스킵
        if (bestWindowHour !== null && Math.abs(hint.hour - bestWindowHour) < 2) continue;
      }

      // 예약 시각 구성
      const [y, m, d] = date.split("-").map(Number);
      const minute = hint.type === "best_window" ? -10 : 0;
      const scheduleAt = new Date(y, m - 1, d, hint.hour, minute, 0, 0);

      // 허용 시간대 적용
      let startHour = await getNotificationAllowedStartHour();
      let endHour   = await getNotificationAllowedEndHour();
      if (startHour > endHour) { startHour = DEFAULT_START; endHour = DEFAULT_END; }
      const scheduledHour = scheduleAt.getHours();
      if (scheduledHour < startHour) { scheduleAt.setHours(startHour, 0, 0, 0); }
      if (scheduleAt.getHours() > endHour) continue;

      // 이미 지난 시각이면 스킵
      if (scheduleAt <= now) continue;

      // 간단한 결정적 id: 날짜 + 시각 기반
      const id = parseInt(date.replace(/-/g, "")) * 100 + hint.hour;

      // 이미 같은 id가 예약되어 있으면 스킵
      if (existingIds.includes(id)) continue;

      if (hint.type === "best_window") bestWindowHour = hint.hour;

      console.log("[NOTI_SCHEDULE]", hint.type, "hintHour:", hint.hour, "scheduledAt:", scheduleAt.toString());
      await LocalNotifications.schedule({
        notifications: [{
          id,
          title: HINT_TITLES[hint.type] ?? "운세 알림",
          body:  hint.label,
          schedule: { at: scheduleAt },
          smallIcon: "ic_stat_icon_config_sample",
          iconColor: "#c9a84c",
        }],
      });

      newIds.push(id);
    }

    if (newIds.length > 0) {
      console.log("[NOTI_SCHEDULE] newly scheduled ids:", newIds);
      await saveScheduledIds(date, [...existingIds, ...newIds]);
    }
  } catch {
    // 알림 실패는 앱 동작에 영향 없음
  }
}

/** 특정 날짜에 예약된 운세 알림 전체 취소 */
export async function clearDailyFortuneNotifications(date: string): Promise<void> {
  try {
    const ids = await loadScheduledIds(date);
    if (ids.length === 0) return;
    console.log("[NOTI_CLEAR] canceling ids:", ids);
    await LocalNotifications.cancel({ notifications: ids.map(id => ({ id })) });
    await saveScheduledIds(date, []);
  } catch {
    // 무시
  }
}
