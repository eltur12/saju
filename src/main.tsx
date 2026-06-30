import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initAdMob } from './admob/rewardedAd'
import { logEvent } from './analytics/Analytics'
import { AnalyticsEvent } from './analytics/events'

initAdMob();
void logEvent(AnalyticsEvent.APP_OPEN);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
