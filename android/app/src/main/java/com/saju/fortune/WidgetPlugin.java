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
import android.os.Build;
import android.provider.Settings;
import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.JSObject;

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
        getContext().registerReceiver(dateChangeReceiver, new IntentFilter(Intent.ACTION_DATE_CHANGED));
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
}
