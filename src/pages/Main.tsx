import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { getMonthlyFortune, getUser, clearUser, saveWidgetData } from "../api/fortuneApi";
import { App } from "@capacitor/app";
import type { MonthlyFortuneResult, DailyFortune } from "../engines/aggregator";
import type { SajuUser } from "../api/fortuneApi";
import {
  scheduleDailyFortuneNotifications,
  clearDailyFortuneNotifications,
  loadNotificationSettings,
  saveNotificationSettings,
  sendDebugTestNotificationsForToday,
} from "../services/notificationService";
import styles from "./Main.module.css";
import {
  planNotifications,
  applyNotificationSettings,
  generateNotificationMessage,
} from "../engines/notificationPlanner";
import type { PlannedNotification } from "../engines/notificationPlanner";
import { getFlowState, getFlowSentence } from "../utils/flowState";

const DAY_NAMES = ["일","월","화","수","목","금","토"];
const DOW_KO    = ["일","월","화","수","목","금","토"];
const SCORE_CATS: { key: keyof DailyFortune["scores"]; label: string }[] = [
  { key: "overall", label: "종합" },
  { key: "wealth",  label: "재물" },
  { key: "love",    label: "애정" },
  { key: "health",  label: "건강" },
  { key: "career",  label: "직업" },
];

type TabId = "calendar" | "detail";
type SettingsView = "main" | "noti";

function fmtHour(h: number) {
  return String(h).padStart(2, "0") + ":00";
}


function getScoreClass(score: number) {
  if (score >= 75) return styles["score-gold"];
  if (score >= 65) return styles["score-green"];
  if (score >= 55) return styles["score-gray"];
  return styles["score-red"];
}

function getBadgeClass(badge: string) {
  return `${styles.badge} ${styles[`badge-${badge}`]}`;
}

