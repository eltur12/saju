package com.saju.fortune;

import android.appwidget.AppWidgetManager;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/**
 * AlarmManager 기반 자정 트리거 리시버.
 * ACTION_DATE_CHANGED 브로드캐스트가 OEM 배터리 최적화로 차단되는 경우를 대비해
 * NativeNotificationScheduler.scheduleMidnightRefresh()가 자정 직후(+3초)에 이 리시버를 깨운다.
 *
 * 처리 순서:
 *   1. 위젯 날짜를 오늘로 리셋 + 위젯 갱신
 *   2. 오늘 알림 재스케줄 (fortune_notifications_ready_* 데이터 기반)
 *   3. 다음 자정 알람 예약 (체인 유지)
 *   4. 앱이 포그라운드에 있을 경우 JS dayRollover 이벤트를 위한 커스텀 브로드캐스트 발송
 */
public class MidnightRefreshReceiver extends BroadcastReceiver {

    private static final String TAG = "MidnightRefreshReceiver";

    /** WidgetPlugin.dateChangeReceiver가 수신하는 커스텀 액션 */
    static final String ACTION_MIDNIGHT = "com.saju.fortune.MIDNIGHT_REFRESH";

    @Override
    public void onReceive(Context context, Intent intent) {
        Log.d(TAG, "onReceive: midnight refresh triggered");

        // 1. 위젯 날짜를 오늘로 리셋
        FortuneWidget.resetToCurrentMonth(context);
        AppWidgetManager mgr = AppWidgetManager.getInstance(context);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(context, FortuneWidget.class));
        for (int id : ids) {
            FortuneWidget.updateWidget(context, mgr, id);
        }
        Log.d(TAG, "widget reset to today, " + ids.length + " widget(s) updated");

        // 2. 오늘 알림 재스케줄 (새 날짜 데이터가 있으면 적용)
        NativeNotificationScheduler.scheduleToday(context);

        // 3. 다음 자정 알람 재예약 (체인)
        NativeNotificationScheduler.scheduleMidnightRefresh(context);

        // 4. 앱이 포그라운드에 있을 경우 JS dayRollover 이벤트 트리거
        //    WidgetPlugin.dateChangeReceiver가 등록되어 있으면 수신 → notifyListeners("dayRollover")
        Intent rollover = new Intent(ACTION_MIDNIGHT);
        rollover.setPackage(context.getPackageName());
        context.sendBroadcast(rollover);
    }
}
