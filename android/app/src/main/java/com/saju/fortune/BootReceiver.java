package com.saju.fortune;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/**
 * Reschedules today's native notifications after a device reboot.
 * AlarmManager alarms are cleared on reboot; this receiver restores them
 * by reading the pre-built fortune_notifications_ready_YYYY-MM-DD data
 * that JS has already persisted in SharedPreferences.
 */
public class BootReceiver extends BroadcastReceiver {

    private static final String TAG = "BootReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) { return; }

        Log.d(TAG, "BOOT_COMPLETED received — scheduling today's notifications");
        try {
            NativeNotificationScheduler.scheduleToday(context);
            Log.d(TAG, "scheduleToday called from boot successfully");
        } catch (Exception e) {
            Log.e(TAG, "Failed to schedule notifications from boot", e);
        }
    }
}
