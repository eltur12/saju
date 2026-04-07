import { useState, useEffect, useCallback, useRef } from "react";
import { getMonthlyFortune, getUser, clearUser, saveWidgetData } from "../api/fortuneApi";
import { App } from "@capacitor/app";
import { LocalNotifications } from "@capacitor/local-notifications";
import type { MonthlyFortuneResult, DailyFortune } from "../engines/aggregator";
import type { SajuUser } from "../api/fortuneApi";
import {
  scheduleDailyFortuneNotifications,
  clearDailyFortuneNotifications,
  getNotificationAllowedStartHour,
  getNotificationAllowedEndHour,
  setNotificationAllowedHours,
} from "../services/notificationService";
import styles from "./Main.module.css";

const DAY_NAMES = ["일","월","화","수","목","금","토"];
const DOW_KO    = ["일","월","화","수","목","금","토"];
const SCORE_CATS: { key: keyof DailyFortune["scores"]; label: string }[] = [
  { key: "overall", label: "종합" },
  { key: "wealth",  label: "재물" },
  { key: "love",    label: "애정" },
  { key: "health",  label: "건강" },
  { key: "career",  label: "직업" },
];

const HINT_TYPE_LABEL: Record<string, string> = {
  best_window:    "좋은 시간",
  caution_window: "주의 시간",
  next_rise:      "흐름 변화",
};

type HintItem = NonNullable<DailyFortune["notificationHints"]>[number];
type TabId = "calendar" | "detail";
type SettingsView = "main" | "noti";

function fmtHour(h: number) {
  return String(h).padStart(2, "0") + ":00";
}

function resolveScheduledTime(
  hint: HintItem,
  dateStr: string,
  allowedStart: number,
  allowedEnd: number,
): Date | null {
  if (hint.type === "next_rise") return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  const minute = hint.type === "best_window" ? -10 : 0;
  const at = new Date(y, m - 1, d, hint.hour, minute, 0, 0);
  if (at.getHours() < allowedStart) at.setHours(allowedStart, 0, 0, 0);
  if (at.getHours() > allowedEnd) return null;
  return at;
}

