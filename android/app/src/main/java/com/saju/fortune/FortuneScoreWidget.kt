package com.saju.fortune

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import org.json.JSONObject

/**
 * 하루온도 점수 위젯 — widget_fortune.xml 레이아웃 사용
 * widget_data 에서 score / badge 읽음
 */
class FortuneScoreWidget : AppWidgetProvider() {

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

        @JvmStatic
        fun updateAllWidgets(context: Context) {
            val mgr = AppWidgetManager.getInstance(context)
            val ids = mgr.getAppWidgetIds(ComponentName(context, FortuneScoreWidget::class.java))
            for (id in ids) updateWidget(context, mgr, id)
        }

        fun updateWidget(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int,
        ) {
            val prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE)
            val raw = prefs.getString("widget_data", null)

            val score = if (raw != null) runCatching { JSONObject(raw).getInt("score") }.getOrDefault(0) else 0
            val badge = if (raw != null) runCatching { JSONObject(raw).getString("badge") }.getOrDefault("") else ""
            val date  = if (raw != null) runCatching { JSONObject(raw).getString("date") }.getOrDefault("") else ""

            val badgeLabel = when (badge) {
                "대길" -> "좋은 흐름"
                "길"   -> "안정적"
                else   -> badge
            }

            val scoreColor = when {
                score >= 80 -> context.getColor(R.color.widget_score_gold)
                score >= 65 -> context.getColor(R.color.widget_score_green)
                score >= 52 -> context.getColor(R.color.widget_score_gray)
                else        -> context.getColor(R.color.widget_score_red)
            }

            val views = RemoteViews(context.packageName, R.layout.widget_fortune)
            views.setTextViewText(R.id.widget_score, if (score > 0) score.toString() else "-")
            views.setTextColor(R.id.widget_score, scoreColor)
            views.setTextViewText(R.id.widget_badge, badgeLabel)
            views.setTextViewText(R.id.widget_summary, "앱에서 자세한 흐름을 확인해보세요")
            views.setTextViewText(R.id.widget_date, date)

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