const BADGE_LABELS: Record<string, string> = {
  "대길": "좋은 흐름",
  "길":   "안정적",
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

  const [notiDailyEnabled, setNotiDailyEnabled] = useState(true);
  const [notiFlowEnabled,  setNotiFlowEnabled]  = useState(true);
  const [notiLowEnabled,   setNotiLowEnabled]   = useState(true);
  const [notiAllowNight,   setNotiAllowNight]   = useState(false);
  const [notiSaved, setNotiSaved]           = useState(false);
  const [testNotiSent, setTestNotiSent]     = useState(false);
  const [settingsOpen, setSettingsOpen]     = useState(false);
  const [settingsView, setSettingsView]     = useState<SettingsView>("main");
  const hasScheduledTodayRef                = useRef(false);
  const prevTodayStrRef                    = useRef(todayStr);

  useEffect(() => {
    loadNotificationSettings().then(s => {
      const [hh] = s.dailyTime.split(":").map(Number);
      setNotiStart(hh);
      setNotiDailyEnabled(s.dailyEnabled);
      setNotiFlowEnabled(s.flowEnabled);
      setNotiLowEnabled(s.lowEnabled);
      setNotiAllowNight(s.allowNight);
    });
  }, []);

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
      dailyEnabled: notiDailyEnabled,
      flowEnabled:  notiFlowEnabled,
      lowEnabled:   notiLowEnabled,
      allowNight:   notiAllowNight,
      dailyTime:    `${String(notiStart).padStart(2, "0")}:00`,
    };
    await saveNotificationSettings(settings);
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const todayFortune = data?.daily_fortunes[now.getDate() - 1];
    if (year === now.getFullYear() && month === now.getMonth() + 1 && todayFortune) {
      await clearDailyFortuneNotifications(dateStr);
      await scheduleDailyFortuneNotifications(todayFortune, dateStr);
    }
    setNotiSaved(true);
    setTimeout(() => setNotiSaved(false), 2000);
  };

  useEffect(() => { setUser(getUser()); }, []);

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
    try {
      const result = await getMonthlyFortune(u, y, m);
      setData(result);
      const now = new Date();
      if (y === now.getFullYear() && m === now.getMonth() + 1) {
        const todayFortune = result.daily_fortunes[now.getDate() - 1];
        if (todayFortune) {
          saveWidgetData(todayFortune);
          const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
          if (!hasScheduledTodayRef.current) {
            hasScheduledTodayRef.current = true;
            await clearDailyFortuneNotifications(dateStr);
            scheduleDailyFortuneNotifications(todayFortune, dateStr);
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
      if (f) setSelected(f);
    }
  }, [loading, data, selected, todayStr]);

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

  // Selected date display
  const selectedDate   = selected
      ? (() => { const [y, m, d] = selected.date.split("-").map(Number); return new Date(y, m - 1, d); })()
      : null;
  const selectedDayStr = selectedDate
      ? `${selectedDate.getMonth() + 1}월 ${selectedDate.getDate()}일 (${DOW_KO[selectedDate.getDay()]})`
      : "";

  // Now / best segments
  const isSelectedToday = selected?.date === todayStr;
  const nowSegment = (() => {
    if (!selected?.timeSegments?.length) return null;
    if (isSelectedToday) {
      const h = new Date().getHours();
      return selected.timeSegments.find(s => h >= s.startHour && h < s.endHour)
          ?? selected.timeSegments[0];
    }
    return selected.timeSegments.reduce((a, b) => b.score > a.score ? b : a);
  })();
  const bestSegment = selected?.timeSegments?.length
      ? selected.timeSegments.reduce((a, b) => b.score > a.score ? b : a)
      : null;
  const worstSegment = selected?.timeSegments?.length
      ? selected.timeSegments.reduce((a, b) => b.score < a.score ? b : a)
      : null;

  const plannedNotifications = useMemo<PlannedNotification[]>(() => {
    if (!selected) return [];
    return planNotifications(selected, selected.date);
  }, [selected]);

  const visibleNotifications = useMemo<PlannedNotification[]>(() => {
    if (!selected) return [];

    const settings = {
      dailyEnabled: notiDailyEnabled,
      flowEnabled:  notiFlowEnabled,
      lowEnabled:   notiLowEnabled,
      allowNight:   notiAllowNight,
      dailyTime:    `${String(notiStart).padStart(2, "0")}:00`,
    };

    const planned = planNotifications(selected, selected.date);
    return applyNotificationSettings(planned, settings, selected.date);
  }, [
    selected,
    notiDailyEnabled,
    notiFlowEnabled,
    notiLowEnabled,
    notiAllowNight,
    notiStart,
  ]);

  const segmentDetailMap = useMemo(() => {
    const map = new Map<number, PlannedNotification>();
    for (const n of plannedNotifications) {
      if (n.type !== "DAILY") {
        map.set(n.triggerTime.getHours(), n);
      }
    }
    return map;
  }, [plannedNotifications]);

  const segmentVisibleNotifMap = useMemo(() => {
    const map = new Map<number, PlannedNotification>();
    for (const n of visibleNotifications) {
      if (n.type !== "DAILY") {
        map.set(n.triggerTime.getHours(), n);
      }
    }
    return map;
  }, [visibleNotifications]);

  const dailySummary = useMemo(() => {
    const dailyNotif = plannedNotifications.find(n => n.type === "DAILY");
    if (!dailyNotif || !selected) return selected?.summary ?? "";
    return generateNotificationMessage(dailyNotif, "L2").body;
  }, [plannedNotifications, selected]);

  const nowDelta = useMemo(() => {
    if (!nowSegment || !selected?.timeSegments) return undefined;
    const idx = selected.timeSegments.findIndex(s => s.startHour === nowSegment.startHour);
    if (idx <= 0) return undefined;
    return nowSegment.score - selected.timeSegments[idx - 1].score;
  }, [nowSegment, selected]);

  const nowFlowSentence = useMemo(() => {
    if (!isSelectedToday || !nowSegment) return "";
    return getFlowSentence(getFlowState(nowSegment.score, nowDelta));
  }, [isSelectedToday, nowSegment, nowDelta]);

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
                <span className={styles.headerTitle}>{selected ? `${selectedDayStr}${selected.date === todayStr ? " · 오늘" : ""}` : "오늘의 흐름"}</span>
            )}
          </div>
          <button className={styles.settingsBtn} onClick={openSettings} title="설정">⋮</button>
        </div>

        {/* ── Tab Bar ── */}
        <div className={styles.tabBar}>
          <button className={styles.todayBtn} onClick={goToToday}>오늘</button>
          <div className={styles.tabBtns}>
            <button
                className={`${styles.tabBtn} ${tab === "calendar" ? styles.tabBtnActive : ""}`}
                onClick={() => setTab("calendar")}
            >달력</button>
            <button
                className={`${styles.tabBtn} ${tab === "detail" ? styles.tabBtnActive : ""}`}
                onClick={() => setTab("detail")}
            >상세</button>
          </div>
        </div>

        {/* ── 달력 탭 ── */}
        {tab === "calendar" && (
            <div className={styles.calendarView}>
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
                                  <span className={`${styles.scoreNum} ${getScoreClass(fortune.scores.overall)}`}>
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
                  <div className={styles.previewCard}>
                    <div className={styles.previewLeft}>
                      <div className={styles.previewDate}>{selectedDayStr}</div>
                      <div className={styles.previewLunar}>음력 {selected.lunar_date}</div>
                      <div className={styles.previewSummary}>{dailySummary}</div>
                    </div>
                    <div className={styles.previewRight}>
                <span className={`${styles.previewScore} ${getScoreClass(selected.scores.overall)}`}>
                  {selected.scores.overall}
                </span>
                      <span className={getBadgeClass(selected.badge)}>{getBadgeLabel(selected.badge)}</span>
                      <button className={styles.previewBtn} onClick={() => setTab("detail")}>
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
                      <div className={styles.heroMeta}>
                        <span className={styles.heroDate}>{selectedDayStr}</span>
                        <span className={styles.heroLunar}>음력 {selected.lunar_date}</span>
                      </div>
                      <div className={styles.heroScoreRow}>
                  <span className={`${styles.heroScoreNum} ${getScoreClass(selected.scores.overall)}`}>
                    {selected.scores.overall}
                  </span>
                        <span className={getBadgeClass(selected.badge)}>{getBadgeLabel(selected.badge)}</span>
                      </div>
                      <p className={styles.heroSummary}>{dailySummary}</p>
                      {nowFlowSentence && (
                        <p className={styles.heroFlowState}>{nowFlowSentence}</p>
                      )}
                    </div>

                    {/* ── 카테고리 점수 ── */}
                    <div className={styles.detailSection}>
                      <div className={styles.sectionTitle}>카테고리</div>
                      <div className={styles.scoreGrid}>
                        {SCORE_CATS.map(({ key, label }) => (
                            <div key={key} className={styles.scoreItem}>
                              <span className={styles.scoreCat}>{label}</span>
                              <span className={styles.scoreVal}>{selected.scores[key]}</span>
                              <div className={styles.scoreBar}>
                                <div className={styles.scoreBarFill} style={{ width: `${selected.scores[key]}%` }} />
                              </div>
                            </div>
                        ))}
                      </div>
                    </div>

                    {/* ── 시간대 흐름 (accordion) ── */}
                    {selected.timeSegments && selected.timeSegments.length > 0 && (
                        <div className={styles.detailSection}>
                          <div className={styles.sectionTitle}>시간대 흐름</div>
                          <div className={styles.segmentList}>
                            {selected.timeSegments.map((seg) => {
                              const isNow      = isSelectedToday && nowSegment?.startHour === seg.startHour;
                              const isBest     = bestSegment?.startHour === seg.startHour;
                              const isWorst    = worstSegment?.startHour === seg.startHour
                                  && worstSegment?.startHour !== bestSegment?.startHour;
                              const detailNotif = segmentDetailMap.get(seg.startHour);
                              const visibleNotif = segmentVisibleNotifMap.get(seg.startHour);
                              const isHighlighted = !!detailNotif;

                              const bodyText = detailNotif
                                  ? generateNotificationMessage(detailNotif, "L3").body
                                  : "";

                              return (
                                  <div key={seg.startHour} className={`${styles.segmentAccordion} ${isHighlighted ? styles.segmentAccordionHighlight : ""}`}>
                                    <div
                                        className={`${styles.segmentRow} ${isNow ? styles.segmentRowNow : ""} ${isHighlighted ? styles.segmentRowOpen : ""}`}
                                    >
                            <span className={styles.segmentTime}>
                              {fmtHour(seg.startHour)} – {fmtHour(seg.endHour)}
                            </span>
                                      <span className={styles.segmentScoreWrap}>
                              <span className={`${styles.segmentScore} ${getScoreClass(seg.score)}`}>
                                {seg.score}
                              </span>
                                        {isBest  && <span className={styles.scoreBadgeHigh}>▲</span>}
                                        {isWorst && <span className={styles.scoreBadgeLow}>▽</span>}
                            </span>
                                      <span className={styles.segmentRight}>
                              {visibleNotif?.type === "FLOW"  && (
                                  <span className={`${styles.notiMarker} ${styles.notiMarkerFlow}`}>★</span>
                              )}
                                        {visibleNotif?.type === "LOW"   && (
                                            <span className={`${styles.notiMarker} ${styles.notiMarkerLow}`}>↓</span>
                                        )}
                                        {visibleNotif?.type === "POINT" && (
                                            <span className={`${styles.notiMarker} ${styles.notiMarkerPoint}`}>●</span>
                                        )}
                                        {visibleNotif && <span className={styles.notiClockIcon}>⏰</span>}
                            </span>
                                    </div>
                                    {detailNotif && (
                                        <div className={isNow ? styles.segmentBodyNow : styles.segmentBody}>
                                          <p className={styles.segmentBodyText}>{bodyText}</p>
                                        </div>
                                    )}
                                  </div>
                              );
                            })}
                          </div>
                        </div>
                    )}

                    {/* ── 오늘의 행동 ── */}
                    <div className={styles.detailSection}>
                      <div className={styles.sectionTitle}>오늘의 행동</div>
                      <div className={styles.todoRow}>
                        <div className={styles.todoCol}>
                          <div className={styles.todoTitle}>하면 좋은 것</div>
                          <ul className={styles.todoList}>
                            {selected.todos.do_list.map((item, i) => (
                                <li key={i} className={styles.todoItem}>{item}</li>
                            ))}
                          </ul>
                        </div>
                        <div className={styles.todoCol}>
                          <div className={`${styles.todoTitle} ${styles.todoTitleDanger}`}>피해야 할 것</div>
                          <ul className={styles.todoList}>
                            {selected.todos.dont_list.map((item, i) => (
                                <li key={i} className={`${styles.todoItem} ${styles.dontItem}`}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>

                  </>
              )}
            </div>
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
                                <select
                                    className={styles.notiSelect}
                                    value={notiStart}
                                    onChange={e => setNotiStart(Number(e.target.value))}
                                >
                                  {[6,7,8,9,10,11,12].map(h => <option key={h} value={h}>{h}시</option>)}
                                </select>
                            )}
                            <label className={styles.notiToggle}>
                              <input type="checkbox" checked={notiDailyEnabled} onChange={e => setNotiDailyEnabled(e.target.checked)} />
                              <span className={styles.notiToggleTrack} />
                            </label>
                          </div>
                        </div>

                        <div className={styles.notiItem}>
                          <div className={styles.notiItemText}>
                            <span className={styles.notiItemLabel}>흐름이 좋아지는 타이밍 알림 받기</span>
                            <span className={styles.notiItemHelper}>집중이나 추진 흐름이 살아나는 시간을 알려드려요</span>
                          </div>
                          <div className={styles.notiItemControl}>
                            <label className={styles.notiToggle}>
                              <input type="checkbox" checked={notiFlowEnabled} onChange={e => setNotiFlowEnabled(e.target.checked)} />
                              <span className={styles.notiToggleTrack} />
                            </label>
                          </div>
                        </div>

                        <div className={styles.notiItem}>
                          <div className={styles.notiItemText}>
                            <span className={styles.notiItemLabel}>잠깐 쉬어가도 되는 흐름 알림 받기</span>
                            <span className={styles.notiItemHelper}>무리하지 않고 속도를 조절하면 좋은 시간을 알려드려요</span>
                          </div>
                          <div className={styles.notiItemControl}>
                            <label className={styles.notiToggle}>
                              <input type="checkbox" checked={notiLowEnabled} onChange={e => setNotiLowEnabled(e.target.checked)} />
                              <span className={styles.notiToggleTrack} />
                            </label>
                          </div>
                        </div>

                        <div className={styles.notiItem}>
                          <div className={styles.notiItemText}>
                            <span className={styles.notiItemLabel}>밤 시간 알림 받기</span>
                            <span className={styles.notiItemHelper}>오전 8시 이전, 오후 10시 이후 알림도 받을 수 있어요</span>
                          </div>
                          <div className={styles.notiItemControl}>
                            <label className={styles.notiToggle}>
                              <input type="checkbox" checked={notiAllowNight} onChange={e => setNotiAllowNight(e.target.checked)} />
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
                        </div>

                      </div>
                    </>
                )}
              </div>
            </>
        )}
      </div>
  );
}
