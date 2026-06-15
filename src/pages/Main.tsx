import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import WheelPickerModal from "../components/WheelPickerModal";
import { getMonthlyFortune, getProfileInsight, getUser, clearUser } from "../api/fortuneApi";
import { generateDailyInterpretationFull } from "../api/aiApi";
import { buildAiDailyRequestV2 } from "../ai/v2/buildAiDailyRequestV2";
import type { ProfileInsight } from "../api/fortuneApi";
import { App } from "@capacitor/app";
import type { MonthlyFortuneResult, DailyFortune } from "../engines/aggregator";
import type { SajuUser } from "../api/fortuneApi";
import {
  handleDayRollover,
  scheduleDailyFortuneNotifications,
  clearDailyFortuneNotifications,
  loadNotificationSettings,
  loadNotificationReadyHours,
  saveNotificationSettings,
  sendDebugTestNotificationsForToday,
  requestNotificationPermission,
  saveMonthlyNotificationReadyData, cleanupOldNotificationReadyData,
} from "../services/notificationService";
import { addDayRolloverListener, scheduleTodayNotifications, canScheduleExactAlarms, openExactAlarmSettings, getNotificationRegistrationStatus } from "../plugins/widgetPlugin";
import styles from "./Main.module.css";
import SegmentClock from "../components/SegmentClock";
import {
  safeResolveInfo,
  safeResolveLabel,
  isKeyRegistered,
  STATE_LABELS,
  FLOW_LABELS,
} from "../constants/fortuneDictionary";
import {
  planNotifications,
  generateNotificationMessage,
  applyNotificationSettings,
} from "../engines/notificationPlanner";
import type { PlannedNotification } from "../engines/notificationPlanner";
import { normalizeBirthDateTimeByRegion } from "../utils/sajuTime";
import { getBirthRegionById } from "../constants/cities";
import { SCORE_GOLD, SCORE_MINT, SCORE_GRAY } from "../constants/scoreThresholds";
import { Preferences } from "@capacitor/preferences";
import {BRANCH_ELEMENT, STEM_ELEMENT} from "../engines/sajuEngine.ts";
import { getFocusDisplayBoost, getFocusCategoryArrow } from "../engines/focusBuilder";
import { buildFlowElementKeys } from "../utils/flowElements";

const DAY_NAMES = ["일","월","화","수","목","금","토"];
const DOW_KO    = ["일","월","화","수","목","금","토"];
const RADAR_CATS: { key: keyof DailyFortune["scores"]; label: string }[] = [
  { key: "wealth",    label: "재물" },
  { key: "love",      label: "애정" },
  { key: "health",    label: "건강" },
  { key: "career",    label: "직업" },
  { key: "relations", label: "관계" },
  { key: "study",     label: "학습" },
];

const ELEMENT_COLOR: Record<string, string> = {
  "木": "#5aad6e",
  "火": "#e06060",
  "土": "#c9912a",
  "金": "#8f9aa6",
  "水": "#4f7fd9",
};

function getElementColor(char: string) {
  const element = STEM_ELEMENT[char] || BRANCH_ELEMENT[char];
  return element ? ELEMENT_COLOR[element] ?? "#999" : "#999";
}

/**
 * UI 표시용 카테고리 점수 — Focus displayBoost(polarity 정책) 적용
 * raw scores는 변경하지 않고 표시 시점에만 보정한다.
 * (dailyHighlight / baseline / AI Request는 raw 유지)
 */
function displayCatScore(f: DailyFortune, cat: keyof DailyFortune["scores"]): number {
  let v = f.scores[cat] as number;
  for (const fc of f.persisted?.focus ?? []) {
    if (fc.category === cat) v += getFocusDisplayBoost(fc);
  }
  return Math.min(Math.max(v, 0), 100);
}


type TabId = "calendar" | "detail" | "profile";
type SettingsView = "main" | "noti";


const HOUR_BRANCH_LABELS = ["자시","축시","인시","묘시","진시","사시","오시","미시","신시","유시","술시","해시"];
function getHourBranch(hour: number): string {
  return HOUR_BRANCH_LABELS[Math.floor((hour + 1) / 2) % 12];
}

function pad2(n: number) { return String(n).padStart(2, "0"); }


function getScoreClass(score: number) {
  if (score >= SCORE_GOLD) return styles["score-gold"];
  if (score >= SCORE_MINT) return styles["score-green"];
  if (score >= SCORE_GRAY) return styles["score-gray"];
  return styles["score-red"];
}

function scoreColor(score: number): string {
  if (score >= SCORE_GOLD) return "var(--accent-gold)";
  if (score >= SCORE_MINT) return "var(--accent-mint)";
  if (score >= SCORE_GRAY) return "var(--text-muted)";
  return "var(--danger)";
}

function getBadgeClass(badge: string) {
  return `${styles.badge} ${styles[`badge-${badge}`]}`;
}

const BADGE_LABELS: Record<string, string> = {
  "아주좋음": "아주 좋음",
  "좋음":    "좋음",
};
function getBadgeLabel(badge: string): string {
  return BADGE_LABELS[badge] ?? badge;
}


interface Props { onBack: () => void }

