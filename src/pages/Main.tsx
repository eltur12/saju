import { useState, useEffect, useCallback } from "react";
import { getMonthlyFortune, getUser, clearUser, saveWidgetData } from "../api/fortuneApi";
import { App } from "@capacitor/app";
import type { MonthlyFortuneResult, DailyFortune } from "../engines/aggregator";
import type { SajuUser } from "../api/fortuneApi";
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

type TabId = "calendar" | "detail";

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

  const [year,  setYear]  = useState(todayYear);
  const [month, setMonth] = useState(todayMonth);
  const [data,  setData]  = useState<MonthlyFortuneResult | null>(null);
  const [loading, setLoading]             = useState(true);
  const [selected, setSelected]           = useState<DailyFortune | null>(null);
  const [user, setUser]                   = useState<SajuUser | null>(null);
  const [autoSelectToday, setAutoSelectToday] = useState(true);
  const [tab, setTab]                     = useState<TabId>("calendar");
  const [pendingDay, setPendingDay]       = useState<{ year: number; month: number; day: number } | null>(null);

  useEffect(() => { setUser(getUser()); }, []);

  // 위젯 상세 클릭 → 딥링크로 해당 날짜 상세 탭 열기
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
    // cold start: 딥링크로 앱이 처음 실행된 경우
    App.getLaunchUrl().then(result => { if (result?.url) handleDeepLink(result.url); });
    // warm start: 앱이 이미 실행 중일 때 딥링크 수신
    const listenerPromise = App.addListener("appUrlOpen", ({ url }) => handleDeepLink(url));
    return () => { listenerPromise.then(h => h.remove()); };
  }, [handleDeepLink]);

  // pendingDay 가 설정되면 해당 월 로드 후 날짜 선택
  useEffect(() => {
    if (!pendingDay) return;
    const u = getUser();
    if (!u) return;
    setYear(pendingDay.year);
    setMonth(pendingDay.month);
    setAutoSelectToday(false);
    // 월 데이터 로드 완료 후 처리는 아래 effect 에서
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
      // 현재 달 로드 시 오늘 운세를 위젯용으로 저장
      const now = new Date();
      if (y === now.getFullYear() && m === now.getMonth() + 1) {
        const todayFortune = result.daily_fortunes[now.getDate() - 1];
        if (todayFortune) saveWidgetData(todayFortune);
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

  const firstDay    = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells = Array.from({ length: firstDay + daysInMonth }, (_, i) =>
    i < firstDay ? null : i - firstDay + 1
  );
  while (cells.length % 7 !== 0) cells.push(null);

  const isCurrentMonth = year === todayYear && month === todayMonth;

  const selectedDate   = selected
    ? (() => { const [y, m, d] = selected.date.split("-").map(Number); return new Date(y, m - 1, d); })()
    : null;
  const selectedDayStr = selectedDate
    ? `${selectedDate.getMonth() + 1}월 ${selectedDate.getDate()}일 (${DOW_KO[selectedDate.getDay()]})`
    : "";

  return (
    <div className={styles.container}>

      {/* ── Header ── */}
      <div className={styles.header}>
        <div className={styles.headerNav}>
          <button className={styles.navBtn} onClick={prevMonth}>‹</button>
          <span className={styles.headerTitle}>{year}년 {month}월</span>
          <button className={styles.navBtn} onClick={nextMonth}>›</button>
        </div>
        <button className={styles.settingsBtn} onClick={() => { clearUser(); onBack(); }} title="설정">⚙</button>
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
            <div className={styles.loading}>✨ 운세 계산 중...</div>
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
              {/* 날짜 + 점수 + 뱃지 */}
              <div className={styles.detailTopRow}>
                <div>
                  <div className={styles.detailDate}>{selectedDayStr}</div>
                  <div className={styles.detailLunar}>음력 {selected.lunar_date}</div>
                </div>
                <div className={styles.detailScoreInline}>
                  <span className={`${styles.detailScoreNum} ${getScoreClass(selected.scores.overall)}`}>
                    {selected.scores.overall}
                  </span>
                  <span className={getBadgeClass(selected.badge)}>{selected.badge}</span>
                </div>
              </div>

              {/* 요약 */}
              <div className={styles.detailSummaryBox}>{selected.summary}</div>

              {/* 카테고리 점수 */}
              <div className={styles.detailSection}>
                <div className={styles.sectionTitle}>카테고리별 점수</div>
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

              {/* 할 일 / 피할 일 */}
              <div className={styles.detailSection}>
                <div className={styles.todoRow}>
                  <div className={styles.todoCol}>
                    <div className={styles.todoTitle}>✅ 하면 좋은 것</div>
                    <ul className={styles.todoList}>
                      {selected.todos.do_list.map((item, i) => (
                        <li key={i} className={styles.todoItem}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div className={styles.todoCol}>
                    <div className={`${styles.todoTitle} ${styles.todoTitleDanger}`}>⚠️ 피해야 할 것</div>
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
    </div>
  );
}
