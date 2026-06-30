export const AnalyticsEvent = {
  APP_OPEN:                    'app_open',
  DETAIL_OPEN:                 'detail_open',
  CALENDAR_DAY_SELECTED:       'calendar_day_selected',
  INTERPRETATION_BUTTON_CLICK: 'interpretation_button_click',
  REWARDED_AD_START:           'rewarded_ad_start',
  REWARDED_AD_COMPLETE:        'rewarded_ad_complete',
  INTERPRETATION_OPEN:         'interpretation_open',
  NOTIFICATION_OPEN:           'notification_open',
  INTERPRETATION_API_CALL:     'interpretation_api_call',
  INTERPRETATION_CACHE_HIT:    'interpretation_cache_hit',
} as const;

export type AnalyticsEventName = typeof AnalyticsEvent[keyof typeof AnalyticsEvent];
