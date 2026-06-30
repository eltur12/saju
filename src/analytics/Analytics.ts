import { Capacitor } from '@capacitor/core';
import { FirebaseAnalytics } from '@capacitor-firebase/analytics';
import { FirebaseCrashlytics } from '@capacitor-firebase/crashlytics';
import type { AnalyticsEventName } from './events';

export async function logEvent(
  name: AnalyticsEventName,
  params?: Record<string, string | number | boolean>,
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await FirebaseAnalytics.logEvent({ name, params });
  } catch (e) {
    console.warn('[Analytics] logEvent 실패:', name, e);
  }
}

export async function recordException(message: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await FirebaseCrashlytics.recordException({ message });
  } catch (e) {
    console.warn('[Crashlytics] recordException 실패:', e);
  }
}

// 테스트 크래시 — 확인 후 주석 처리
// export async function testCrash(): Promise<void> {
//   if (!Capacitor.isNativePlatform()) return;
//   await FirebaseCrashlytics.crash({ message: 'Test crash from JS' });
// }
