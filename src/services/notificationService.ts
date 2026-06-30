import { LocalNotifications } from "@capacitor/local-notifications";
import { Preferences } from "@capacitor/preferences";
import { refreshWidget } from "../plugins/widgetPlugin";
import { saveWidgetData } from "../api/fortuneApi";
import type { DailyFortune, MonthlyFortuneResult } from "../engines/aggregator";
import {
  planNotifications,
  applyNotificationSettings,
  generateNotificationMessage,
  type NotificationSettings,
  type NotificationType,
} from "../engines/notificationPlanner";

export type { NotificationSettings };

const PREF_KEY_PREFIX    = "fortune_notification_";
const PREF_KEY_SETTINGS  = "notification_settings_v2";
const READY_KEY_PREFIX   = "fortune_notifications_ready_";
const READY_VERSION      = 1;

/**
 * When false, JS will NOT call LocalNotifications.schedule().
 * Native AlarmManager (NativeNotificationScheduler.kt) handles OS scheduling.
 * JS still generates and persists fortune_notifications_ready_* data.
 * Set to true to re-enable JS scheduling (e.g. for iOS or debugging).
 */
const ENABLE_JS_LOCAL_NOTIFICATIONS = false;

const DEFAULT_SETTINGS: NotificationSettings = {
  dailyEnabled:      true,
  eventStateEnabled: true,
  dailyTime:         "07:00",
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

// ── Notification-ready persistence (for native Android scheduler) ────────────

export interface NotificationReadyEntry {
  id: number;
  date: string;
  type: NotificationType;
  triggerAt: string;  // "YYYY-MM-DDTHH:MM:SS" local time — no timezone suffix
  title: string;
  body: string;
  version: number;
}

const READY_TYPE_INDEX: Record<NotificationType, number> = {
  DAILY: 1,
  EVENT: 2,
  STATE: 3,
};

/**
 * Stable, collision-free ID for native-ready notification entries.
 * Formula: dateNum * 10000 + hour * 100 + typeIndex * 10 + sequence
 * Example: 2026-04-27 DAILY 07:00 seq=0 → 202604270710
 *          2026-04-27 FLOW  07:00 seq=0 → 202604270720
 *          2026-04-27 FLOW  07:00 seq=1 → 202604270721
 * Separate from JS LocalNotifications IDs (dateNum * 100 + hour) — not mixed.
 */
export function buildReadyNotificationId(
  date: string,
  triggerAt: string,
  type: NotificationType,
  sequence: number,
): number {
  const dateNum   = parseInt(date.replace(/-/g, ""));
  const hour      = parseInt(triggerAt.slice(11, 13));
  const typeIndex = READY_TYPE_INDEX[type] ?? 0;
  return dateNum * 10000 + hour * 100 + typeIndex * 10 + sequence;
}

/** Build ready entries for one day. Reuses existing planner + message logic exactly. */
export function buildNotificationReadyEntries(
  date: string,
  fortune: DailyFortune,
  settings: NotificationSettings,
): NotificationReadyEntry[] {
  const planned  = planNotifications(fortune, date);
  const filtered = applyNotificationSettings(planned, settings, date);

  // Track sequence per (hour, type) to resolve same-slot collisions
  const seqMap = new Map<string, number>();

  return filtered.map(n => {
    const { title, body } = generateNotificationMessage(n, date);
    const at        = n.triggerTime;
    const triggerAt = `${date}T${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}:00`;

    const slotKey = `${at.getHours()}_${n.type}`;
    const seq     = seqMap.get(slotKey) ?? 0;
    seqMap.set(slotKey, seq + 1);

    const id = buildReadyNotificationId(date, triggerAt, n.type, seq);
    return { id, date, type: n.type, triggerAt, title, body, version: READY_VERSION };
  });
}

async function saveNotificationReadyData(date: string, entries: NotificationReadyEntry[]): Promise<void> {
  await Preferences.set({ key: READY_KEY_PREFIX + date, value: JSON.stringify(entries) });
  console.log("[NOTI_READY]", date, entries.map(e => `${e.type}@${e.triggerAt} id=${e.id}`));
}

/** Save notification-ready data for every day in a month. Called after monthly fortune load. */
export async function saveMonthlyNotificationReadyData(
  result: MonthlyFortuneResult,
  settings: NotificationSettings,
): Promise<void> {
  await Promise.all(
    result.daily_fortunes.map(fortune =>
      saveNotificationReadyData(
        fortune.date,
        buildNotificationReadyEntries(fortune.date, fortune, settings),
      )
    )
  );
}

/**
 * Return the set of scheduled hours for a date, read from the native-ready store.
 * Used by the UI clock emoji — works regardless of whether JS or native scheduling is active.
 */
export async function loadNotificationReadyHours(dateKey: string): Promise<Set<number>> {
  try {
    const { value } = await Preferences.get({ key: READY_KEY_PREFIX + dateKey });
    if (!value) return new Set();
    const entries = JSON.parse(value) as NotificationReadyEntry[];
    return new Set(entries.map(e => parseInt(e.triggerAt.slice(11, 13))));
  } catch {
    return new Set();
  }
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * 오늘의 운세를 플래너로 분석해 로컬 알림으로 예약.
 * - planner → settings filter → message generation → schedule
 * - 같은 날 중복 예약 방지
 */
export async function scheduleDailyFortuneNotifications(
  fortune: DailyFortune,
  date: string,
): Promise<void> {
  if (!ENABLE_JS_LOCAL_NOTIFICATIONS) {
    console.log("[NOTI_SCHEDULE] JS LocalNotifications disabled — native AlarmManager handles scheduling");
    return;
  }
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

      const { title, body } = generateNotificationMessage(n, date);
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
      const { title, body } = generateNotificationMessage(n, date);
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

export async function cleanupOldNotificationReadyData(currentYear: number, currentMonth: number) {
  try {
    const { keys } = await Preferences.keys();
    const prefix = "fortune_notifications_ready_";

    // 이번 달
    const currentMonthStr = `${currentYear}-${String(currentMonth).padStart(2, "0")}`;

    // 다음 달 계산
    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
    const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;
    const nextMonthStr = `${nextYear}-${String(nextMonth).padStart(2, "0")}`;

    const deleteTargets = keys.filter(k => {
      if (!k.startsWith(prefix)) return false;

      // key: fortune_notifications_ready_2026-04-27
      // → YYYY-MM만 추출
      const datePart = k.replace(prefix, "").slice(0, 7);

      return datePart !== currentMonthStr && datePart !== nextMonthStr;
    });

    if (deleteTargets.length === 0) return;

    await Promise.all(
        deleteTargets.map(k => Preferences.remove({ key: k }))
    );

    console.log("[NOTI_CLEANUP] removed keys:", deleteTargets);
  } catch (e) {
    console.warn("[NOTI_CLEANUP] failed", e);
  }
}
