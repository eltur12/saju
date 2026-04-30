package com.saju.fortune;

import android.appwidget.AppWidgetManager;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.os.Build;
import android.provider.Settings;
import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import org.json.JSONObject;

@CapacitorPlugin(name = "Widget")
public class WidgetPlugin extends Plugin {

    private BroadcastReceiver dateChangeReceiver;

    @Override
    protected void handleOnStart() {
        dateChangeReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context ctx, Intent intent) {
                notifyListeners("dayRollover", new JSObject());
            }
        };
        IntentFilter filter = new IntentFilter(Intent.ACTION_DATE_CHANGED);
        filter.addAction(MidnightRefreshReceiver.ACTION_MIDNIGHT);
        getContext().registerReceiver(dateChangeReceiver, filter);
    }

    @Override
    protected void handleOnStop() {
        if (dateChangeReceiver != null) {
            try { getContext().unregisterReceiver(dateChangeReceiver); } catch (Exception ignored) {}
            dateChangeReceiver = null;
        }
    }

    @PluginMethod
    public void scheduleTodayNotifications(PluginCall call) {
        NativeNotificationScheduler.scheduleToday(getContext());
        call.resolve();
    }

    @PluginMethod
    public void refresh(PluginCall call) {
        Context context = getContext();

        // 위젯이 과거 날짜/월을 표시 중이면 오늘로 스냅 (자정 이후 갱신 시 타이밍 경쟁 방지)
        java.util.Calendar now = java.util.Calendar.getInstance();
        android.content.SharedPreferences wp =
            context.getSharedPreferences(FortuneWidget.WIDGET_PREFS, Context.MODE_PRIVATE);
        int dy = wp.getInt("display_year",  now.get(java.util.Calendar.YEAR));
        int dm = wp.getInt("display_month", now.get(java.util.Calendar.MONTH) + 1);
        int dd = wp.getInt("selected_day",  now.get(java.util.Calendar.DAY_OF_MONTH));
        int ny = now.get(java.util.Calendar.YEAR);
        int nm = now.get(java.util.Calendar.MONTH) + 1;
        int nd = now.get(java.util.Calendar.DAY_OF_MONTH);
        boolean pastMonth = dy < ny || (dy == ny && dm < nm);
        boolean pastDayThisMonth = (dy == ny && dm == nm && dd < nd);
        if (pastMonth || pastDayThisMonth) {
            FortuneWidget.resetToCurrentMonth(context);
        }

        AppWidgetManager mgr = AppWidgetManager.getInstance(context);

        // 달력 위젯 갱신
        int[] ids = mgr.getAppWidgetIds(new ComponentName(context, FortuneWidget.class));
        for (int id : ids) {
            FortuneWidget.updateWidget(context, mgr, id);
        }

        // 점수 요약 위젯 갱신
        ComponentName scoreComp = new ComponentName(
                context.getPackageName(),
                context.getPackageName() + ".FortuneScoreWidget"
        );
        int[] scoreIds = mgr.getAppWidgetIds(scoreComp);
        if (scoreIds.length > 0) {
            Intent scoreIntent = new Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
            scoreIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, scoreIds);
            scoreIntent.setComponent(scoreComp);
            context.sendBroadcast(scoreIntent);
        }

        call.resolve();
    }

    @PluginMethod
    public void canScheduleExactAlarms(PluginCall call) {
        boolean can = true;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            AlarmManager alarmManager =
                (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
            can = alarmManager.canScheduleExactAlarms();
        }

        JSObject ret = new JSObject();
        ret.put("canScheduleExactAlarms", can);
        call.resolve(ret);
    }

    @PluginMethod
    public void openExactAlarmSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        }

        call.resolve();
    }

    /** Debug-only: checks whether each ready-entry ID has a live PendingIntent in AlarmManager. */
    @PluginMethod
    public void getNotificationRegistrationStatus(PluginCall call) {
        JSArray inputEntries = call.getArray("entries");
        JSArray statuses = new JSArray();

        if (inputEntries != null) {
            for (int i = 0; i < inputEntries.length(); i++) {
                try {
                    JSONObject entry = inputEntries.getJSONObject(i);
                    long id = entry.getLong("id");
                    int requestCode = (int) (id % 1_000_000_000L);

                    // Mirror cancelEntries(): bare intent (no extras) is sufficient —
                    // PendingIntent identity does not consider extras.
                    Intent intent = new Intent(getContext(), NotificationAlarmReceiver.class);
                    PendingIntent pi = PendingIntent.getBroadcast(
                            getContext(),
                            requestCode,
                            intent,
                            PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE);

                    JSObject status = new JSObject();
                    status.put("id", id);
                    status.put("registered", pi != null);
                    statuses.put(status);
                } catch (Exception ignored) {}
            }
        }

        JSObject ret = new JSObject();
        ret.put("statuses", statuses);
        call.resolve(ret);
    }
}
