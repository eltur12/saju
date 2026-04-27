package com.saju.fortune;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;

/**
 * Receives AlarmManager broadcasts and posts the notification.
 * Title and body are delivered as Intent extras — no fortune logic here.
 */
public class NotificationAlarmReceiver extends BroadcastReceiver {

    private static final String TAG = "NotiAlarmReceiver";

    public static final String CHANNEL_ID  = "daily_flow";
    public static final String EXTRA_ID    = "notification_id";
    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_BODY  = "body";

    @Override
    public void onReceive(Context context, Intent intent) {
        int    id    = intent.getIntExtra(EXTRA_ID, 0);
        String title = intent.getStringExtra(EXTRA_TITLE);
        String body  = intent.getStringExtra(EXTRA_BODY);

        if (title == null) { title = ""; }
        if (body  == null) { body  = ""; }

        if (id == 0 || title.isEmpty()) {
            Log.w(TAG, "Missing extras, dropping notification");
            return;
        }

        Log.d(TAG, "onReceive id=" + id + " title=" + title);
        showNotification(context, id, title, body);
    }

    private void showNotification(Context context, int id, String title, String body) {
        NotificationManager nm =
                (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        ensureChannel(nm);

        Intent tapIntent = new Intent(context, MainActivity.class);
        tapIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent tapPi = PendingIntent.getActivity(
                context,
                id,
                tapIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification_small)
                .setColor(0xFF3AAB8C)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setContentIntent(tapPi)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT);

        nm.notify(id, builder.build());
        Log.d(TAG, "Notification posted id=" + id);
    }

    private void ensureChannel(NotificationManager nm) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) { return; }
        if (nm.getNotificationChannel(CHANNEL_ID) != null) { return; }
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "오늘의 운세 알림",
                NotificationManager.IMPORTANCE_DEFAULT);
        channel.setDescription("오늘 흐름과 타이밍 알림");
        nm.createNotificationChannel(channel);
        Log.d(TAG, "Channel created: " + CHANNEL_ID);
    }
}