export default function Main({ onBack }: Props) {
  const today      = new Date();
  const todayYear  = today.getFullYear();
  const todayMonth = today.getMonth() + 1;
  const todayDate  = today.getDate();
  const todayStr   = `${todayYear}-${String(todayMonth).padStart(2, "0")}-${String(todayDate).padStart(2, "0")}`;

  const [year,  setYear]  = useState(todayYear);
  const [month, setMonth] = useState(todayMonth);
  const [data,  setData]  = useState<MonthlyFortuneResult | null>(null);
  const [loading, setLoading]               = useState(true);
  const [selected, setSelected]             = useState<DailyFortune | null>(null);
  const [user, setUser]                     = useState<SajuUser | null>(null);
  const [tab, setTab]                       = useState<TabId>("calendar");
  const [pendingDay, setPendingDay]         = useState<{ year: number; month: number; day: number } | null>(null);
  const [notiStart, setNotiStart]           = useState(7);

  const [notiDailyEnabled,      setNotiDailyEnabled]      = useState(true);
  const [notiEventStateEnabled, setNotiEventStateEnabled] = useState(true);
  const [notiSaved, setNotiSaved]           = useState(false);
  const [testNotiSent, setTestNotiSent]     = useState(false);
  const [debugOpen, setDebugOpen]           = useState(false);
  const [debugEntries, setDebugEntries]     = useState<Array<{ id: number; type: string; triggerAt: string; title: string; registered?: boolean }> | null>(null);
  const [settingsOpen, setSettingsOpen]     = useState(false);
  const [settingsView, setSettingsView]     = useState<SettingsView>("main");
  const hasScheduledTodayRef                = useRef(false);
  const prevTodayStrRef                    = useRef(todayStr);
  const [resumeTick, setResumeTick]         = useState(0);
  const [_scheduledHours, setScheduledHours] = useState<Set<number>>(new Set());
  const dataRef = useRef<MonthlyFortuneResult | null>(null);
  const [showExactAlarmGuide, setShowExactAlarmGuide] = useState(false);
  const [notiModalOpen, setNotiModalOpen] = useState(false);
  const [draftNotiStart, setDraftNotiStart] = useState(notiStart);
  const [profile, setProfile] = useState<ProfileInsight | null>(null);
  // const [profileOpen, setProfileOpen] = useState(false);
  const [infoTooltip, setInfoTooltip] = useState<"region" | "saju" | null>(null);
const [eventInfoKey, setEventInfoKey] = useState<string | null>(null);
  const [expandedCat, setExpandedCat] = useState<keyof DailyFortune["scores"] | null>(null);
  const [aiResult,     setAiResult]     = useState<{ subtitle: string; summary: string } | null>(null);
  const [aiLoading,    setAiLoading]    = useState(false);
  const [batchRunning,   setBatchRunning]   = useState(false);
  const [batchProgress,  setBatchProgress]  = useState("");
  const [batchResultKey, setBatchResultKey] = useState<string | null>(null);
  const [expandedSegs, setExpandedSegs] = useState<number | null>(null);
  const [adjPrevScore, setAdjPrevScore] = useState<number | null>(null);
  const [adjNextScore, setAdjNextScore] = useState<number | null>(null);
  dataRef.current = data;

  useEffect(() => {
    setExpandedSegs(null);
    setAiResult(null);
    setAiLoading(false);
    setBatchProgress("");
    setBatchResultKey(null);
  }, [selected?.date]);


  useEffect(() => {
    loadNotificationSettings().then(s => {
      const [hh] = s.dailyTime.split(":").map(Number);
      setNotiStart(hh);
      setNotiDailyEnabled(s.dailyEnabled);
      setNotiEventStateEnabled(s.eventStateEnabled);
    });
  }, []);

  const openDebugOverlay = async () => {
    if (!selected) return;
    const key = `fortune_notifications_ready_${selected.date}`;
    const { value } = await Preferences.get({ key });
    const raw: Array<{ id: number; type: string; triggerAt: string; title: string }> =
        value ? JSON.parse(value) : [];
    const statusMap = await getNotificationRegistrationStatus(raw.map(e => ({ id: e.id })));
    setDebugEntries(raw.map(e => ({ ...e, registered: statusMap.get(e.id) })));
    setDebugOpen(true);
  };

  const sendTestNotification = async () => {
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const todayFortune = data?.daily_fortunes[now.getDate() - 1];
    if (!todayFortune) {
      console.warn("[TEST_NOTI] no today fortune available");
      return;
    }
    await sendDebugTestNotificationsForToday(todayFortune, dateStr);
    setTestNotiSent(true);
    setTimeout(() => setTestNotiSent(false), 5000);
  };

  const handleNotiSave = async () => {
    const settings = {
      dailyEnabled:      notiDailyEnabled,
      eventStateEnabled: notiEventStateEnabled,
      dailyTime:         `${String(notiStart).padStart(2, "0")}:00`,
    };
    await saveNotificationSettings(settings);

    const now = new Date();
    const ny = now.getFullYear(), nm = now.getMonth() + 1, nd = now.getDate();
    const dateStr = `${ny}-${String(nm).padStart(2, "0")}-${String(nd).padStart(2, "0")}`;

    let todayFortune: DailyFortune | undefined =
        (data?.year === ny && data?.month === nm) ? data.daily_fortunes[nd - 1] : undefined;

    // todayMonthResult tracks which MonthlyFortuneResult covers today —
    // used to regenerate all ready-data with the new settings
    let todayMonthResult: MonthlyFortuneResult | undefined =
        (data?.year === ny && data?.month === nm) ? data : undefined;

    if (!todayFortune) {
      const u = getUser();
      if (u) {
        const result = await getMonthlyFortune(u, ny, nm);
        todayFortune = result.daily_fortunes[nd - 1];
        todayMonthResult = result;
      }
    }

    // Re-persist ready data for every day in today's month with updated settings.
    // Awaited so that the clock-emoji refresh below reads the freshly written data.
    if (todayMonthResult) {
      await saveMonthlyNotificationReadyData(todayMonthResult, settings).catch(() => {});
      await cleanupOldNotificationReadyData(todayMonthResult.year, todayMonthResult.month);
      await scheduleTodayNotifications();
    }

    if (todayFortune) {
      await clearDailyFortuneNotifications(dateStr);
      await scheduleDailyFortuneNotifications(todayFortune, dateStr);
      if (selected?.date === dateStr) {
        setScheduledHours(await loadNotificationReadyHours(dateStr));
      }
    }

    setNotiSaved(true);
    setTimeout(() => setNotiSaved(false), 2000);
  };

  useEffect(() => { setUser(getUser()); }, []);

  useEffect(() => {
    if (!user) return;
    getProfileInsight(user).then(setProfile).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!user || !data || !selected) return;
    const fortunes = data.daily_fortunes;
    const idx = fortunes.findIndex(f => f.date === selected.date);
    if (idx === 0 && adjPrevScore === null) {
      const prevM = month === 1 ? 12 : month - 1;
      const prevY = month === 1 ? year - 1 : year;
      getMonthlyFortune(user, prevY, prevM).then(r => {
        const lastDay = r.daily_fortunes[r.daily_fortunes.length - 1];
        setAdjPrevScore(lastDay.scores.overall as number);
      }).catch(() => {});
    }
    if (idx === fortunes.length - 1 && adjNextScore === null) {
      const nextM = month === 12 ? 1 : month + 1;
      const nextY = month === 12 ? year + 1 : year;
      getMonthlyFortune(user, nextY, nextM).then(r => {
        setAdjNextScore(r.daily_fortunes[0].scores.overall as number);
      }).catch(() => {});
    }
  }, [selected, data, user, month, year, adjPrevScore, adjNextScore]);

  // 날짜 변경 시 기본 펼침: Focus 대표 카테고리 우선, 없으면 최고점 카테고리
  useEffect(() => {
    if (!selected) { setExpandedCat(null); return; }
    const focus = selected.persisted?.focus?.[0];
    if (focus) {
      setExpandedCat(focus.representativeCategory || focus.category);
      return;
    }
    const best = RADAR_CATS.reduce((b, c) =>
      (selected.scores[c.key] as number) > (selected.scores[b.key] as number) ? c : b
    );
    setExpandedCat(best.key);
  }, [selected]);

  const handleDeepLink = useCallback((url: string) => {
    try {
      const u = new URL(url);
      if (u.host === "fortune" && u.pathname === "/detail") {
        const y = parseInt(u.searchParams.get("year") ?? "0");
        const m = parseInt(u.searchParams.get("month") ?? "0");
        const d = parseInt(u.searchParams.get("day") ?? "0");
        if (y && m && d) setPendingDay({ year: y, month: m, day: d });
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    App.getLaunchUrl().then(result => { if (result?.url) handleDeepLink(result.url); });
    const listenerPromise = App.addListener("appUrlOpen", ({ url }) => handleDeepLink(url));
    return () => { listenerPromise.then(h => h.remove()); };
  }, [handleDeepLink]);

  useEffect(() => {
    const listenerPromise = App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) {
        const now = new Date();
        const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        if (prevTodayStrRef.current !== current) {
          setResumeTick(t => t + 1);
        }

        (async () => {
          const can = await canScheduleExactAlarms();
          if (can) {
            await scheduleTodayNotifications();
          }
        })();
      }
    });
    return () => { listenerPromise.then(h => h.remove()); };
  }, []);

  // Android back button priority: eventInfo sheet → settings subview → settings → detail tab → exit
  useEffect(() => {
    const listenerPromise = App.addListener("backButton", () => {
      if (eventInfoKey !== null)   { setEventInfoKey(null); return; }
      if (settingsOpen) {
        if (settingsView === "noti") { setSettingsView("main"); return; }
        setSettingsOpen(false); return;
      }
      if (tab === "detail")        { setTab("calendar"); return; }
      App.exitApp();
    });
    return () => { listenerPromise.then(h => h.remove()); };
  }, [eventInfoKey, settingsOpen, settingsView, tab]);

  // Body scroll lock while event info sheet is open
  useEffect(() => {
    if (eventInfoKey !== null) {
      document.body.style.overflow = "hidden";
    }
    return () => { document.body.style.overflow = ""; };
  }, [eventInfoKey]);

  useEffect(() => {
    const handle = addDayRolloverListener(async () => {
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth() + 1;
      const d = now.getDate();
      const str = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const todayFortune = dataRef.current?.daily_fortunes.find(f => f.date === str);
      if (todayFortune) {
        hasScheduledTodayRef.current = false;
        await handleDayRollover(todayFortune, str);
        hasScheduledTodayRef.current = true;
        setSelected(todayFortune);
      } else {
        setYear(y);
        setMonth(m);
      }
    });
    return () => { handle.then(h => h.remove()); };
  }, []);

  useEffect(() => {
    if (!pendingDay) return;
    const u = getUser();
    if (!u) return;
    setYear(pendingDay.year);
    setMonth(pendingDay.month);
  }, [pendingDay]);

  useEffect(() => {
    if (!pendingDay || loading || !data) return;
    if (data.year === pendingDay.year && data.month === pendingDay.month) {
      const f = data.daily_fortunes[pendingDay.day - 1];
      if (f) { setSelected(f); setTab("detail"); }
      setPendingDay(null);
    }
  }, [pendingDay, loading, data]);

  const load = useCallback(async (y: number, m: number, u: SajuUser) => {
    setLoading(true);
    setSelected(null);
    setAdjPrevScore(null);
    setAdjNextScore(null);
    try {
      const result = await getMonthlyFortune(u, y, m);
      setData(result);

      // Persist notification-ready data for native Android scheduler, then trigger
      // native scheduleToday so first-launch alarms are set without waiting for next
      // app open or date rollover.
      loadNotificationSettings().then(settings =>
          saveMonthlyNotificationReadyData(result, settings)
              .then(async () => {
                await cleanupOldNotificationReadyData(result.year, result.month);
                await scheduleTodayNotifications();
              })
      ).catch(() => {});

      const now = new Date();
      if (y === now.getFullYear() && m === now.getMonth() + 1) {
        const todayFortune = result.daily_fortunes[now.getDate() - 1];
        if (todayFortune) {
          const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
          if (!hasScheduledTodayRef.current) {
            hasScheduledTodayRef.current = true;
            await handleDayRollover(todayFortune, dateStr);
          }
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) load(year, month, user);
  }, [year, month, user, load]);

  useEffect(() => {
    if (!user) return;

    const checkExactAlarmPermission = async () => {
      const can = await canScheduleExactAlarms();

      if (!can) {
        setShowExactAlarmGuide(true);
      }
    };

    checkExactAlarmPermission();
  }, [user]);

  // Sync selected to today on initial load and on midnight day change.
  // Relies on existing re-renders; no timer needed.
  useEffect(() => {
    if (loading || !data) {
      prevTodayStrRef.current = todayStr;
      return;
    }
    const dayChanged = prevTodayStrRef.current !== todayStr;
    prevTodayStrRef.current = todayStr;
    if (selected === null || dayChanged) {
      const f = data.daily_fortunes.find(d => d.date === todayStr);
      if (f) {
        console.log(`[MAIN] 📅 Selected today: ${f.date}, overall=${f.scores.overall}, persisted._v=${f.persisted?._v}, topStates=${f.persisted?.topStates.length ?? 0}`);
        setSelected(f);
      }
    }
    if (dayChanged) {
      const todayFortune = data.daily_fortunes.find(d => d.date === todayStr);
      if (!todayFortune) {
        setYear(todayYear);
        setMonth(todayMonth);
        return;
      }
      hasScheduledTodayRef.current = false;
      void (async () => {
        await handleDayRollover(todayFortune, todayStr);
        hasScheduledTodayRef.current = true;
      })();
    }
  }, [loading, data, selected, todayStr, resumeTick]);

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  const goToToday = () => {
    if (year === todayYear && month === todayMonth) {
      const f = data?.daily_fortunes[todayDate - 1];
      if (f) setSelected(f);
    } else {
      setYear(todayYear);
      setMonth(todayMonth);
    }
    setTab("detail");
  };

  const handleDayClick = (fortune: DailyFortune) => {
    console.log(`[MAIN] Day clicked: ${fortune.date}, focus=${fortune.persisted?.focus?.length ?? 0}, dailyHighlight=${fortune.persisted?.dailyHighlight ? 'exists' : 'null'}`);
    setSelected(fortune);
  };

  const openSettings = () => {
    setSettingsView("main");
    setSettingsOpen(true);
  };

  // Calendar grid
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const prevMonthDays = new Date(year, month - 1, 0).getDate();
  const isCurrentMonth = year === todayYear && month === todayMonth;

  type CalendarCell = {
    day: number;
    isCurrentMonth: boolean;
  };

  const cells: CalendarCell[] = [];

  // 이전 달
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({
      day: prevMonthDays - i,
      isCurrentMonth: false,
    });
  }

  // 현재 달
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      day: d,
      isCurrentMonth: true,
    });
  }

  // 다음 달
  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    cells.push({
      day: nextDay++,
      isCurrentMonth: false,
    });
  }

  // Highest/lowest score dates in the visible month
  const { maxScoreDates, minScoreDates } = useMemo(() => {
    if (!data) return { maxScoreDates: new Set<string>(), minScoreDates: new Set<string>() };
    const scores = data.daily_fortunes.map(f => f.scores.overall as number);
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);
    const maxSet = new Set(data.daily_fortunes.filter(f => (f.scores.overall as number) === maxScore).map(f => f.date));
    if (maxScore === minScore) return { maxScoreDates: maxSet, minScoreDates: new Set<string>() };
    const minSet = new Set(data.daily_fortunes.filter(f => (f.scores.overall as number) === minScore).map(f => f.date));
    return { maxScoreDates: maxSet, minScoreDates: minSet };
  }, [data]);

  // Selected date display
  const selectedDate   = selected
      ? (() => { const [y, m, d] = selected.date.split("-").map(Number); return new Date(y, m - 1, d); })()
      : null;
  const selectedDayStr = selectedDate
      ? `${selectedDate.getMonth() + 1}월 ${selectedDate.getDate()}일 (${DOW_KO[selectedDate.getDay()]})`
      : "";

  const navigateDay = useCallback((dir: 1 | -1) => {
    if (!selected) return;
    const [y, m, d] = selected.date.split("-").map(Number);
    const next = new Date(y, m - 1, d + dir);
    const nextYear  = next.getFullYear();
    const nextMonth = next.getMonth() + 1;
    const nextDate  = next.getDate();
    if (nextYear === year && nextMonth === month && data) {
      const f = data.daily_fortunes[nextDate - 1];
      if (f) setSelected(f);
    } else {
      setPendingDay({ year: nextYear, month: nextMonth, day: nextDate });
    }
  }, [selected, year, month, data]);

  // Now / best segments
  const isSelectedToday = selected?.date === todayStr;
  const bestSegment = selected?.timeSegments?.length
      ? selected.timeSegments.reduce((a, b) => b.score > a.score ? b : a)
      : null;
  const worstSegment = selected?.timeSegments?.length
      ? selected.timeSegments.reduce((a, b) => b.score < a.score ? b : a)
      : null;

  const nowSegStartHour = (() => {
    if (!selected?.timeSegments?.length) return null;
    const h = new Date().getHours();
    const seg = selected.timeSegments.find(s => s.startHour <= h && h < s.endHour);
    return seg?.startHour ?? selected.timeSegments[0].startHour;
  })();

  const effectiveSegHour = expandedSegs ?? nowSegStartHour;

  const plannedNotifications = useMemo<PlannedNotification[]>(() => {
    if (!selected) return [];
    return planNotifications(selected, selected.date);
  }, [selected]);



  useEffect(() => {
    if (!selected) { setScheduledHours(new Set()); return; }
    loadNotificationReadyHours(selected.date).then(setScheduledHours);
  }, [selected?.date]);

  const notifsBySegment = useMemo<Map<number, PlannedNotification[]>>(() => {
    const result = new Map<number, PlannedNotification[]>();
    if (!selected?.timeSegments) return result;
    const settings = {
      dailyEnabled:      notiDailyEnabled,
      eventStateEnabled: notiEventStateEnabled,
      dailyTime:         `${String(notiStart).padStart(2, "0")}:00`,
    };
    const filtered = applyNotificationSettings(plannedNotifications, settings, selected.date);
    for (const n of filtered) {
      const h = n.triggerTime.getHours();
      const seg = selected.timeSegments!.find(s => s.startHour <= h && h < s.endHour);
      if (seg) {
        if (!result.has(seg.startHour)) result.set(seg.startHour, []);
        result.get(seg.startHour)!.push(n);
      }
    }
    return result;
  }, [plannedNotifications, selected, notiDailyEnabled, notiEventStateEnabled, notiStart]);



