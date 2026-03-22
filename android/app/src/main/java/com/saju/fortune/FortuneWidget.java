package com.saju.fortune;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Calendar;

public class FortuneWidget extends AppWidgetProvider {

    static final String ACTION_DAY_CLICK  = "com.saju.fortune.DAY_CLICK";
    static final String ACTION_PREV_MONTH = "com.saju.fortune.PREV_MONTH";
    static final String ACTION_NEXT_MONTH = "com.saju.fortune.NEXT_MONTH";
    static final String ACTION_TODAY      = "com.saju.fortune.TODAY";

    static final String EXTRA_DAY       = "day";
    static final String EXTRA_WIDGET_ID = "widget_id";

    static final String PREFS_NAME   = "CapacitorStorage";
    static final String WIDGET_PREFS = "FortuneWidgetPrefs";

    @Override
    public void onEnabled(Context context) {
        super.onEnabled(context);
        resetToCurrentMonth(context);
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager mgr, int[] widgetIds) {
        SharedPreferences p = context.getSharedPreferences(WIDGET_PREFS, Context.MODE_PRIVATE);
        if (!p.contains("display_year")) {
            resetToCurrentMonth(context);
        }
        for (int id : widgetIds) updateWidget(context, mgr, id);
    }

    static void resetToCurrentMonth(Context context) {
        Calendar now = Calendar.getInstance();
        context.getSharedPreferences(WIDGET_PREFS, Context.MODE_PRIVATE).edit()
                .putInt("display_year",  now.get(Calendar.YEAR))
                .putInt("display_month", now.get(Calendar.MONTH) + 1)
                .putInt("selected_day",  now.get(Calendar.DAY_OF_MONTH))
                .apply();
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        String action = intent.getAction();
        if (action == null) return;

        AppWidgetManager mgr = AppWidgetManager.getInstance(context);
        int widgetId = intent.getIntExtra(EXTRA_WIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);

        if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            int[] ids = mgr.getAppWidgetIds(new ComponentName(context, FortuneWidget.class));
            for (int id : ids) updateWidget(context, mgr, id);
            return;
        }

        SharedPreferences.Editor editor = context
                .getSharedPreferences(WIDGET_PREFS, Context.MODE_PRIVATE).edit();
        Calendar now = Calendar.getInstance();

        switch (action) {
            case Intent.ACTION_DATE_CHANGED: {
                resetToCurrentMonth(context);
                break;
            }
            case ACTION_DAY_CLICK: {
                // 탭 전환 없이 하단 상세만 업데이트
                int day = intent.getIntExtra(EXTRA_DAY, 0);
                if (day > 0) {
                    editor.putInt("selected_day", day).apply();
                }
                break;
            }
            case ACTION_PREV_MONTH: {
                SharedPreferences p2 = context.getSharedPreferences(WIDGET_PREFS, Context.MODE_PRIVATE);
                int cy = p2.getInt("display_year",  now.get(Calendar.YEAR));
                int cm = p2.getInt("display_month", now.get(Calendar.MONTH) + 1);
                int py = (cm == 1) ? cy - 1 : cy;
                int pm = (cm == 1) ? 12 : cm - 1;
                // 월 이동 시 selected_day 초기화 (새 달의 1일)
                editor.putInt("display_year", py).putInt("display_month", pm)
                      .putInt("selected_day", 1).commit();
                break;
            }
            case ACTION_NEXT_MONTH: {
                SharedPreferences p2 = context.getSharedPreferences(WIDGET_PREFS, Context.MODE_PRIVATE);
                int cy = p2.getInt("display_year",  now.get(Calendar.YEAR));
                int cm = p2.getInt("display_month", now.get(Calendar.MONTH) + 1);
                int ny = (cm == 12) ? cy + 1 : cy;
                int nm = (cm == 12) ? 1 : cm + 1;
                editor.putInt("display_year", ny).putInt("display_month", nm)
                      .putInt("selected_day", 1).commit();
                break;
            }
            case ACTION_TODAY: {
                editor.putInt("display_year",  now.get(Calendar.YEAR))
                      .putInt("display_month", now.get(Calendar.MONTH) + 1)
                      .putInt("selected_day",  now.get(Calendar.DAY_OF_MONTH))
                      .apply();
                break;
            }
        }

