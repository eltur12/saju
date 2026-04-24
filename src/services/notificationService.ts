import { LocalNotifications } from "@capacitor/local-notifications";
import { Preferences } from "@capacitor/preferences";
import { refreshWidget } from "../plugins/widgetPlugin";
import { saveWidgetData } from "../api/fortuneApi";
import type { DailyFortune } from "../engines/aggregator";
import {
  planNotifications,
  applyNotificationSettings,
  generateNotificationMessage,
  type NotificationSettings,
} from "../engines/notificationPlanner";

export type { NotificationSettings };

const PREF_KEY_PREFIX    = "fortune_notification_";
const PREF_KEY_SETTINGS  = "notification_settings_v2";

const DEFAULT_SETTINGS: NotificationSettings = {
  dailyEnabled: true,
  flowEnabled:  true,
  lowEnabled:   true,
  allowNight:   false,
  dailyTime:    "07:00",
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

export async function loadNotificationSettings(): Promise<NotificationSettings> {
  try {
    const { value } = await Preferences.get({ key: PREF_KEY_SETTINGS });
    if (value) return { ...DEFAULT_SETTINGS, ...JSON.parse(value) } as NotificationSettings;
  } catch { /* fallthrough */ }
  return { ...DEFAULT_SETTINGS };
}

export async function saveNotificationSettings(settings: NotificationSettings): Promise<void> {
  await Preferences.set({ key: PREF_KEY_SETTINGS, value: JSON.stringify(settings) });
}

/** 날짜 문자열(YYYY-MM-DD) 기준으로 예약된 알림 id 목록을 저장/로드 */
export async function loadScheduledIds(dateKey: string): Promise<number[]> {
  const { value } = await Preferences.get({ key: PREF_KEY_PREFIX + dateKey });
  if (!value) return [];
  try { return JSON.parse(value) as number[]; } catch { return []; }
}

async function saveScheduledIds(dateKey: string, ids: number[]): Promise<void> {
  await Preferences.set({ key: PREF_KEY_PREFIX + dateKey, value: JSON.stringify(ids) });
}

/**
 * 오늘의 운세를 플래너로 분석해 로컬 알림으로 예약.
 * - planner → settings filter → message generation → schedule
 * - 같은 날 중복 예약 방지
 */
export async function scheduleDailyFortuneNotifications(
  fortune: DailyFortune,
  date: string,
): Promise<void> {
  try {
    const existingIds = await loadScheduledIds(date);
    if (existingIds.length > 0) return;

    const settings  = await loadNotificationSettings();
    const planned   = planNotifications(fortune, date);
    const filtered  = applyNotificationSettings(planned, settings, date);
    if (filtered.length === 0) return;

    const now    = new Date();
    const dateNum = parseInt(date.replace(/-/g, ""));
    const newIds: number[] = [];

    for (const n of filtered) {
      const scheduleAt = n.triggerTime;
      if (scheduleAt <= now) continue;

      const id = dateNum * 100 + scheduleAt.getHours();
      if (existingIds.includes(id)) continue;

      const { title, body } = generateNotificationMessage(n, "L1");
      console.log("[NOTI_SCHEDULE]", n.type, "at", scheduleAt.toString(), "—", title);

      await LocalNotifications.schedule({
        notifications: [{
          id,
          title,
          body,
          schedule: { at: scheduleAt },
          smallIcon: "ic_notification_small",
          iconColor: "#3aab8c",
        }],
      });

      newIds.push(id);
    }

    if (newIds.length > 0) {
      console.log("[NOTI_SCHEDULE] newly scheduled ids:", newIds);
      await saveScheduledIds(date, [...existingIds, ...newIds]);
      refreshWidget(); // 알림 예약 완료 후 위젯 동기화
    }
  } catch {
    // 알림 실패는 앱 동작에 영향 없음
  }
}

/** 자정 도래 시 위젯 데이터 + 알림을 한 번에 갱신 */
export async function handleDayRollover(fortune: DailyFortune, dateStr: string): Promise<void> {
  await saveWidgetData(fortune);
  await clearDailyFortuneNotifications(dateStr);
  await scheduleDailyFortuneNotifications(fortune, dateStr);
}

const DEBUG_NOTI_ID_BASE = 990001;

/** 디버그 전용: 오늘의 플래너 알림을 즉시 (~1분 후) 실제 로컬 알림으로 전송 */
export async function sendDebugTestNotificationsForToday(
  fortune: DailyFortune,
  date: string,
): Promise<void> {
  try {
    const { display } = await LocalNotifications.requestPermissions();
    if (display !== "granted") return;

    const settings = await loadNotificationSettings();
    const planned  = planNotifications(fortune, date);
    const filtered = applyNotificationSettings(planned, settings, date);
    if (filtered.length === 0) {
      console.log("[DEBUG_NOTI] no planned notifications for today");
      return;
    }

    await LocalNotifications.cancel({
      notifications: [0, 1, 2].map(i => ({ id: DEBUG_NOTI_ID_BASE + i })),
    });

    const offsets = [5, 10, 15]; // seconds from now (debug only)
    const notifications = filtered.slice(0, 3).map((n, i) => {
      const { title, body } = generateNotificationMessage(n, "L1");
      const scheduleAt = new Date(Date.now() + offsets[i] * 1000);
      console.log(`[DEBUG_NOTI] #${i} ${n.type} at ${scheduleAt.toISOString()} — ${title}`);
      return {
        id: DEBUG_NOTI_ID_BASE + i,
        title,
        body,
        schedule: { at: scheduleAt },
        smallIcon: "ic_notification_small",
        iconColor: "#3aab8c",
      };
    });

    await LocalNotifications.schedule({ notifications });
  } catch (e) {
    console.warn("[DEBUG_NOTI] failed", e);
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
