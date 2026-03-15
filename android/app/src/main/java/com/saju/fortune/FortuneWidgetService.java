package com.saju.fortune;

import android.content.Intent;
import android.widget.RemoteViewsService;

public class FortuneWidgetService extends RemoteViewsService {
    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        return new FortuneWidgetFactory(getApplicationContext(), intent);
    }
}
