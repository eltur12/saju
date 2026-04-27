package com.saju.fortune;

import android.os.Bundle;
import android.util.Log;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "MainActivity";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WidgetPlugin.class);
        super.onCreate(savedInstanceState);
        // Schedule today's native notifications from stored ready-data.
        // Safe if the key is missing — NativeNotificationScheduler handles that gracefully.
        Log.d(TAG, "scheduleToday called from app launch");
        NativeNotificationScheduler.scheduleToday(this);
    }

    @Override
    public void onResume() {
        super.onResume();
    }
}