function computeHintLabels(
  hints: NonNullable<DailyFortune["notificationHints"]>,
  dateStr: string,
  allowedStart: number,
  allowedEnd: number,
): string[] {
  const bestHint = hints.find(h => h.type === "best_window");
  const bestAt   = bestHint ? resolveScheduledTime(bestHint, dateStr, allowedStart, allowedEnd) : null;
  return hints.map(hint => {
    if (hint.type === "next_rise") return "참고용";
    const at = resolveScheduledTime(hint, dateStr, allowedStart, allowedEnd);
    if (!at) return "알림 없음";
    if (hint.type === "caution_window") {
      if (hint.score >= 50) return "알림 없음";
      if (bestAt !== null && Math.abs(at.getHours() - bestAt.getHours()) < 2) return "알림 없음";
    }
    return `알림 ${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")} 예정`;
  });
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
  const [autoSelectToday, setAutoSelectToday] = useState(true);
  const [tab, setTab]                       = useState<TabId>("calendar");
  const [pendingDay, setPendingDay]         = useState<{ year: number; month: number; day: number } | null>(null);
  const [notiStart, setNotiStart]           = useState(7);
  const [notiEnd,   setNotiEnd]             = useState(22);
  const [notiSaved, setNotiSaved]           = useState(false);
  const [settingsOpen, setSettingsOpen]     = useState(false);
  const [settingsView, setSettingsView]     = useState<SettingsView>("main");
  const hasScheduledTodayRef                = useRef(false);

  useEffect(() => {
    getNotificationAllowedStartHour().then(setNotiStart);
    getNotificationAllowedEndHour().then(setNotiEnd);
  }, []);

  const sendTestNotification = async () => {
    try {
      const TEST_NOTIFICATION_ID = 999001;
      const { display } = await LocalNotifications.requestPermissions();
      if (display !== "granted") return;
      await LocalNotifications.cancel({ notifications: [{ id: TEST_NOTIFICATION_ID }] });
      const scheduleAt = new Date(Date.now() + 5000);
      await LocalNotifications.schedule({
        notifications: [{
          id: TEST_NOTIFICATION_ID,
          title: "테스트 알림",
          body: "알림이 정상적으로 동작합니다",
          schedule: { at: scheduleAt },
          smallIcon: "ic_stat_icon_config_sample",
          iconColor: "#3aab8c",
        }],
      });
    } catch (e) { console.warn("[TEST_NOTI] failed", e); }
  };

  const handleNotiSave = async () => {
    if (notiStart > notiEnd) return;
    await setNotificationAllowedHours(notiStart, notiEnd);
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
    setAutoSelectToday(false);
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

  useEffect(() => {
    if (!loading && data && autoSelectToday) {
      const f = data.daily_fortunes[todayDate - 1];
      if (f) setSelected(f);
      setAutoSelectToday(false);
    }
  }, [loading, data, autoSelectToday, todayDate]);

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
      setAutoSelectToday(true);
      setYear(todayYear);
      setMonth(todayMonth);
    }
    setTab("detail");
  };

  const handleDayClick = (fortune: DailyFortune) => {
    setSelected(fortune);
    setTab("detail");
  };

  const openSettings = () => {
    setSettingsView("main");
    setSettingsOpen(true);
  };

  // Calendar grid
  const firstDay    = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells = Array.from({ length: firstDay + daysInMonth }, (_, i) =>
    i < firstDay ? null : i - firstDay + 1
  );
  while (cells.length % 7 !== 0) cells.push(null);
  const isCurrentMonth = year === todayYear && month === todayMonth;

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
  const showBestSeparately = bestSegment && nowSegment
    && bestSegment.startHour !== nowSegment.startHour;

  return (
    <div className={styles.container}>

      {/* ── Header ── */}
      <div className={styles.header}>
        <div className={styles.headerNav}>
          <button className={styles.navBtn} onClick={prevMonth}>‹</button>
          <span className={styles.headerTitle}>{year}년 {month}월</span>
          <button className={styles.navBtn} onClick={nextMonth}>›</button>
        </div>
        <button className={styles.settingsBtn} onClick={openSettings} title="설정">⚙</button>
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
            <div className={styles.loading}>운세 계산 중...</div>
          ) : (
            <div className={styles.calendarGrid}>
              {cells.map((day, idx) => {
                if (!day) return <div key={`e-${idx}`} className={`${styles.cell} ${styles.cellEmpty}`} />;
                const fortune = data?.daily_fortunes[day - 1];
                const dow = (firstDay + day - 1) % 7;
                const isSelected = selected?.date === fortune?.date;
                const isToday = isCurrentMonth && day === todayDate;
                return (
                  <div
                    key={day}
                    className={`${styles.cell} ${isSelected ? styles.cellSelected : ""} ${isToday && !isSelected ? styles.cellToday : ""}`}
                    onClick={() => fortune && handleDayClick(fortune)}
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
                <div className={styles.previewSummary}>{selected.summary}</div>
              </div>
              <div className={styles.previewRight}>
                <span className={`${styles.previewScore} ${getScoreClass(selected.scores.overall)}`}>
                  {selected.scores.overall}
                </span>
                <span className={getBadgeClass(selected.badge)}>{selected.badge}</span>
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
                  <span className={getBadgeClass(selected.badge)}>{selected.badge}</span>
                </div>
                <p className={styles.heroSummary}>{selected.summary}</p>
              </div>

              {/* ── 지금 추천 / 오늘 최고 ── */}
              {(nowSegment || showBestSeparately) && (
                <div className={styles.cardsRow}>
                  {nowSegment && (
                    <div className={styles.nowCard}>
                      <div className={styles.cardLabel}>지금 추천</div>
                      <div className={styles.cardTime}>{fmtHour(nowSegment.startHour)} – {fmtHour(nowSegment.endHour)}</div>
                      <div className={styles.cardTags}>{nowSegment.tags.join(" · ")}</div>
                      <div className={`${styles.cardScore} ${styles["cardScore-mint"]}`}>{nowSegment.score}</div>
                    </div>
                  )}
                  {showBestSeparately && bestSegment && (
                    <div className={styles.bestCard}>
                      <div className={styles.cardLabel}>오늘 최고</div>
                      <div className={styles.cardTime}>{fmtHour(bestSegment.startHour)} – {fmtHour(bestSegment.endHour)}</div>
                      <div className={styles.cardTags}>{bestSegment.tags.join(" · ")}</div>
                      <div className={`${styles.cardScore} ${styles["cardScore-gold"]}`}>{bestSegment.score}</div>
                    </div>
                  )}
                </div>
              )}

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

              {/* ── 시간대 흐름 ── */}
              {selected.timeSegments && selected.timeSegments.length > 0 && (
                <div className={styles.detailSection}>
                  <div className={styles.sectionTitle}>시간대 흐름</div>
                  <div className={styles.segmentList}>
                    {selected.timeSegments.map((seg) => {
                      const isNow  = nowSegment?.startHour === seg.startHour;
                      const isBest = bestSegment?.startHour === seg.startHour && !isNow;
                      const isCaution = seg.score < 45;
                      const marker = isNow ? "now" : isBest ? "best" : isCaution ? "caution" : null;
                      const markerLabel = isNow ? "지금" : isBest ? "최고" : "주의";
                      return (
                        <div
                          key={seg.startHour}
                          className={`${styles.segmentRow} ${isNow ? styles.segmentRowNow : ""} ${isBest ? styles.segmentRowBest : ""}`}
                        >
                          <span className={styles.segmentTime}>
                            {fmtHour(seg.startHour)} – {fmtHour(seg.endHour)}
                          </span>
                          <span className={`${styles.segmentScore} ${getScoreClass(seg.score)}`}>
                            {seg.score}
                          </span>
                          <span className={styles.segmentTags}>{seg.tags.join(" · ")}</span>
                          {marker && (
                            <span className={`${styles.segmentMarker} ${styles[`segmentMarker-${marker}`]}`}>
                              {markerLabel}
                            </span>
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

              {/* ── 알림 예정 (scheduled hints only, clean) ── */}
              {selected.notificationHints && selected.notificationHints.length > 0 && (() => {
                const labels  = computeHintLabels(selected.notificationHints, selected.date, notiStart, notiEnd);
                const bestHint = selected.notificationHints.find(h => h.type === "best_window");
                const bestAt   = bestHint ? resolveScheduledTime(bestHint, selected.date, notiStart, notiEnd) : null;

                const enriched = selected.notificationHints.map((hint, i) => {
                  const isInfoOnly = hint.type === "next_rise";
                  const at         = isInfoOnly ? null : resolveScheduledTime(hint, selected.date, notiStart, notiEnd);
                  const typeValid  = hint.type === "best_window" ||
                    (hint.type === "caution_window" && hint.score < 50 &&
                      !(bestAt !== null && at !== null && Math.abs(at.getHours() - bestAt.getHours()) < 2));
                  const isScheduled = !isInfoOnly && at !== null && typeValid;
                  return { hint, label: labels[i], isScheduled, isInfoOnly, at };
                });

                enriched.sort((a, b) => {
                  if (a.hint.hour !== b.hint.hour) return a.hint.hour - b.hint.hour;
                  const ga = a.isScheduled ? 0 : a.isInfoOnly ? 1 : 2;
                  const gb = b.isScheduled ? 0 : b.isInfoOnly ? 1 : 2;
                  return ga - gb;
                });

                return (
                  <div className={styles.detailSection}>
                    <div className={styles.sectionTitle}>알림 예정</div>
                    <div className={styles.segmentList}>
                      {enriched.map(({ hint, label }) => (
                        <div key={`${hint.type}-${hint.hour}`} className={styles.hintRow}>
                          <span className={styles.hintHour}>
                            {hint.hour}시
                            <span className={styles.hintScheduled}>({label})</span>
                          </span>
                          <span className={styles.hintType}>{HINT_TYPE_LABEL[hint.type] ?? hint.type}</span>
                          <span className={styles.hintLabel}>{hint.label}</span>
                          <span className={`${styles.segmentScore} ${getScoreClass(hint.score)}`}>{hint.score}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
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
                  <div className={styles.notiSheetRow}>
                    <span className={styles.notiLabel}>시작</span>
                    <select
                      className={styles.notiSelect}
                      value={notiStart}
                      onChange={e => setNotiStart(Number(e.target.value))}
                    >
                      {[6,7,8,9,10,11,12].map(h => <option key={h} value={h}>{h}시</option>)}
                    </select>
                    <span className={styles.notiLabel}>종료</span>
                    <select
                      className={styles.notiSelect}
                      value={notiEnd}
                      onChange={e => setNotiEnd(Number(e.target.value))}
                    >
                      {[12,13,14,15,16,17,18,19,20,21,22,23].map(h => <option key={h} value={h}>{h}시</option>)}
                    </select>
                  </div>
                  <div className={styles.notiSheetRow}>
                    <button
                      className={styles.notiSaveBtn}
                      onClick={handleNotiSave}
                      disabled={notiStart > notiEnd}
                    >
                      저장
                    </button>
                    {notiSaved && <span className={styles.notiSavedMsg}>저장됨</span>}
                    <button className={styles.notiTestBtn} onClick={sendTestNotification}>
                      알림 테스트
                    </button>
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
