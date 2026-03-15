package com.saju.fortune

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import org.json.JSONObject

class FortuneWidget : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
    ) {
        for (id in appWidgetIds) {
            updateWidget(context, appWidgetManager, id)
        }
    }

    companion object {
        fun updateWidget(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int,
        ) {
            // Capacitor Preferences는 "CapacitorStorage" SharedPreferences에
            // "CAP_<key>" 형태로 저장합니다.
            val prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE)
            val raw = prefs.getString("CAP_widget_data", null)

            val score   = if (raw != null) runCatching { JSONObject(raw).getInt("score") }.getOrDefault(0) else 0
            val badge   = if (raw != null) runCatching { JSONObject(raw).getString("badge") }.getOrDefault("") else ""
            val summary = if (raw != null) runCatching { JSONObject(raw).getString("summary") }.getOrDefault("앱을 열어 운세를 확인하세요") else "앱을 열어 운세를 확인하세요"
            val date    = if (raw != null) runCatching { JSONObject(raw).getString("date") }.getOrDefault("") else ""

            val scoreColor = when {
                score >= 80 -> context.getColor(R.color.widget_score_gold)
                score >= 65 -> context.getColor(R.color.widget_score_green)
                score >= 52 -> context.getColor(R.color.widget_score_gray)
                else        -> context.getColor(R.color.widget_score_red)
            }

            val views = RemoteViews(context.packageName, R.layout.widget_fortune)
            views.setTextViewText(R.id.widget_score, if (score > 0) score.toString() else "-")
            views.setTextColor(R.id.widget_score, scoreColor)
            views.setTextViewText(R.id.widget_badge, badge)
            views.setTextViewText(R.id.widget_summary, summary)
            views.setTextViewText(R.id.widget_date, date)

            // 탭 시 앱 실행
            val intent = Intent(context, MainActivity::class.java)
            val pendingIntent = PendingIntent.getActivity(
                context, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            views.setOnClickPendingIntent(R.id.widget_root, pendingIntent)

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}
