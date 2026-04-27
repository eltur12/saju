package com.saju.fortune;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Reads pre-built notification plans from SharedPreferences and schedules them
 * via AlarmManager. Does NOT calculate any fortune or notification logic —
 * that is done by JS and persisted as fortune_notifications_ready_YYYY-MM-DD.
 */
public class NativeNotificationScheduler {

    private static final String TAG        = "NativeNotiScheduler";
    private static final String PREFS_NAME = "CapacitorStorage";
    private static final String KEY_PREFIX = "fortune_notifications_ready_";

    public static void scheduleToday(Context context) {
        String today = todayKey();
        String key   = KEY_PREFIX + today;

        // ── Debug: dump all SharedPreferences keys so key mismatches are visible ──
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        Log.d(TAG, "scheduleToday: today=" + today);
        Log.d(TAG, "scheduleToday: key="   + key);
        Map<String, ?> all = prefs.getAll();
        Log.d(TAG, "SharedPreferences[" + PREFS_NAME + "] total keys=" + all.size());
        for (String k : all.keySet()) {
            Log.d(TAG, "  available key=" + k);
        }
        String rawDebug = prefs.getString(key, null);
        if (rawDebug == null) {
            Log.d(TAG, "raw=NULL (key not found in SharedPreferences)");
        } else {
            Log.d(TAG, "raw length=" + rawDebug.length()
                    + "  preview=" + rawDebug.substring(0, Math.min(120, rawDebug.length())));
        }
        // ─────────────────────────────────────────────────────────────────────────

        List<NotificationEntry> entries = readEntries(context, today);

        // Fallback: try yesterday — covers the case where the device crossed midnight
        // but JS hasn't yet written today's ready-data (timezone edge case).
        if (entries.isEmpty()) {
            String yesterday = yesterdayKey();
            Log.d(TAG, "No data for today — trying fallback yesterday=" + yesterday);
            List<NotificationEntry> yEntries = readEntries(context, yesterday);
            if (!yEntries.isEmpty()) {
                Log.d(TAG, "Fallback: using yesterday's (" + yesterday + ") data — "
                        + yEntries.size() + " entries");
                entries = yEntries;
            }
        }

        Log.d(TAG, "scheduleToday " + today + " — " + entries.size() + " entries found");

        if (entries.isEmpty()) {
            Log.d(TAG, "No ready data for " + today + " — skipping");
            return;
        }

        cancelEntries(context, entries);

        long now       = System.currentTimeMillis();
        int  scheduled = 0;

        for (NotificationEntry entry : entries) {
            long triggerMillis = parseEpochMillis(entry.triggerAt);
            if (triggerMillis <= now) {
                Log.d(TAG, "  skip past: " + entry.type + " " + entry.triggerAt);
                continue;
            }
            scheduleAlarm(context, entry.id, triggerMillis, entry.title, entry.body);
            scheduled++;
        }

        Log.d(TAG, "scheduleToday done — " + scheduled + " alarm(s) set");
    }

    public static void cancelToday(Context context) {
        List<NotificationEntry> entries = readEntries(context, todayKey());
        cancelEntries(context, entries);
        Log.d(TAG, "cancelToday — " + entries.size() + " alarm(s) cancelled");
    }

    public static void scheduleAlarm(
            Context context,
            long    id,
            long    triggerAtMillis,
            String  title,
            String  body) {
        AlarmManager  am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        PendingIntent pi = PendingIntent.getBroadcast(
                context,
                intId(id),
                receiverIntent(context, id, title, body),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pi);
            Log.d(TAG, "  alarm(inexact) id=" + id + " title=" + title + " at=" + triggerAtMillis);
        } else {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pi);
            Log.d(TAG, "  alarm(exact)   id=" + id + " title=" + title + " at=" + triggerAtMillis);
        }
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private static void cancelEntries(Context context, List<NotificationEntry> entries) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        for (NotificationEntry entry : entries) {
            PendingIntent pi = PendingIntent.getBroadcast(
                    context,
                    intId(entry.id),
                    new Intent(context, NotificationAlarmReceiver.class),
                    PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE);
            if (pi != null) {
                am.cancel(pi);
                pi.cancel();
                Log.d(TAG, "  cancelled alarm id=" + entry.id);
            }
        }
    }

    private static Intent receiverIntent(Context context, long id, String title, String body) {
        Intent intent = new Intent(context, NotificationAlarmReceiver.class);
        intent.putExtra(NotificationAlarmReceiver.EXTRA_ID,    intId(id));
        intent.putExtra(NotificationAlarmReceiver.EXTRA_TITLE, title);
        intent.putExtra(NotificationAlarmReceiver.EXTRA_BODY,  body);
        return intent;
    }

    private static List<NotificationEntry> readEntries(Context context, String dateKey) {
        String raw = context
                .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .getString(KEY_PREFIX + dateKey, null);

        if (raw == null) return new ArrayList<>();

        List<NotificationEntry> result = new ArrayList<>();
        try {
            JSONArray arr = new JSONArray(raw);
            for (int i = 0; i < arr.length(); i++) {
                try {
                    JSONObject o = arr.getJSONObject(i);
                    result.add(new NotificationEntry(
                            o.getLong("id"),
                            o.getString("type"),
                            o.getString("triggerAt"),
                            o.getString("title"),
                            o.getString("body")));
                } catch (Exception e) {
                    Log.w(TAG, "  bad entry[" + i + "]", e);
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "  failed to parse JSON for " + dateKey, e);
        }
        return result;
    }

    /**
     * Parse "YYYY-MM-DDTHH:MM:SS" (no timezone) as local time → epoch millis.
     * Uses Calendar for full API-level compatibility (minSdk 22).
     */
    private static long parseEpochMillis(String triggerAt) {
        try {
            String[] parts     = triggerAt.split("T");
            String[] dateParts = parts[0].split("-");
            String[] timeParts = parts[1].split(":");
            int year  = Integer.parseInt(dateParts[0]);
            int month = Integer.parseInt(dateParts[1]);
            int day   = Integer.parseInt(dateParts[2]);
            int hour  = Integer.parseInt(timeParts[0]);
            int min   = Integer.parseInt(timeParts[1]);
            int sec   = Integer.parseInt(timeParts[2]);
            Calendar cal = Calendar.getInstance();
            cal.set(year, month - 1, day, hour, min, sec);
            cal.set(Calendar.MILLISECOND, 0);
            return cal.getTimeInMillis();
        } catch (Exception e) {
            Log.w(TAG, "Failed to parse triggerAt: " + triggerAt, e);
            return 0;
        }
    }

    /**
     * Compress the 12-digit Long ID into Android's Int-range requestCode / notify-id.
     * Example: 202604270710L → 604270710
     */
    private static int intId(long id) {
        return (int) (id % 1_000_000_000L);
    }

    /** Returns today as "YYYY-MM-DD" in device local time using ASCII digits (Locale.US). */
    private static String todayKey() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
    }

    /** Returns yesterday as "YYYY-MM-DD" in device local time. Used as fallback. */
    private static String yesterdayKey() {
        Calendar c = Calendar.getInstance();
        c.add(Calendar.DAY_OF_MONTH, -1);
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(c.getTime());
    }

    private static class NotificationEntry {
        final long   id;
        final String type;
        final String triggerAt;
        final String title;
        final String body;

        NotificationEntry(long id, String type, String triggerAt, String title, String body) {
            this.id        = id;
            this.type      = type;
            this.triggerAt = triggerAt;
            this.title     = title;
            this.body      = body;
        }
    }
}
