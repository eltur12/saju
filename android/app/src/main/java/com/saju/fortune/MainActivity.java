package com.saju.fortune;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WidgetPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onResume() {
        super.onResume();
        refreshWidget();
    }

    private void refreshWidget() {
        AppWidgetManager mgr = AppWidgetManager.getInstance(this);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(this, FortuneWidget.class));
        if (ids.length == 0) return;
        FortuneWidget.resetToCurrentMonth(this);
        for (int id : ids) {
            FortuneWidget.updateWidget(this, mgr, id);
        }
    }
}
