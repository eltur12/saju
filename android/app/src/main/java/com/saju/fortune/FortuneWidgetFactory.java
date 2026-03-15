package com.saju.fortune;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Bundle;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;

public class FortuneWidgetFactory implements RemoteViewsService.RemoteViewsFactory {

    private final Context context;
    private final List<CellData> cells = new ArrayList<>();

    static class CellData {
        int day;   // 0 = 빈 셀
        int score;
        boolean isToday;
        int dow;   // 0=일, 6=토
    }

    FortuneWidgetFactory(Context context, Intent intent) {
        this.context = context;
    }

    @Override public void onCreate()          { loadData(); }
    @Override public void onDataSetChanged()  { loadData(); }
    @Override public void onDestroy()         {}

    private void loadData() {
        cells.clear();

        SharedPreferences widgetPrefs = context.getSharedPreferences(
                FortuneWidget.WIDGET_PREFS, Context.MODE_PRIVATE);
        Calendar now = Calendar.getInstance();
        int year  = widgetPrefs.getInt("display_year",  now.get(Calendar.YEAR));
        int month = widgetPrefs.getInt("display_month", now.get(Calendar.MONTH) + 1);

        // 월간 운세 점수 배열 (1-indexed)
        int[] scores = new int[32];
        SharedPreferences prefs = context.getSharedPreferences(
                FortuneWidget.PREFS_NAME, Context.MODE_PRIVATE);
        String raw = prefs.getString("widget_monthly_" + year + "_" + month, null);
        if (raw != null) {
            try {
                JSONObject json     = new JSONObject(raw);
                JSONArray fortunes  = json.getJSONArray("daily_fortunes");
                for (int i = 0; i < fortunes.length(); i++) {
                    scores[i + 1] = fortunes.getJSONObject(i).optInt("score", 0);
                }
            } catch (Exception ignored) {}
        }

        // 달력 셀 구성
        Calendar cal = Calendar.getInstance();
        cal.set(year, month - 1, 1);
        int firstDow     = cal.get(Calendar.DAY_OF_WEEK) - 1; // 0=일
        int daysInMonth  = cal.getActualMaximum(Calendar.DAY_OF_MONTH);
        int todayYear    = now.get(Calendar.YEAR);
        int todayMonth   = now.get(Calendar.MONTH) + 1;
        int todayDay     = now.get(Calendar.DAY_OF_MONTH);

        // 첫날 이전 빈 셀
        for (int i = 0; i < firstDow; i++) {
            CellData c = new CellData();
            c.day = 0;
            cells.add(c);
        }
        // 날짜 셀
        for (int day = 1; day <= daysInMonth; day++) {
            CellData c  = new CellData();
            c.day       = day;
            c.score     = scores[day];
            c.isToday   = (year == todayYear && month == todayMonth && day == todayDay);
            c.dow       = (firstDow + day - 1) % 7;
            cells.add(c);
        }
        // 7의 배수로 패딩
        while (cells.size() % 7 != 0) {
            CellData c = new CellData();
            c.day = 0;
            cells.add(c);
        }
    }

    @Override
    public int getCount() { return cells.size(); }

    @Override
    public RemoteViews getViewAt(int position) {
        RemoteViews rv = new RemoteViews(context.getPackageName(), R.layout.widget_cell);
        CellData cell  = cells.get(position);

        if (cell.day == 0) {
            rv.setTextViewText(R.id.cell_day,   "");
            rv.setTextViewText(R.id.cell_score, "");
        } else {
            rv.setTextViewText(R.id.cell_day,   String.valueOf(cell.day));
            rv.setTextViewText(R.id.cell_score, cell.score > 0 ? String.valueOf(cell.score) : "");

            // 날짜 색상
            int dayColor;
            if      (cell.isToday)  dayColor = Color.parseColor("#FFD700");
            else if (cell.dow == 0) dayColor = Color.parseColor("#FF8888");
            else if (cell.dow == 6) dayColor = Color.parseColor("#AAAAFF");
            else                    dayColor = Color.WHITE;
            rv.setTextColor(R.id.cell_day, dayColor);

            // 점수 색상
            int scoreColor;
            if      (cell.score >= 75) scoreColor = Color.parseColor("#FFD700");
            else if (cell.score >= 65) scoreColor = Color.parseColor("#88DD88");
            else if (cell.score >= 55) scoreColor = Color.parseColor("#AAAAAA");
            else                       scoreColor = Color.parseColor("#FF6666");
            rv.setTextColor(R.id.cell_score, scoreColor);

            // 날짜 클릭 인텐트 — 모든 자식 뷰에도 적용해야 클릭이 확실히 잡힘
            Bundle extras = new Bundle();
            extras.putInt(FortuneWidget.EXTRA_DAY, cell.day);
            Intent fillIn = new Intent();
            fillIn.putExtras(extras);
            rv.setOnClickFillInIntent(R.id.cell_root,  fillIn);
            rv.setOnClickFillInIntent(R.id.cell_day,   fillIn);
            rv.setOnClickFillInIntent(R.id.cell_score, fillIn);
        }
        return rv;
    }

    @Override public RemoteViews getLoadingView()  { return null; }
    @Override public int         getViewTypeCount() { return 1; }
    @Override public long        getItemId(int pos) { return pos; }
    @Override public boolean     hasStableIds()     { return false; }
}