        int[] currentIds = mgr.getAppWidgetIds(new ComponentName(context, FortuneWidget.class));
        if (ACTION_DAY_CLICK.equals(action)) {
            SharedPreferences prefs = context.getSharedPreferences(WIDGET_PREFS, Context.MODE_PRIVATE);
            for (int id : currentIds) updateDetailOnly(context, mgr, id, prefs);
        } else {
            for (int id : currentIds) updateWidget(context, mgr, id);
        }
    }

    static void updateWidget(Context context, AppWidgetManager mgr, int widgetId) {
        updateWidget(context, mgr, widgetId, true);
    }

    static void updateWidget(Context context, AppWidgetManager mgr, int widgetId, boolean refreshGrid) {
        SharedPreferences prefs = context.getSharedPreferences(WIDGET_PREFS, Context.MODE_PRIVATE);
        showCalendar(context, mgr, widgetId, prefs, refreshGrid);
    }

    // ── 달력 뷰 ──────────────────────────────────────────────────────────────

    private static void updateDetailOnly(Context context, AppWidgetManager mgr,
                                         int widgetId, SharedPreferences widgetPrefs) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_calendar);

        Calendar now = Calendar.getInstance();
        int year  = widgetPrefs.getInt("display_year",  now.get(Calendar.YEAR));
        int month = widgetPrefs.getInt("display_month", now.get(Calendar.MONTH) + 1);
        int todayDay   = now.get(Calendar.DAY_OF_MONTH);
        int defaultDay = (year == now.get(Calendar.YEAR) && month == now.get(Calendar.MONTH) + 1) ? todayDay : 1;
        int selectedDay = widgetPrefs.getInt("selected_day", defaultDay);

        Calendar cal = Calendar.getInstance();
        cal.set(year, month - 1, 1);
        int daysInMonth = cal.getActualMaximum(Calendar.DAY_OF_MONTH);
        if (selectedDay < 1 || selectedDay > daysInMonth) selectedDay = 1;

        views.setTextViewText(R.id.tv_detail_date, month + "월 " + selectedDay + "일");

        SharedPreferences mainPrefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String raw = mainPrefs.getString("widget_monthly_" + year + "_" + month, null);

        if (raw != null) {
            try {
                JSONArray fortunes = new JSONObject(raw).getJSONArray("daily_fortunes");
                JSONObject f = fortunes.getJSONObject(selectedDay - 1);
                int overall = f.optInt("score",  0);
                views.setTextViewText(R.id.tv_detail_overall, String.valueOf(overall));
                views.setTextColor(R.id.tv_detail_overall, scoreColor(overall));
                setBar(views, R.id.pb_wealth,  R.id.tv_wealth_score,  f.optInt("wealth", 0));
                setBar(views, R.id.pb_love,    R.id.tv_love_score,    f.optInt("love",   0));
                setBar(views, R.id.pb_health,  R.id.tv_health_score,  f.optInt("health", 0));
                setBar(views, R.id.pb_career,  R.id.tv_career_score,  f.optInt("career", 0));
            } catch (Exception e) {
                setDetailPlaceholders(views);
            }
        } else {
            setDetailPlaceholders(views);
        }

        views.setOnClickPendingIntent(R.id.detail_area,
                makeDetailIntent(context, widgetId, year, month, selectedDay));

        mgr.partiallyUpdateAppWidget(widgetId, views);
    }

    private static void showCalendar(Context context, AppWidgetManager mgr,
                                     int widgetId, SharedPreferences widgetPrefs, boolean refreshGrid) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_calendar);

        Calendar now  = Calendar.getInstance();
        int year  = widgetPrefs.getInt("display_year",  now.get(Calendar.YEAR));
        int month = widgetPrefs.getInt("display_month", now.get(Calendar.MONTH) + 1);
        views.setTextViewText(R.id.tv_month_title, year + "년 " + month + "월");

        // GridView 어댑터
        Intent serviceIntent = new Intent(context, FortuneWidgetService.class);
        serviceIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId);
        serviceIntent.setData(Uri.parse(serviceIntent.toUri(Intent.URI_INTENT_SCHEME)));
        views.setRemoteAdapter(R.id.calendar_grid, serviceIntent);

        int mutableFlag = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
                ? PendingIntent.FLAG_MUTABLE : 0;
        Intent clickIntent = new Intent(context, FortuneWidget.class);
        clickIntent.setAction(ACTION_DAY_CLICK);
        clickIntent.putExtra(EXTRA_WIDGET_ID, widgetId);
        PendingIntent template = PendingIntent.getBroadcast(
                context, widgetId * 10 + actionOffset(ACTION_DAY_CLICK), clickIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | mutableFlag);
        views.setPendingIntentTemplate(R.id.calendar_grid, template);

        views.setOnClickPendingIntent(R.id.btn_prev,
                makeNavIntent(context, widgetId, ACTION_PREV_MONTH));
        views.setOnClickPendingIntent(R.id.btn_next,
                makeNavIntent(context, widgetId, ACTION_NEXT_MONTH));
        views.setOnClickPendingIntent(R.id.btn_today,
                makeBroadcastIntent(context, widgetId, ACTION_TODAY));

        int todayYear  = now.get(Calendar.YEAR);
        int todayMonth = now.get(Calendar.MONTH) + 1;
        int todayDay   = now.get(Calendar.DAY_OF_MONTH);
        int defaultDay = (year == todayYear && month == todayMonth) ? todayDay : 1;
        int selectedDay = widgetPrefs.getInt("selected_day", defaultDay);

        Calendar cal = Calendar.getInstance();
        cal.set(year, month - 1, 1);
        int daysInMonth = cal.getActualMaximum(Calendar.DAY_OF_MONTH);
        if (selectedDay < 1 || selectedDay > daysInMonth) selectedDay = 1;

        views.setTextViewText(R.id.tv_detail_date, month + "월 " + selectedDay + "일");

        SharedPreferences mainPrefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String raw = mainPrefs.getString("widget_monthly_" + year + "_" + month, null);

        if (raw != null) {
            try {
                JSONArray fortunes = new JSONObject(raw).getJSONArray("daily_fortunes");
                JSONObject f = fortunes.getJSONObject(selectedDay - 1);

                int overall = f.optInt("score",  0);
                int wealth  = f.optInt("wealth", 0);
                int love    = f.optInt("love",   0);
                int health  = f.optInt("health", 0);
                int career  = f.optInt("career", 0);

                views.setTextViewText(R.id.tv_detail_overall, String.valueOf(overall));
                views.setTextColor(R.id.tv_detail_overall, scoreColor(overall));
                setBar(views, R.id.pb_wealth,  R.id.tv_wealth_score,  wealth);
                setBar(views, R.id.pb_love,    R.id.tv_love_score,    love);
                setBar(views, R.id.pb_health,  R.id.tv_health_score,  health);
                setBar(views, R.id.pb_career,  R.id.tv_career_score,  career);
            } catch (Exception e) {
                setDetailPlaceholders(views);
            }
        } else {
            setDetailPlaceholders(views);
        }

        views.setOnClickPendingIntent(R.id.detail_area,
                makeDetailIntent(context, widgetId, year, month, selectedDay));

        mgr.updateAppWidget(widgetId, views);
        if (refreshGrid) {
            mgr.notifyAppWidgetViewDataChanged(widgetId, R.id.calendar_grid);
        }
    }

    private static void setDetailPlaceholders(RemoteViews views) {
        views.setTextViewText(R.id.tv_detail_overall, "--");
        views.setTextColor(R.id.tv_detail_overall, Color.parseColor("#1BC4A8"));
        int[] bars   = {R.id.pb_wealth,       R.id.pb_love,       R.id.pb_health,       R.id.pb_career};
        int[] scores = {R.id.tv_wealth_score, R.id.tv_love_score, R.id.tv_health_score, R.id.tv_career_score};
        for (int i = 0; i < bars.length; i++) {
            views.setProgressBar(bars[i], 100, 0, false);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                views.setColorStateList(bars[i], "setProgressTintList",
                        ColorStateList.valueOf(Color.parseColor("#40FFFFFF")));
            }
            views.setTextViewText(scores[i], "--");
            views.setTextColor(scores[i], Color.parseColor("#60FFFFFF"));
        }
    }

    private static void setBar(RemoteViews views, int barId, int scoreId, int score) {
        views.setProgressBar(barId, 100, score, false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            views.setColorStateList(barId, "setProgressTintList",
                    ColorStateList.valueOf(scoreColor(score)));
        }
        views.setTextViewText(scoreId, String.valueOf(score));
        views.setTextColor(scoreId, scoreColor(score));
    }

    private static int scoreColor(int score) {
        if (score >= 75) return Color.parseColor("#FFD700");
        if (score >= 65) return Color.parseColor("#88DD88");
        if (score >= 55) return Color.parseColor("#AAAAAA");
        return Color.parseColor("#FF6666");
    }

    // ── 헬퍼 ──────────────────────────────────────────────────────────────────

    private static int actionOffset(String action) {
        switch (action) {
            case ACTION_PREV_MONTH: return 1;
            case ACTION_NEXT_MONTH: return 2;
            case ACTION_TODAY:      return 3;
            case ACTION_DAY_CLICK:  return 5;
            case "DETAIL_OPEN":     return 7;
            default:                return 9;
        }
    }

    private static PendingIntent makeBroadcastIntent(Context context, int widgetId, String action) {
        Intent intent = new Intent(context, FortuneWidget.class);
        intent.setAction(action);
        intent.putExtra(EXTRA_WIDGET_ID, widgetId);
        int reqCode = widgetId * 10 + actionOffset(action);
        return PendingIntent.getBroadcast(context, reqCode, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent makeDetailIntent(Context context, int widgetId,
                                                   int year, int month, int day) {
        Uri uri = Uri.parse("saju://fortune/detail?year=" + year + "&month=" + month + "&day=" + day);
        Intent intent = new Intent(Intent.ACTION_VIEW, uri);
        intent.setPackage(context.getPackageName());
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int reqCode = widgetId * 10 + actionOffset("DETAIL_OPEN");
        return PendingIntent.getActivity(context, reqCode, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent makeNavIntent(Context context, int widgetId, String action) {
        Intent intent = new Intent(context, FortuneWidget.class);
        intent.setAction(action);
        intent.putExtra(EXTRA_WIDGET_ID, widgetId);
        int reqCode = widgetId * 10 + actionOffset(action);
        return PendingIntent.getBroadcast(context, reqCode, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
