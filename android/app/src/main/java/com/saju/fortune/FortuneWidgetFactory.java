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
        boolean isSelected;
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

        Calendar cal = Calendar.getInstance();
        cal.set(year, month - 1, 1);
        int firstDow     = cal.get(Calendar.DAY_OF_WEEK) - 1;
        int daysInMonth  = cal.getActualMaximum(Calendar.DAY_OF_MONTH);
        int todayYear    = now.get(Calendar.YEAR);
        int todayMonth   = now.get(Calendar.MONTH) + 1;
        int todayDay     = now.get(Calendar.DAY_OF_MONTH);
        int defaultDay   = (year == todayYear && month == todayMonth) ? todayDay : 1;
        int selectedDay  = widgetPrefs.getInt("selected_day", defaultDay);

        for (int i = 0; i < firstDow; i++) {
            CellData c = new CellData();
            c.day = 0;
            cells.add(c);
        }

        for (int day = 1; day <= daysInMonth; day++) {
            CellData c  = new CellData();
            c.day        = day;
            c.score      = scores[day];
            c.isToday    = (year == todayYear && month == todayMonth && day == todayDay);
            c.isSelected = (day == selectedDay);
            c.dow        = (firstDow + day - 1) % 7;
            cells.add(c);
        }

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

            int dayColor;

            if (cell.isSelected) {
                rv.setInt(R.id.cell_root, "setBackgroundResource", R.drawable.cell_selected_bg);

                if (cell.isToday) {
                    dayColor = Color.parseColor("#1BC4A8");
                } else if (cell.dow == 0) {
                    dayColor = Color.parseColor("#FF8A8A");
                } else if (cell.dow == 6) {
                    dayColor = Color.parseColor("#8AB4FF");
                } else {
                    dayColor = Color.parseColor("#FFFFFF");
                }
            } else if (cell.isToday) {
                rv.setInt(R.id.cell_root, "setBackgroundColor", Color.TRANSPARENT);
                dayColor = Color.parseColor("#1BC4A8");
            } else {
                rv.setInt(R.id.cell_root, "setBackgroundColor", Color.TRANSPARENT);
                if (cell.dow == 0) {
                    dayColor = Color.parseColor("#CC884444");
                } else if (cell.dow == 6) {
                    dayColor = Color.parseColor("#CC7777CC");
                } else {
                    dayColor = Color.parseColor("#CCF0F0F0");
                }
            }

            rv.setTextColor(R.id.cell_day, dayColor);

            if (cell.isSelected) {
                rv.setFloat(R.id.cell_day, "setTextSize", 15f);
                rv.setFloat(R.id.cell_day, "setAlpha", 1.0f);
                rv.setFloat(R.id.cell_score, "setAlpha", 1.0f);
                rv.setFloat(R.id.cell_score, "setTextSize", 11f);
            } else {
                rv.setFloat(R.id.cell_day, "setTextSize", 14f);
                rv.setFloat(R.id.cell_day, "setAlpha", 0.9f);
                rv.setFloat(R.id.cell_score, "setAlpha", 0.88f);
                rv.setFloat(R.id.cell_score, "setTextSize", 10f);
            }

            int scoreColor;
            if      (cell.score >= 75) scoreColor = Color.parseColor("#FFD700");
            else if (cell.score >= 65) scoreColor = Color.parseColor("#1BC4A8");
            else if (cell.score >= 55) scoreColor = Color.parseColor("#AAAAAA");
            else                       scoreColor = Color.parseColor("#FF6666");
            rv.setTextColor(R.id.cell_score, scoreColor);

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

    @Override public RemoteViews getLoadingView() {
        RemoteViews rv = new RemoteViews(context.getPackageName(), R.layout.widget_cell);
        rv.setTextViewText(R.id.cell_day, "");
        rv.setTextViewText(R.id.cell_score, "");
        return rv;
    }

    @Override public int     getViewTypeCount() { return 1; }
    @Override public long    getItemId(int pos) { return pos; }
    @Override public boolean hasStableIds()     { return false; }
}