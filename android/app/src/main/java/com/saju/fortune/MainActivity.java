package com.saju.fortune;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onResume() {
        super.onResume();
        // 위젯 그리드 데이터만 갱신 (월·모드는 건드리지 않음)
        notifyWidgetDataChanged();
    }

    private void notifyWidgetDataChanged() {
        AppWidgetManager mgr = AppWidgetManager.getInstance(this);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(this, FortuneWidget.class));
        if (ids.length == 0) return;
        mgr.notifyAppWidgetViewDataChanged(ids, R.id.calendar_grid);
    }
}
