import { Capacitor, registerPlugin } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";

type WidgetPlugin = {
  refresh: () => Promise<void>;
  scheduleTodayNotifications: () => Promise<void>;
  canScheduleExactAlarms: () => Promise<{ canScheduleExactAlarms: boolean }>;
  openExactAlarmSettings: () => Promise<void>;
  getNotificationRegistrationStatus: (options: {
    entries: Array<{ id: number }>;
  }) => Promise<{ statuses: Array<{ id: number; registered: boolean }> }>;

  addListener: (
      eventName: string,
      listenerFunc: () => void
  ) => Promise<PluginListenerHandle>;
};

const Widget = registerPlugin<WidgetPlugin>("Widget");

// 위젯 갱신
export async function refreshWidget(): Promise<void> {
  try {
    await Widget.refresh();
  } catch {
    // 웹 환경에서는 무시
  }
}

// Native 알림 스케줄링
export async function scheduleTodayNotifications(): Promise<void> {
  try {
    await Widget.scheduleTodayNotifications();
    console.log("[NOTI_NATIVE] scheduleTodayNotifications called successfully");
  } catch (e) {
    console.warn("[NOTI_NATIVE] scheduleTodayNotifications failed", e);
  }
}

// 자정 롤오버 리스너
export function addDayRolloverListener(
  cb: () => void
): Promise<PluginListenerHandle> {
  return Widget.addListener("dayRollover", cb);
}

// exact alarm 권한 체크
export async function canScheduleExactAlarms(): Promise<boolean> {
  try {
    if (Capacitor.getPlatform() !== "android") return true;

    const result = await Widget.canScheduleExactAlarms();
    return !!result.canScheduleExactAlarms;
  } catch (e) {
    console.warn("[NOTI_NATIVE] canScheduleExactAlarms failed", e);
    return true;
  }
}

// debug-only: check which ready-entry IDs have live PendingIntents in AlarmManager
export async function getNotificationRegistrationStatus(
  entries: Array<{ id: number }>,
): Promise<Map<number, boolean>> {
  if (Capacitor.getPlatform() !== "android" || entries.length === 0) return new Map();
  try {
    const { statuses } = await Widget.getNotificationRegistrationStatus({ entries });
    const map = new Map<number, boolean>();
    for (const s of statuses) map.set(s.id, s.registered);
    return map;
  } catch {
    return new Map();
  }
}

// exact alarm 설정 화면 이동
export async function openExactAlarmSettings(): Promise<void> {
  try {
    if (Capacitor.getPlatform() !== "android") return;

    await Widget.openExactAlarmSettings();
  } catch (e) {
    console.warn("[NOTI_NATIVE] openExactAlarmSettings failed", e);
  }
}