const normalizedBirthDisplay = useMemo(() => {
    if (!user || user.birth_hour === undefined) return "시간 미입력";
    const nb = normalizeBirthDateTimeByRegion({
      year:     user.birth_year,
      month:    user.birth_month,
      day:      user.birth_day,
      hour:     user.birth_hour,
      minute:   user.birth_minute ?? 0,
      regionId: user.birth_region ?? "seoul",
    });
    const branch = getHourBranch(nb.hour);
    return `${nb.year}.${pad2(nb.month)}.${pad2(nb.day)} ${pad2(nb.hour)}:${pad2(nb.minute)} · ${branch}`;
  }, [user]);

  return (
      <div className={styles.container}>

        {/* ── Header ── */}
        <div className={styles.header}>
          <div className={styles.headerNav}>
            {tab === "calendar" ? (
                <>
                  <button className={styles.navBtn} onClick={prevMonth}>‹</button>
                  <span className={styles.headerTitle}>{year}년 {month}월</span>
                  <button className={styles.navBtn} onClick={nextMonth}>›</button>
                </>
            ) : (
                <>
                  <button className={styles.navBtn} onClick={() => navigateDay(-1)} disabled={!selected}>‹</button>
                  <span className={styles.headerTitle}>
                    {selectedDayStr || `${year}년 ${month}월`}
                  </span>
                  <button className={styles.navBtn} onClick={() => navigateDay(1)} disabled={!selected}>›</button>
                </>
            )}
          </div>
          <button className={styles.settingsBtn} onClick={openSettings} title="설정">⋮</button>
        </div>

        {/* ── Tab Bar ── */}
        <div className={styles.tabBar}>
          <button
              className={styles.todayBtn}
              onClick={goToToday}
              disabled={isSelectedToday}
          >오늘</button>
          <div className={styles.tabBtns}>
            <button
                className={`${styles.tabBtn} ${tab === "calendar" ? styles.tabBtnActive : ""}`}
                onClick={() => setTab("calendar")}
            >달력</button>
            <button
                className={`${styles.tabBtn} ${tab === "detail" ? styles.tabBtnActive : ""}`}
                onClick={() => setTab("detail")}
            >상세</button>
            <button
                className={`${styles.tabBtn} ${tab === "profile" ? styles.tabBtnActive : ""}`}
                onClick={() => setTab("profile")}
            >프로필</button>
          </div>
        </div>

        {/* ── 프로필 탭 ── */}
        {tab === "profile" && (
            <div className={styles.profileView}>
              {!profile ? (
                  <div className={styles.detailEmpty}>
                    <span className={styles.detailEmptyIcon}>👤</span>
                    <p>프로필 정보를 불러오는 중입니다</p>
                  </div>
              ) : (
                  <div className={styles.profileContent}>
                    <div className={styles.profileHeader}>
                      <div className={styles.profileTitle}>내 기본 프로필</div>
                      <div className={styles.profileSubtitle}>흐름 계산에 쓰이는 기본 정보예요</div>
                    </div>

                    <div className={styles.profileBody}>

                      {/* 출생정보 */}
                      <div className={styles.profileCard}>
                        <div className={styles.profileCardTitle}>출생정보</div>
                        <div className={styles.profileInfoGrid}>

                          {/* 생년월일 */}
                          <div className={styles.profileInfoRow}>
                            <span className={styles.profileInfoLabel}>생년월일</span>
                            <span className={styles.profileInfoValue}>
                              {profile.input.birthYear}.{pad2(profile.input.birthMonth)}.{pad2(profile.input.birthDay)}
                            </span>
                          </div>

                          {/* 성별 */}
                          <div className={styles.profileInfoRow}>
                            <span className={styles.profileInfoLabel}>성별</span>
                            <span className={styles.profileInfoValue}>{profile.input.gender === "M" ? "남성" : "여성"}</span>
                          </div>

                          {/* 시간 */}
                          <div className={styles.profileInfoRow}>
                            <span className={styles.profileInfoLabel}>시간</span>
                            <span className={styles.profileInfoValue}>
                              {user?.birth_hour === undefined
                                  ? "모름"
                                  : `${pad2(user.birth_hour)}:${user.birth_minute !== undefined ? pad2(user.birth_minute) : "모름"}`}
                            </span>
                          </div>

                          {/* 지역 ⓘ */}
                          <div className={styles.profileInfoRow}>
                            <span className={styles.profileInfoLabel}>
                              <span className={styles.infoIconWrap}>
                                지역
                                <button
                                    className={styles.infoBtn}
                                    onClick={() => setInfoTooltip(t => t === "region" ? null : "region")}
                                >i</button>
                              </span>
                            </span>
                            <span className={styles.profileInfoValue}>
                              {user?.birth_region
                                  ? getBirthRegionById(user.birth_region).name
                                  : "모름"}
                            </span>
                          </div>
                          {infoTooltip === "region" && (
                              <div className={styles.inlineInfoBox}>
                                출생 지역을 모르는 경우에는 서울 기준으로 계산됩니다.
                              </div>
                          )}

                          {/* 사주정보 ⓘ */}
                          <div className={styles.profileInfoRow} style={{ gridColumn: "1 / -1" }}>
                            <span className={styles.profileInfoLabel}>
                              <span className={styles.infoIconWrap}>
                                사주정보
                                <button
                                    className={styles.infoBtn}
                                    onClick={() => setInfoTooltip(t => t === "saju" ? null : "saju")}
                                >i</button>
                              </span>
                            </span>
                            <span className={`${styles.profileInfoValue} ${styles.sajuInfoValue}`}>
                              {normalizedBirthDisplay}
                            </span>
                          </div>
                          {infoTooltip === "saju" && (
                              <div className={styles.inlineInfoBox}>
                                사주정보는 입력한 출생 시간에 출생 지역의 태양시 보정을 반영한 값이에요.<br/>
                                <br/>
                                하루온도는 자시를 23:00~00:59로 보고, 23:00 이후는 다음 날 기준으로 계산합니다.<br/>
                                <br/>
                                출생 시간이 없으면 정오 기준으로 계산됩니다.<br/>
                                분이 없으면 00분 기준으로 계산됩니다.<br/>
                                지역이 없으면 서울 기준으로 계산됩니다.
                              </div>
                          )}

                          {/* 일간 */}
                          <div className={styles.profileInfoRow}>
                            <span className={styles.profileInfoLabel}>일간</span>
                            <span className={styles.profileInfoValue}>
                              {profile.saju.dayMaster} ({profile.saju.dayMasterElement}{profile.saju.dayMasterYinYang})
                            </span>
                          </div>

                          {/* 신살 */}
                          {(profile.saju.specialStars?.length ?? 0) > 0 && (
                              <div className={styles.profileInfoRow} style={{ gridColumn: "1 / -1", alignItems: "flex-start" }}>
                                <span className={styles.profileInfoLabel}>신살</span>
                                <div className={styles.sajuStarChips}>
                                  {(profile.saju.specialStars ?? []).map((star) => (
                                      <span key={star} className={styles.sajuStarChip}>{star}</span>
                                  ))}
                                </div>
                              </div>
                          )}
                        </div>
                      </div>

                      {/* 사주명식표 */}
                      <div className={styles.profileCard}>
                        <div className={styles.profileCardTitle}>사주명식표</div>
                        {(() => {
                          const PILLAR_ORDER = ["hour", "day", "month", "year"] as const;
                          return (
                              <table className={styles.sajuTable}>
                                <thead>
                                <tr className={styles.sajuTableHead}>
                                  <th className={styles.sajuRowLabelHead}></th>
                                  <th>시(時)</th>
                                  <th>일(日)</th>
                                  <th>월(月)</th>
                                  <th>년(年)</th>
                                </tr>
                                </thead>
                                <tbody className={styles.sajuTableBody}>
                                <tr>
                                  <td className={styles.sajuRowLabel}>천간</td>
                                  {PILLAR_ORDER.map(k => {
                                    const p = profile.saju.pillars[k];
                                    const isDay = k === "day";
                                    return (
                                        <td key={k}>
                                          <div
                                              className={`${styles.sajuGanziBox} ${isDay ? styles.sajuDayGanzi : ""}`}
                                              style={{
                                                color: getElementColor(p.stem),
                                                backgroundColor: `${getElementColor(p.stem)}22`,
                                              }}
                                          >
                                            {p.stem}
                                          </div>
                                          <div className={styles.sajuTenGod}>
                                            {isDay ? <span className={styles.dayStemBase}>일간</span> : p.stemTenGod}
                                          </div>
                                        </td>
                                    );
                                  })}
                                </tr>
                                <tr>
                                  <td className={styles.sajuRowLabel}>지지</td>
                                  {PILLAR_ORDER.map(k => {
                                    const p = profile.saju.pillars[k];
                                    return (
                                        <td key={k}>
                                          <div
                                              className={styles.sajuGanziBox}
                                              style={{
                                                color: getElementColor(p.branch),
                                                backgroundColor: `${getElementColor(p.branch)}22`,
                                              }}
                                          >
                                            {p.branch}
                                          </div>
                                          <div className={styles.sajuTenGod}>{p.branchTenGod}</div>
                                        </td>
                                    );
                                  })}
                                </tr>
                                <tr className={styles.sajuJijangRow}>
                                  <td className={styles.sajuRowLabel}>지장간</td>
                                  {PILLAR_ORDER.map(k => {
                                    const p = profile.saju.pillars[k];
                                    return (
                                        <td key={k} className={styles.sajuJijangCell}>
                                          <div className={styles.sajuJijangInner}>
                                            {(p.hiddenStems?.length ?? 0) > 0 ? (
                                                p.hiddenStems.map((stem, idx) => {
                                                  const color = getElementColor(stem);
                                                  return (
                                                      <span
                                                          key={idx}
                                                          className={styles.sajuJijangStem}
                                                          style={{
                                                            color,
                                                            backgroundColor: `${color}22`,
                                                          }}
                                                      >
                                                {stem}
                                              </span>
                                                  );
                                                })
                                            ) : (
                                                <span style={{ color: "var(--text-dim)" }}>–</span>
                                            )}
                                          </div>
                                        </td>
                                    );
                                  })}
                                </tr>
                                </tbody>
                              </table>
                          );
                        })()}
                      </div>

                      {/* 오행 분포 */}
                      {(() => {
                        const elementCounts = profile.elementCounts ?? {
                          wood:  profile.elements.wood,
                          fire:  profile.elements.fire,
                          earth: profile.elements.earth,
                          metal: profile.elements.metal,
                          water: profile.elements.water,
                        };
                        const items = [
                          ["목", elementCounts.wood,  "#5aad6e"],
                          ["화", elementCounts.fire,  "#e06060"],
                          ["토", elementCounts.earth, "#c9912a"],
                          ["금", elementCounts.metal, "#8f9aa6"],
                          ["수", elementCounts.water, "#5577bb"],
                        ] as const;
                        const maxCount = Math.max(...items.map(([, count]) => count), 1);

                        return (
                            <div className={styles.profileCard}>
                              <div className={styles.profileCardHeader}>
                                <div className={styles.profileCardTitle}>오행 구성</div>
                                <div className={styles.profileCardSub}>
                                  천간 · 지지 · 지장간 기준
                                </div>
                              </div>

                              <div className={styles.elemBars}>
                                {items.map(([label, count, color], i) => (
                                    <div key={label} className={styles.elemBarRow}>
                                      <span className={styles.elemBarLabel}>{label}</span>
                                      <div className={styles.elemBarTrack}>
                                        <div
                                            className={styles.elemBarFill}
                                            style={{
                                              width: `${(count / maxCount) * 100}%`,
                                              background: color,
                                              animationDelay: `${i * 50}ms`,
                                            }}
                                        />
                                      </div>
                                      <span className={styles.elemBarVal}>{count}</span>
                                    </div>
                                ))}
                              </div>
                            </div>
                        );
                      })()}

                      {/* 자미두수 */}
                      <div className={styles.profileCard}>
                        <div className={styles.profileCardTitle}>자미두수</div>
                        <div className={styles.ziweiMetaRow}>
                          <div className={styles.ziweiMetaItem}>
                            <span className={styles.profileInfoLabel}>명궁</span>
                            <span className={styles.profileInfoValue}>{profile.ziwei.mingGongBranch}</span>
                          </div>
                          <div className={styles.ziweiMetaItem}>
                            <span className={styles.profileInfoLabel}>오행국</span>
                            <span className={styles.profileInfoValue}>{profile.ziwei.wuXingJu}</span>
                          </div>
                        </div>
                        <div className={styles.ziweiStarList}>
                          {profile.ziwei.mingGongStars.map(s => (
                              <span
                                  key={s.name}
                                  className={`${styles.ziweiStarChip} ${styles.ziweiStarChipMain}`}
                                  title={[s.brightness, s.siHua].filter(Boolean).join(" ")}
                              >
                              {s.name}{s.siHua ? ` ${s.siHua}` : ""}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* 별자리 */}
                      <div className={styles.profileCard}>
                        <div className={styles.profileCardTitle}>별자리</div>
                        <div className={styles.astroGrid}>
                          {[
                            { label: "태양", sign: profile.astrology.sunSign },
                            { label: "달",   sign: profile.astrology.moonSign },
                            { label: "수성", sign: profile.astrology.mercurySign },
                            { label: "금성", sign: profile.astrology.venusSign },
                            { label: "화성", sign: profile.astrology.marsSign },
                            { label: "목성", sign: profile.astrology.jupiterSign },
                            { label: "토성", sign: profile.astrology.saturnSign },
                          ].map(({ label, sign }) => (
                              <div key={label} className={styles.astroRow}>
                                <span className={styles.astroLabel}>{label}</span>
                                <span className={styles.astroSign}>{sign}</span>
                              </div>
                          ))}
                          <div className={`${styles.astroRow} ${styles.astroRowWide}`}>
                            <span className={styles.astroLabel}>금성 역행</span>
                            <span className={styles.astroSign}>
                              {profile.astrology.venusRetrograde ? "예" : "아니오"}
                            </span>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
              )}
            </div>
        )}

        {/* ── 달력 탭 ── */}
        {tab === "calendar" && (
            <div className={styles.calendarView}>
              {data && (
                <div className={styles.monthInfoBar}>
                  {data.monthly_palace && (
                    <span className={styles.monthInfoBadge}>
                      활성궁&nbsp;<strong>{data.monthly_palace}</strong>
                    </span>
                  )}
                  {data.monthly_flow_type && (
                    <span className={styles.monthInfoBadge}>
                      흐름&nbsp;<strong>{data.monthly_flow_type}</strong>
                    </span>
                  )}
                </div>
              )}
              <div className={styles.calendarHeader}>
                {DAY_NAMES.map((n, i) => (
                    <div key={n} className={`${styles.dayName} ${i === 0 ? styles["dayName-sun"] : i === 6 ? styles["dayName-sat"] : ""}`}>
                      {n}
                    </div>
                ))}
              </div>
              {loading ? (
                  <div className={styles.loading}>흐름 계산 중...</div>
              ) : (
                  <div className={styles.calendarGrid}>
                    {cells.map((cell, idx) => {
                      const { day, isCurrentMonth: cellCurrentMonth } = cell;
                      const fortune = cellCurrentMonth ? data?.daily_fortunes[day - 1] : null;
                      const dow = idx % 7;
                      const isSelected = !!(cellCurrentMonth && selected?.date === fortune?.date);
                      const isToday = cellCurrentMonth && isCurrentMonth && day === todayDate;

                      return (
                          <div
                              key={`${cellCurrentMonth ? "cur" : "other"}-${idx}-${day}`}
                              className={`
                      ${styles.cell}
                      ${!cellCurrentMonth ? styles.cellDim : ""}
                      ${isSelected ? styles.cellSelected : ""}
                      ${isToday && !isSelected ? styles.cellToday : ""}
                    `}
                              onClick={() => cellCurrentMonth && fortune && handleDayClick(fortune)}
                          >
                    <span className={`${styles.solarDay} ${
                        isToday ? styles.todayCircle
                            : dow === 0 ? styles["solarDay-sun"]
                                : dow === 6 ? styles["solarDay-sat"] : ""
                    }`}>
                      {day}
                    </span>
                            {fortune && (
                                <>
                                  <span className={styles.lunarDay}>{fortune.lunar_date}</span>
                                  <span className={`${styles.scoreNum} ${getScoreClass(fortune.scores.overall)} ${
                              maxScoreDates.has(fortune.date) ? styles["scoreNum--best"] :
                              minScoreDates.has(fortune.date) ? styles["scoreNum--worst"] : ""
                            }`}>
                              {fortune.scores.overall}
                            </span>
                                </>
                            )}
                          </div>
                      );
                    })}
                  </div>
              )}

              {/* ── Selected date preview card ── */}
              {selected && !loading && (
                  <div className={styles.previewCard} onClick={() => setTab("detail")}>
                    <div className={styles.previewLeft}>
                      <div className={styles.previewDate}>{selectedDayStr}</div>
                      <div className={styles.previewLunar}>음력 {selected.lunar_date}</div>
                      <div className={styles.previewFlowBlock}>
                        {(() => {
                          // 우선순위: 1. Focus → 2. Daily Highlight → 3. Top1/Bottom1 Fallback

                          // CASE 1: Focus 존재
                          if (selected.persisted?.focus && selected.persisted.focus.length > 0) {
                            const focus = selected.persisted.focus[0]; // 첫 번째 focus만 프리뷰 표시

                            // Source keys 처리 (클릭 가능한 칩으로 렌더링)
                            // isKeyRegistered로 등록 여부 확인, unknown.* 제외
                            const sourceKeys = focus.sourceKeys || [];
                            const validSourceKeys = sourceKeys.filter(key => {
                              if (key.startsWith("unknown.")) return false;
                              return isKeyRegistered(key);
                            });

                            // Category 라벨
                            const catLabel = RADAR_CATS.find(c => c.key === focus.category)?.label || focus.category;

                            return (
                              <div className={styles.previewFlowSingle}>
                                <span className={styles.previewFlowLabel}>오늘의 포커스</span>
                                <span className={styles.previewFlowMain}>{focus.label}</span>
                                {validSourceKeys.length > 0 && (
                                  <div className={styles.previewFlowChips}>
                                    {validSourceKeys.map((key, idx) => {
                                      const dispLabel = safeResolveLabel(key);
                                      const hasInfo = safeResolveInfo(key) !== null;
                                      return (
                                        <span key={`${key}-${idx}`} style={{ display: "inline-flex", alignItems: "center", gap: "0.2rem" }}>
                                          {idx > 0 && <span style={{ color: "var(--text-dim)", fontSize: "0.6rem" }}>+</span>}
                                          <span
                                            className={[
                                              styles.reasonChip,
                                              styles.reasonChipSmall,
                                              styles.reasonChipFocus,
                                              hasInfo ? styles.reasonChipClickable : "",
                                            ].filter(Boolean).join(" ")}
                                            onClick={hasInfo ? () => setEventInfoKey(key) : undefined}
                                          >
                                            {dispLabel}
                                          </span>
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}
                                {(() => {
                                  const arrow = getFocusCategoryArrow(focus.polarity);
                                  const polClass = focus.polarity === "mixed" ? styles.focusMixed
                                    : focus.polarity === "negative" ? styles.focusNegative
                                    : styles.focusPositive;
                                  return (
                                    <span className={`${styles.previewFlowCategory} ${polClass}`}>
                                      {catLabel}{arrow ? ` ${arrow}` : ""}
                                    </span>
                                  );
                                })()}
                              </div>
                            );
                          }

                          // CASE 2: Daily Highlight 존재
                          if (selected.persisted?.dailyHighlight) {
                            const highlight = selected.persisted.dailyHighlight;
                            const catLabel = RADAR_CATS.find(c => c.key === highlight.category)?.label || highlight.category;
                            const arrow = highlight.direction === "up" ? "↑" : "↓";

                            return (
                              <div className={styles.previewFlowSingle}>
                                <span className={styles.previewFlowLabel}>오늘의 변화</span>
                                <span className={styles.previewFlowMain}>{catLabel} {arrow}</span>
                              </div>
                            );
                          }

                          // CASE 3: Fallback (기존 로직)
                          const peak = RADAR_CATS.reduce((b, c) =>
                            displayCatScore(selected, c.key) > displayCatScore(selected, b.key) ? c : b
                          );
                          const low = RADAR_CATS.reduce((w, c) =>
                            displayCatScore(selected, c.key) < displayCatScore(selected, w.key) ? c : w
                          );
                          const peakScore = displayCatScore(selected, peak.key);
                          const lowScore  = displayCatScore(selected, low.key);
                          const peakChip  = selected.persisted?.categoryHighlights?.[peak.key]?.topEvents?.[0];
                          const lowChip   = selected.persisted?.categoryHighlights?.[low.key]?.topEvents?.[0];

                          return (
                            <>
                              <div className={styles.previewFlowRow}>
                                <span className={styles.previewFlowLabel}>높은 흐름</span>
                                <span className={`${styles.previewFlowCat} ${getScoreClass(peakScore)}`}>
                                  {peak.label} {peakScore}
                                </span>
                                {peakChip && (() => {
                                  const dispLabel = safeResolveLabel(peakChip);
                                  const hasInfo = safeResolveInfo(peakChip) !== null;
                                  return (
                                    <span
                                      className={[
                                        styles.previewFlowChip,
                                        hasInfo ? styles.reasonChipClickable : "",
                                      ].filter(Boolean).join(" ")}
                                      onClick={hasInfo ? (e) => { e.stopPropagation(); setEventInfoKey(peakChip); } : undefined}
                                    >
                                      {dispLabel}
                                    </span>
                                  );
                                })()}
                              </div>
                              <div className={styles.previewFlowRow}>
                                <span className={styles.previewFlowLabel}>낮은 흐름</span>
                                <span className={`${styles.previewFlowCat} ${getScoreClass(lowScore)}`}>
                                  {low.label} {lowScore}
                                </span>
                                {lowChip && (() => {
                                  const dispLabel = safeResolveLabel(lowChip);
                                  const hasInfo = safeResolveInfo(lowChip) !== null;
                                  return (
                                    <span
                                      className={[
                                        styles.previewFlowChip,
                                        hasInfo ? styles.reasonChipClickable : "",
                                      ].filter(Boolean).join(" ")}
                                      onClick={hasInfo ? (e) => { e.stopPropagation(); setEventInfoKey(lowChip); } : undefined}
                                    >
                                      {dispLabel}
                                    </span>
                                  );
                                })()}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                    <div className={styles.previewRight}>
                <span className={`${styles.previewScore} ${getScoreClass(selected.scores.overall)}`}>
                  {selected.scores.overall}
                </span>
                      <span className={getBadgeClass(selected.badge)}>{getBadgeLabel(selected.badge)}</span>
                      <button className={styles.previewBtn} onClick={e => { e.stopPropagation(); setTab("detail"); }}>
                        자세히 보기
                      </button>
                    </div>
                  </div>
              )}
            </div>
        )}

        {/* ── 상세 탭 ── */}
        {tab === "detail" && (
            <div className={styles.detailView}>
              {!selected ? (
                  <div className={styles.detailEmpty}>
                    <span className={styles.detailEmptyIcon}>📅</span>
                    <p>달력에서 날짜를 선택해 보세요</p>
                    <button className={styles.detailEmptyBtn} onClick={() => setTab("calendar")}>
                      달력으로 이동
                    </button>
                  </div>
              ) : (
                  <>
                    {/* ── Hero: date + score + badge ── */}
                    <div className={styles.heroCard}>
                      <div className={styles.heroScoreRow}>
                  <span className={`${styles.heroScoreNum} ${getScoreClass(selected.scores.overall)}`}>
                    {selected.scores.overall}
                  </span>
                        <div className={styles.heroScoreMeta}>
                          <span className={getBadgeClass(selected.badge)}>{getBadgeLabel(selected.badge)}</span>
                          <span className={styles.heroLunar}>음력 {selected.lunar_date}</span>
                        </div>
                      </div>
                      <div className={styles.heroScoreDivider}
                           style={{ background: scoreColor(selected.scores.overall as number) }} />
                      {data && (() => {
                        const fortunes = data.daily_fortunes;
                        const idx      = fortunes.findIndex(f => f.date === selected.date);
                        if (idx === -1) return null;

                        const cur  = fortunes[idx].scores.overall as number;
                        const prev = idx > 0
                            ? fortunes[idx - 1].scores.overall as number
                            : adjPrevScore;
                        const next = idx < fortunes.length - 1
                            ? fortunes[idx + 1].scores.overall as number
                            : adjNextScore;

                        const allScores = fortunes.map(f => f.scores.overall as number).sort((a, b) => b - a);
                        const rank      = allScores.indexOf(cur);
                        const total     = allScores.length;

                        const prevDiff = prev !== null ? cur - prev : null;
                        const nextDiff = next !== null ? cur - next : null;

                        const fmtDiff = (d: number | null) =>
                            d === null ? "—"
                          : d > 0     ? `+${d}`
                          : d === 0   ? "±0"
                          : `${d}`;

                        const navToPrev = () => {
                          if (idx > 0) {
                            setSelected(fortunes[idx - 1]);
                          } else {
                            const prevM = month === 1 ? 12 : month - 1;
                            const prevY = month === 1 ? year - 1 : year;
                            const lastDay = new Date(prevY, prevM, 0).getDate();
                            setPendingDay({ year: prevY, month: prevM, day: lastDay });
                          }
                        };

                        const navToNext = () => {
                          if (idx < fortunes.length - 1) {
                            setSelected(fortunes[idx + 1]);
                          } else {
                            const nextM = month === 12 ? 1 : month + 1;
                            const nextY = month === 12 ? year + 1 : year;
                            setPendingDay({ year: nextY, month: nextM, day: 1 });
                          }
                        };

                        return (
                          <div className={styles.daySummaryRow}>
                            <div className={`${styles.daySummaryCell} ${styles.daySummaryCellNav}`} onClick={navToPrev}>
                              <span className={styles.daySummaryCellLabel}>전날 대비</span>
                              <span className={`${styles.daySummaryCellVal} ${prevDiff !== null && prevDiff > 0 ? styles.daySummaryPos : prevDiff !== null && prevDiff < 0 ? styles.daySummaryNeg : styles.daySummaryNeutral}`}>
                                {fmtDiff(prevDiff)}
                              </span>
                            </div>
                            <div className={styles.daySummarySep} />
                            <div className={styles.daySummaryCell}>
                              <span className={styles.daySummaryCellLabel}>이번 달에서의 위치</span>
                              <span className={`${styles.daySummaryCellVal} ${rank + 1 <= Math.ceil(total / 3) ? styles.daySummaryPos : rank + 1 >= Math.ceil(total * 2 / 3) ? styles.daySummaryNeg : styles.daySummaryNeutral}`}>
                                {rank + 1}/{total}일
                              </span>
                            </div>
                            <div className={styles.daySummarySep} />
                            <div className={`${styles.daySummaryCell} ${styles.daySummaryCellNav}`} onClick={navToNext}>
                              <span className={styles.daySummaryCellLabel}>다음날 대비</span>
                              <span className={`${styles.daySummaryCellVal} ${nextDiff !== null && nextDiff > 0 ? styles.daySummaryPos : nextDiff !== null && nextDiff < 0 ? styles.daySummaryNeg : styles.daySummaryNeutral}`}>
                                {fmtDiff(nextDiff)}
                              </span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                    {/* ── Focus & Daily Highlight ── */}
                    {(selected.persisted?.focus?.length || selected.persisted?.dailyHighlight) && (
                      <div className={styles.highlightSection}>
                        {/* Focus */}
                        {selected.persisted?.focus && selected.persisted.focus.length > 0 && (
                          <div className={styles.highlightCard}>
                            <span className={styles.highlightLabel}>오늘의 포커스</span>
                            <span className={styles.highlightMain}>{selected.persisted.focus[0].label}</span>
                            {(() => {
                              const focus = selected.persisted.focus[0];
                              const sourceKeys = focus.sourceKeys || [];
                              const validSourceKeys = sourceKeys.filter(key => {
                                if (key.startsWith("unknown.")) return false;
                                return isKeyRegistered(key);
                              });

                              if (validSourceKeys.length === 0) return null;

                              return (
                                <div className={styles.highlightChips}>
                                  {validSourceKeys.map((key, idx) => {
                                    const dispLabel = safeResolveLabel(key);
                                    const hasInfo = safeResolveInfo(key) !== null;
                                    return (
                                      <span key={`${key}-${idx}`} style={{ display: "inline-flex", alignItems: "center", gap: "0.2rem" }}>
                                        {idx > 0 && <span style={{ color: "var(--text-dim)", fontSize: "0.6rem" }}>+</span>}
                                        <span
                                          className={[
                                            styles.reasonChip,
                                            styles.reasonChipSmall,
                                            styles.reasonChipFocus,
                                            hasInfo ? styles.reasonChipClickable : "",
                                          ].filter(Boolean).join(" ")}
                                          onClick={hasInfo ? () => setEventInfoKey(key) : undefined}
                                        >
                                          {dispLabel}
                                        </span>
                                      </span>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                            {(() => {
                              const focus = selected.persisted!.focus![0];
                              const repCat = focus.representativeCategory || focus.category;
                              const catLabel = RADAR_CATS.find(c => c.key === repCat)?.label || repCat;
                              const arrow = getFocusCategoryArrow(focus.polarity);
                              const polClass = focus.polarity === "mixed" ? styles.focusMixed
                                : focus.polarity === "negative" ? styles.focusNegative
                                : styles.focusPositive;
                              return (
                                <span className={`${styles.previewFlowCategory} ${polClass}`}>
                                  {catLabel}{arrow ? ` ${arrow}` : ""}
                                </span>
                              );
                            })()}
                          </div>
                        )}

                        {/* Daily Highlight: Focus가 있으면 표시하지 않음 (Focus 우선) */}
                        {!selected.persisted?.focus?.length && selected.persisted?.dailyHighlight && (
                          <div className={styles.highlightCard}>
                            <span className={styles.highlightLabel}>오늘의 변화</span>
                            <span className={styles.highlightMain}>
                              {RADAR_CATS.find(c => c.key === selected.persisted!.dailyHighlight!.category)?.label || selected.persisted.dailyHighlight.category}
                              {" "}
                              {selected.persisted.dailyHighlight.direction === "up" ? "↑" : "↓"}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── 오늘의 흐름 요소 ── */}
                    {(() => {
                      const flowKeys = buildFlowElementKeys(selected);
                      if (flowKeys.length === 0) return null;
                      return (
                        <div className={styles.flowElemCard}>
                          <span className={styles.flowElemTitle}>오늘의 흐름 요소</span>
                          <span className={styles.flowElemSub}>오늘 흐름에 영향을 준 핵심 요소들</span>
                          <div className={styles.flowElemChips}>
                            {flowKeys.map((key, i) => {
                              const dispLabel = safeResolveLabel(key);
                              const hasInfo = safeResolveInfo(key) !== null;
                              return (
                                <span
                                  key={`${key}-${i}`}
                                  className={[
                                    styles.reasonChip,
                                    hasInfo ? styles.reasonChipClickable : "",
                                  ].filter(Boolean).join(" ")}
                                  onClick={hasInfo ? () => setEventInfoKey(key) : undefined}
                                >
                                  {dispLabel}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* ── 분석 영역 공통 안내 ── */}
                    <p className={styles.analysisHint}>흐름을 만든 요소들 중,{" "}눈여겨볼 만한 내용들만 정리해봤어요.</p>


                    {/* ── 카테고리 바 (expandable) ── */}
                    <div className={styles.catBarsSection}>
                      <p className={styles.catBarsSectionHeader}>카테고리별 점수</p>
                      {(() => {
                        // 표시된 Focus(첫 번째)의 sourceKeys — 카테고리 driver 강조/강제 포함 판정용
                        // 노출 불가 키(unknown.*, 미등록)는 제외 (Focus 카드와 동일 기준)
                        const displayedFocus = selected.persisted?.focus?.[0];
                        const focusSourceKeys = (displayedFocus?.sourceKeys ?? []).filter(k =>
                          !k.startsWith("unknown.") && isKeyRegistered(k)
                        );
                        const focusRepCat = displayedFocus
                          ? (displayedFocus.representativeCategory || displayedFocus.category)
                          : null;
                        return RADAR_CATS.map(({ key, label }, i) => {
                        const v          = displayCatScore(selected, key);
                        const isExpanded = expandedCat === key;
                        const catEvents  = selected.persisted?.categoryHighlights?.[key]?.topEvents ?? [];
                        // 대표 카테고리: Focus source를 강제 포함 (우선 배치, 총 3개 유지)
                        // 다른 카테고리: Focus source 전체가 driver에 포함될 때만 강조 (일부만 존재하면 강조 금지)
                        const isRepCat = focusRepCat === key && focusSourceKeys.length > 0;
                        const focusComplete = isRepCat || (focusSourceKeys.length > 0
                          && focusSourceKeys.every(sk => catEvents.includes(sk)));
                        const catChips = isRepCat
                          ? [...focusSourceKeys, ...catEvents.filter(ev => !focusSourceKeys.includes(ev))].slice(0, 3)
                          : catEvents;
                        return (
                          <div key={key} className={styles.catBarRow}>
                            <div
                              className={styles.catBarHeader}
                              onClick={() => setExpandedCat(isExpanded ? null : key)}
                            >
                              <span className={styles.catBarLabel}>{label}</span>
                              <span className={styles.catBarVal} style={{ color: scoreColor(v) }}>{v}</span>
                              <div className={styles.catBarTrack}>
                                <div
                                  className={styles.catBarFill}
                                  style={{ width: `${v}%`, animationDelay: `${i * 50}ms`, background: scoreColor(v) }}
                                />
                              </div>
                              <span className={styles.catBarChevron}>{isExpanded ? "▾" : "▸"}</span>
                            </div>
                            {isExpanded && (
                              <div className={styles.catBarExpanded}>
                                {catChips.length > 0 ? (
                                  <div className={styles.catBarChips}>
                                    {catChips.map((evKey, j) => {
                                      const dispLabel = safeResolveLabel(evKey);
                                      const hasInfo   = safeResolveInfo(evKey) !== null;
                                      const isFocusSource = focusComplete && focusSourceKeys.includes(evKey);
                                      return (
                                        <span
                                          key={`${evKey}-${j}`}
                                          className={[
                                            styles.reasonChip,
                                            isFocusSource ? styles.reasonChipFocus : "",
                                            hasInfo ? styles.reasonChipClickable : "",
                                          ].filter(Boolean).join(" ")}
                                          onClick={hasInfo ? () => setEventInfoKey(evKey) : undefined}
                                        >
                                          {dispLabel}
                                        </span>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <span className={styles.catBarNoData}>눈에 띄게 크게 작용한 요소는 잘 보이지 않아요.</span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                        });
                      })()}
                    </div>

                    {/* ── 시간대 흐름 ── */}
                    {selected.timeSegments && selected.timeSegments.length > 0 && (
                        <div className={styles.segmentCard}>
                          <p className={styles.segmentCardHeader}>시간대 흐름</p>
                          <SegmentClock
                            segments={selected.timeSegments}
                            selectedHour={effectiveSegHour}
                            onSelect={(h) => setExpandedSegs(h)}
                            bestStartHour={bestSegment?.startHour ?? undefined}
                            worstStartHour={
                              worstSegment?.startHour !== bestSegment?.startHour
                                ? (worstSegment?.startHour ?? undefined)
                                : undefined
                            }
                            overallScore={selected.scores.overall}
                          />
                          {(() => {
                            const seg = selected.timeSegments!.find(s => s.startHour === effectiveSegHour) ?? selected.timeSegments![0];
                            const segIdx = selected.timeSegments!.findIndex(s => s.startHour === seg.startHour);
                            const prevSeg = segIdx > 0 ? selected.timeSegments![segIdx - 1] : null;
                            const delta = prevSeg !== null ? seg.score - prevSeg.score : null;
                            const segNotifs = (notifsBySegment.get(seg.startHour) ?? []).slice(0, 2);
                            const fmtH = (h: number) => String(h).padStart(2, "0");
                            const topEventKeys = (seg.topEvents ?? []).slice(0, 2);
                            const isBest = seg.startHour === bestSegment?.startHour;
                            const isWorst = seg.startHour === worstSegment?.startHour && !isBest;
                            return (
                              <div className={styles.segmentDetail}>
                                <div className={styles.segmentDetailHeader}>
                                  <span className={styles.segmentTimeRange}>
                                    {fmtH(seg.startHour)}:00 – {fmtH(seg.endHour)}:00
                                  </span>
                                  <span className={styles.segmentDetailScore} style={{ color: scoreColor(seg.score) }}>
                                    {seg.score}점
                                  </span>
                                </div>
                                {(isBest || isWorst || (delta !== null && delta !== 0)) && (
                                  <div className={styles.segmentDetailMeta}>
                                    {isBest && <span className={styles.segmentBadgeBest}>최고</span>}
                                    {isWorst && <span className={styles.segmentBadgeWorst}>최저</span>}
                                    {delta !== null && delta !== 0 && (
                                      <span className={delta > 0 ? styles.segmentDeltaRise : styles.segmentDeltaDrop}>
                                        {delta > 0 ? "▲" : "▼"} {Math.abs(delta)}
                                      </span>
                                    )}
                                  </div>
                                )}
                                <div className={styles.segmentTopChips}>
                                  {topEventKeys.length > 0 ? (
                                    topEventKeys.map((evKey, j) => {
                                      const dispLabel = safeResolveLabel(evKey);
                                      const hasInfo   = safeResolveInfo(evKey) !== null;
                                                                            return (
                                        <span
                                          key={`seg-ev-${j}`}
                                          className={[
                                            styles.reasonChip,
                                            hasInfo ? styles.reasonChipClickable : "",
                                          ].filter(Boolean).join(" ")}
                                          onClick={hasInfo ? () => setEventInfoKey(evKey) : undefined}
                                        >
                                          {dispLabel}
                                        </span>
                                      );
                                    })
                                  ) : (
                                    <span className={styles.segmentNoEvents}>눈에 띄게 크게 작용한 요소는 잘 보이지 않아요.</span>
                                  )}
                                </div>
                                {segNotifs.length > 0 && (
                                  <div className={styles.segmentNotifSection}>
                                    {segNotifs.map((n, i) => {
                                      const msg = generateNotificationMessage(n, "L2");
                                      const body = msg.body || msg.title;
                                      const th = String(n.triggerTime.getHours()).padStart(2, "0");
                                      const tm = String(n.triggerTime.getMinutes()).padStart(2, "0");
                                      return (
                                        <div key={i} className={styles.segmentNotifItem}>
                                          <span className={styles.segmentNotifTime}>{th}:{tm}</span>
                                          <span className={styles.segmentNotifBody}>{body}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                    )}

                                        {/* ── 이 날의 포인트 ── */}
                    <div className={styles.detailSection}>
                      <div className={styles.sectionTitle}>이 날의 포인트</div>
                      <div className={styles.todoRow}>
                        <div className={styles.todoCol}>
                          <div className={styles.todoTitle}>🟢</div>
                          <ul className={styles.todoList}>
                            {selected.todos.do_list.map((item, i) => (
                                <li key={i} className={styles.todoItem}>{item}</li>
                            ))}
                          </ul>
                        </div>
                        <div className={styles.todoCol}>
                          <div className={`${styles.todoTitle} ${styles.todoTitleCaution}`}>🟡</div>
                          <ul className={styles.todoList}>
                            {selected.todos.dont_list.map((item, i) => (
                                <li key={i} className={`${styles.todoItem} ${styles.dontItem}`}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* ── 오늘의 흐름 ── */}
                    <div className={styles.detailSection}>
                      <div className={styles.sectionTitle}>오늘의 흐름</div>

                      {/* 빈 상태 + 버튼 */}
                      {!aiResult && !aiLoading && (
                        <>
                          <p className={styles.flowEmptyHint}>
                            오늘 흐름을 조금 더 자세히 볼 수 있어요.
                          </p>
                          <button
                            className={styles.flowBtn}
                            disabled={batchRunning}
                            onClick={async () => {
                              setAiLoading(true);
                              try {
                                const monthCtx = data ? {
                                  displayScores: data.daily_fortunes.map(f => f.scores.overall as number),
                                  flowType: data.monthly_flow_type,
                                  palace:   data.monthly_palace,
                                } : undefined;
                                const v2Result = buildAiDailyRequestV2(selected, monthCtx);
                                console.log(`[AI] V2 Request: topEvents=${v2Result.request.topEvents.length}, topStates=${v2Result.request.topStates.length}, categoryHighlights=${Object.keys(v2Result.request.categoryHighlights).length}, monthlyPosition=${!!v2Result.request.monthlyPosition}, dailyCompare=${!!v2Result.request.dailyCompare}, keyMoment=${!!v2Result.request.keyMoment}`);
                                const { content } = await generateDailyInterpretationFull(v2Result.request as any);
                                const clean = content.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
                                try {
                                  const parsed = JSON.parse(clean);
                                  setAiResult({
                                    subtitle: typeof parsed.subtitle === "string" ? parsed.subtitle : "",
                                    summary:  typeof parsed.summary  === "string" ? parsed.summary  : clean,
                                  });
                                } catch {
                                  setAiResult({ subtitle: "", summary: clean });
                                }
                              } catch (err) {
                                const msg = err instanceof Error ? err.message : String(err);
                                setAiResult({ subtitle: "", summary: `오류가 발생했어요.\n\n${msg}` });
                              } finally {
                                setAiLoading(false);
                              }
                            }}
                          >
                            자세히 풀어보기
                          </button>
                        </>
                      )}

                      {/* 로딩 */}
                      {aiLoading && (
                        <p className={styles.flowLoading}>오늘의 흐름을 정리하고 있어요...</p>
                      )}

                      {/* 결과 */}
                      {aiResult && (
                        <div>
                          {aiResult.subtitle !== "" && (
                            <p className={styles.flowSubtitle}>{aiResult.subtitle}</p>
                          )}
                          <div className={styles.flowSummary}>
                            {aiResult.summary.split(/\n\n+/).map((para, i) => (
                              <p key={i}>{para.replace(/\n/g, " ").trim()}</p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ── 한달 AI 해석 배치 ── */}
                    <div className={styles.detailSection}>
                      {!batchRunning && !batchResultKey && (
                        <button
                          disabled={aiLoading || !data}
                          style={{
                            width: "100%",
                            padding: "0.7rem",
                            border: "1px solid var(--border)",
                            borderRadius: "0.5rem",
                            background: "var(--surface)",
                            color: (aiLoading || !data) ? "var(--text-muted)" : "var(--text-main)",
                            fontSize: "0.9rem",
                            cursor: (aiLoading || !data) ? "not-allowed" : "pointer",
                          }}
                          onClick={async () => {
                            if (!selected || !data) return;
                            const [y, m] = selected.date.split("-").map(Number);
                            const mm = String(m).padStart(2, "0");
                            const prefix = `${y}-${mm}`;
                            const fortunes = data.daily_fortunes.filter(f => f.date.startsWith(prefix));
                            const total = fortunes.length;
                            if (total === 0) return;

                            setBatchRunning(true);
                            setBatchProgress(`0/${total} 준비 중…`);
                            setBatchResultKey(null);

                            const batchMonthCtx = {
                              displayScores: data.daily_fortunes.map(f => f.scores.overall as number),
                              flowType: data.monthly_flow_type,
                              palace:   data.monthly_palace,
                            };

                            const days: Array<{
                              date: string;
                              request: object;
                              response: string;
                              usage: { input: number; output: number; total: number } | null;
                            }> = [];
                            let sumInput = 0, sumOutput = 0, sumTotal = 0;

                            for (let i = 0; i < fortunes.length; i++) {
                              const fortune = fortunes[i];
                              setBatchProgress(`${i + 1}/${total} 처리 중… (${fortune.date})`);
                              try {
                                const v2Result = buildAiDailyRequestV2(fortune, batchMonthCtx);
                                console.log(`[AI-BATCH] ${fortune.date} V2: topEvents=${v2Result.request.topEvents.length}, topStates=${v2Result.request.topStates.length}`);
                                const { content, usage } = await generateDailyInterpretationFull(v2Result.request as any);
                                if (usage) {
                                  sumInput  += usage.input;
                                  sumOutput += usage.output;
                                  sumTotal  += usage.total;
                                }
                                console.log(`[AI-BATCH] ${fortune.date} (${i + 1}/${total}) input=${usage?.input ?? "-"} output=${usage?.output ?? "-"} total=${usage?.total ?? "-"}`);
                                console.log(`[AI-BATCH] 응답: ${content}`);
                                days.push({ date: fortune.date, request: v2Result.request, response: content, usage: usage ?? null });
                              } catch (err) {
                                const msg = err instanceof Error ? err.message : String(err);
                                console.error(`[AI-BATCH] ${fortune.date} 오류: ${msg}`);
                                const v2Result = buildAiDailyRequestV2(fortune, batchMonthCtx);
                                days.push({ date: fortune.date, request: v2Result.request, response: `ERROR: ${msg}`, usage: null });
                              }
                            }

                            console.log(`[AI-BATCH] 완료 ${total}/${total}일 총 input=${sumInput} output=${sumOutput} total=${sumTotal}`);

                            const key = `ai_batch_log_${prefix}`;
                            const log = {
                              generated_at: new Date().toISOString(),
                              month: prefix,
                              days,
                              total_usage: { input: sumInput, output: sumOutput, total: sumTotal },
                            };
                            localStorage.setItem(key, JSON.stringify(log));
                            console.log(`[AI-BATCH] 저장 key=${key}`);

                            setBatchProgress("");
                            setBatchResultKey(key);
                            setBatchRunning(false);
                          }}
                        >
                          한달 AI 해석
                        </button>
                      )}
                      {batchRunning && (
                        <div style={{ color: "var(--text-muted)", fontSize: "0.875rem", padding: "0.5rem 0" }}>
                          {batchProgress}
                        </div>
                      )}
                      {batchResultKey && (
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.4rem 0" }}>
                          <span style={{ fontSize: "0.8rem", color: "var(--text-sub)", flex: 1 }}>
                            저장 완료: {batchResultKey}
                          </span>
                          <button
                            style={{
                              padding: "0.3rem 0.7rem",
                              border: "1px solid var(--border)",
                              borderRadius: "0.4rem",
                              background: "var(--surface)",
                              color: "var(--text-main)",
                              fontSize: "0.8rem",
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                            }}
                            onClick={() => {
                              const raw = localStorage.getItem(batchResultKey);
                              if (!raw) return;
                              const blob = new Blob([raw], { type: "application/json" });
                              const url  = URL.createObjectURL(blob);
                              const a    = document.createElement("a");
                              a.href     = url;
                              a.download = `${batchResultKey}.json`;
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                              URL.revokeObjectURL(url);
                            }}
                          >
                            다운로드
                          </button>
                        </div>
                      )}
                    </div>

                  </>
              )}
            </div>
        )}

        {/* ── Notification Debug Viewer ── */}
        {debugOpen && (
            <>
              <div className={styles.overlay} onClick={() => setDebugOpen(false)} />
              <div className={styles.bottomSheet}>
                <div className={styles.sheetHandle} />
                <div className={styles.sheetTitle}>알림 예약 확인</div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
                  현재 시각: {new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                  {" · "}선택 날짜: {selected?.date ?? "없음"}
                </div>
                {!debugEntries || debugEntries.length === 0 ? (
                    <div style={{ color: "var(--text-muted)", fontSize: "0.82rem", lineHeight: 1.7 }}>
                      준비된 알림 데이터 없음
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                      {debugEntries.map((e, i) => {
                        const now = new Date();
                        const isPast = new Date(e.triggerAt) <= now;
                        const status = isPast
                            ? "SKIP"
                            : e.registered === true
                                ? "✅ 준비됨"
                                : "🕒 예정됨";
                        return (
                            <div key={i} style={{ fontSize: "0.8rem", padding: "0.3rem 0", borderBottom: "1px solid var(--border)" }}>
                              <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span style={{ color: "var(--text-muted)" }}>{e.type} · {e.triggerAt.slice(11, 16)}</span>
                                <span>{status}</span>
                              </div>
                              <div style={{ fontSize: "0.74rem", color: "var(--text-sub)", marginTop: "0.1rem" }}>{e.title}</div>
                            </div>
                        );
                      })}
                    </div>
                )}
              </div>
            </>
        )}

        {/* ── Settings Bottom Sheet ── */}
        {settingsOpen && (
            <>
              <div className={styles.overlay} onClick={() => setSettingsOpen(false)} />
              <div className={styles.bottomSheet}>
                <div className={styles.sheetHandle} />

                {settingsView === "main" ? (
                    <>
                      <div className={styles.sheetTitle}>설정</div>
                      <button className={styles.sheetOption} onClick={() => setSettingsView("noti")}>
                        알림 설정
                      </button>
                      <button
                          className={`${styles.sheetOption} ${styles.sheetOptionDanger}`}
                          onClick={() => { clearUser(); onBack(); }}
                      >
                        기본 정보 수정
                      </button>
                    </>
                ) : (
                    <>
                      <button className={styles.sheetBack} onClick={() => setSettingsView("main")}>
                        ← 알림 설정
                      </button>
                      <div className={styles.notiSheetSection}>

                        <div className={styles.notiItem}>
                          <div className={styles.notiItemText}>
                            <span className={styles.notiItemLabel}>오늘 흐름 요약 받기</span>
                            <span className={styles.notiItemHelper}>아침에 오늘의 전체 흐름을 먼저 알려드려요</span>
                          </div>
                          <div className={styles.notiItemControl}>
                            {notiDailyEnabled && (
                                <button
                                    type="button"
                                    className={styles.notiPickerBtn}
                                    onClick={() => { setDraftNotiStart(notiStart); setNotiModalOpen(true); }}
                                >
                                  {notiStart}시
                                </button>
                            )}
                            <label className={styles.notiToggle}>
                              <input type="checkbox" checked={notiDailyEnabled} onChange={e => setNotiDailyEnabled(e.target.checked)} />
                              <span className={styles.notiToggleTrack} />
                            </label>
                          </div>
                        </div>

                        <div className={styles.notiItem}>
                          <div className={styles.notiItemText}>
                            <span className={styles.notiItemLabel}>흐름 변화 알림 받기</span>
                            <span className={styles.notiItemHelper}>하루 흐름이 크게 바뀌거나 특별한 구간이 있을 때 알려드려요</span>
                          </div>
                          <div className={styles.notiItemControl}>
                            <label className={styles.notiToggle}>
                              <input type="checkbox" checked={notiEventStateEnabled} onChange={e => setNotiEventStateEnabled(e.target.checked)} />
                              <span className={styles.notiToggleTrack} />
                            </label>
                          </div>
                        </div>

                        <div className={styles.notiSheetRow} style={{ marginTop: "1rem" }}>
                          <button className={styles.notiSaveBtn} onClick={handleNotiSave}>
                            저장
                          </button>
                          {notiSaved && <span className={styles.notiSavedMsg}>저장됨</span>}
                          <button className={styles.notiTestBtn} onClick={sendTestNotification}>
                            알림 테스트
                          </button>
                          {testNotiSent && <span className={styles.notiSavedMsg}>잠시 후 알림이 도착합니다</span>}
                          <button className={styles.notiTestBtn} onClick={openDebugOverlay}>
                            예약 확인
                          </button>
                        </div>

                      </div>
                    </>
                )}
              </div>
            </>
        )}

        {/* ── Notification Time Picker Modal ── */}
        <WheelPickerModal
            open={notiModalOpen}
            title="알림 시간 선택"
            columns={[{
              items: Array.from({ length: 24 }, (_, i) => ({ label: `${i}시`, value: i })),
              value: draftNotiStart,
              onChange: setDraftNotiStart,
            }]}
            onClose={() => setNotiModalOpen(false)}
            onConfirm={() => { setNotiStart(draftNotiStart); setNotiModalOpen(false); }}
        />

        {/* ── EventInfo Bottom Sheet ── */}
        {eventInfoKey !== null && (() => {
          const info = safeResolveInfo(eventInfoKey);
          if (!info) return null;
          return (
            <>
              <div className={styles.overlay} onClick={() => setEventInfoKey(null)} />
              <div className={`${styles.bottomSheet} ${styles.eventInfoSheet}`}>
                <div className={styles.sheetHandle} />
                <div className={styles.eventInfoTitle}>{info.title}</div>
                <div className={styles.eventInfoShort}>{info.shortDescription}</div>
                {info.detailedDescription && (
                  <p className={styles.eventInfoDetail}>{info.detailedDescription}</p>
                )}
                {info.commonPatterns && info.commonPatterns.length > 0 && (
                  <div className={styles.eventInfoSection}>
                    <div className={styles.eventInfoSectionLabel}>자주 나타나는 흐름</div>
                    <ul className={styles.eventInfoList}>
                      {info.commonPatterns.map((p, i) => <li key={i}>{p}</li>)}
                    </ul>
                  </div>
                )}
                {info.relatedStates && info.relatedStates.length > 0 && (
                  <div className={styles.eventInfoSection}>
                    <div className={styles.eventInfoSectionLabel}>연결되는 상태</div>
                    <div className={styles.eventInfoStateList}>
                      {info.relatedStates.map((s, i) => (
                        <div key={i} className={styles.eventInfoStateItem}>
                          <span>{STATE_LABELS[s.key] ?? s.key}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {info.relatedFlows && info.relatedFlows.length > 0 && (
                  <div className={styles.eventInfoSection}>
                    <div className={styles.eventInfoSectionLabel}>연결되는 흐름</div>
                    <div className={styles.eventInfoFlowList}>
                      {info.relatedFlows.map((f, i) => (
                        <div key={i} className={styles.eventInfoFlowItem}>{FLOW_LABELS[f] ?? f}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          );
        })()}

        {showExactAlarmGuide && (
            <>
              <div className={styles.overlay} onClick={() => setShowExactAlarmGuide(false)} />
              <div className={styles.bottomSheet}>
                <div className={styles.sheetHandle} />
                <div className={styles.sheetTitle}>알림을 정확한 시간에 받으려면 권한이 필요해요</div>

                <div style={{ fontSize: "0.82rem", lineHeight: 1.6, color: "var(--text-muted)" }}>
                  하루온도는 설정한 시간에 오늘의 흐름과 좋은 타이밍을 알려드려요.
                  <br /><br />
                  알림 권한을 허용해야 받을 수 있고,
                  ‘알람 및 리마인더’ 권한을 허용하면 더 정확한 시간에 도착해요.
                </div>

                <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
                  <button
                      className={styles.notiSaveBtn}
                      onClick={async () => {
                        await requestNotificationPermission();
                        const can = await canScheduleExactAlarms();
                        if (!can) {
                          await openExactAlarmSettings();
                        }
                        setShowExactAlarmGuide(false);
                      }}
                  >
                    알림 허용하기
                  </button>

                  <button
                      className={styles.notiTestBtn}
                      onClick={() => setShowExactAlarmGuide(false)}
                  >
                    나중에 할게요
                  </button>
                </div>
              </div>
            </>
        )}

      </div>
  );
}
