import { useState } from "react";
import { saveUser, clearWidgetCache } from "../api/fortuneApi";
import type { SajuUser } from "../api/fortuneApi";
import styles from "./Onboarding.module.css";
import WheelPickerModal from "../components/WheelPickerModal";
import { BIRTH_REGIONS } from "../utils/sajuTime";

function p2(n: number) { return String(n).padStart(2, "0"); }

const BIRTH_DATE_HINTS: Record<string, string> = {
  "01-01": "떡국! 🍲",
  "01-22": "어랏! 😏",
  "02-14": "초콜릿! 🍫",
  "03-14": "사탕! 🍬",
  "03-01": "펄럭!",
  "04-05": "나무! 🌱",
  "05-05": "놀자! 🎈",
  "08-15": "펄럭!",
  "11-11": "빼빼로! 🍫",
  "12-24": "이브! 🎄",
  "12-25": "크리스마스! 🎄",
};

function getBirthDateHint(month: number, day: number): string | null {
  const key = `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return BIRTH_DATE_HINTS[key] ?? null;
}

interface Props { onComplete: () => void }

export default function Onboarding({ onComplete }: Props) {
  const [year, setYear]     = useState(1990);
  const [month, setMonth]   = useState(1);
  const [day, setDay]       = useState(1);
  const [gender, setGender] = useState<"M" | "F">("M");
  const [isUserInteracted, setIsUserInteracted] = useState(false);

  // -1 = 모름 for hour; undefined = 모름 for minute and region
  const [hour,   setHour]   = useState(-1);
  const [minute, setMinute] = useState<number | undefined>(undefined);
  const [region, setRegion] = useState<string | undefined>(undefined);

  // 생년월일 modal draft
  const [birthModalOpen, setBirthModalOpen] = useState(false);
  const [draftYear, setDraftYear]   = useState(1990);
  const [draftMonth, setDraftMonth] = useState(1);
  const [draftDay, setDraftDay]     = useState(1);

  // 시간/지역 modal draft — -1 means "모름" for all three
  const [timeModalOpen, setTimeModalOpen]   = useState(false);
  const [draftHour,      setDraftHour]      = useState(-1);
  const [draftMinute,    setDraftMinute]    = useState(-1);   // -1 = 모름
  const [draftRegionIdx, setDraftRegionIdx] = useState(-1);   // -1 = 모름, 0+ = BIRTH_REGIONS index

  const currentYear      = new Date().getFullYear();
  const daysInMonth      = new Date(year, month, 0).getDate();
  if (day > daysInMonth) setDay(daysInMonth);

  const draftDaysInMonth = new Date(draftYear, draftMonth, 0).getDate();

  // ── 생년월일 picker items ──
  const yearItems     = Array.from({ length: currentYear - 1929 }, (_, i) => ({ label: `${1930 + i}년`, value: 1930 + i }));
  const monthItems    = Array.from({ length: 12 },               (_, i) => ({ label: `${i + 1}월`,     value: i + 1 }));
  const draftDayItems = Array.from({ length: draftDaysInMonth }, (_, i) => ({ label: `${i + 1}일`,     value: i + 1 }));

  // ── 시간/지역 picker items ──
  const hourItems   = [
    { label: "모름", value: -1 },
    ...Array.from({ length: 24 }, (_, i) => ({ label: `${i}시`, value: i })),
  ];
  const minuteItems = [
    { label: "모름", value: -1 },
    ...Array.from({ length: 60 }, (_, i) => ({ label: `${p2(i)}분`, value: i })),
  ];
  const regionItems = [
    { label: "모름", value: -1 },
    ...BIRTH_REGIONS.map((r, i) => ({ label: r.name, value: i })),
  ];

  // ── 생년월일 modal handlers ──
  const openBirthModal = () => {
    setDraftYear(year); setDraftMonth(month); setDraftDay(day);
    setBirthModalOpen(true);
  };
  const confirmBirth = () => {
    setYear(draftYear);
    setMonth(draftMonth);
    setDay(draftDay);
    setIsUserInteracted(true);
    setBirthModalOpen(false);
  };
  const onDraftYearChange = (y: number) => {
    setDraftYear(y);
    const max = new Date(y, draftMonth, 0).getDate();
    if (draftDay > max) setDraftDay(max);
  };
  const onDraftMonthChange = (m: number) => {
    setDraftMonth(m);
    const max = new Date(draftYear, m, 0).getDate();
    if (draftDay > max) setDraftDay(max);
  };

  // ── 시간/지역 modal handlers ──
  const openTimeModal = () => {
    setDraftHour(hour);
    setDraftMinute(minute ?? -1);
    setDraftRegionIdx(
      region !== undefined
        ? Math.max(0, BIRTH_REGIONS.findIndex(r => r.id === region))
        : -1
    );
    setTimeModalOpen(true);
  };
  const confirmTime = () => {
    setHour(draftHour);
    setMinute(draftMinute === -1 ? undefined : draftMinute);
    setRegion(draftRegionIdx === -1 ? undefined : (BIRTH_REGIONS[draftRegionIdx]?.id));
    setTimeModalOpen(false);
  };

  // ── 시간 버튼 표시 텍스트 ──
  const minuteDisplay = minute === undefined ? "모름" : p2(minute);
  const regionDisplay = region !== undefined
    ? (BIRTH_REGIONS.find(r => r.id === region)?.name ?? "모름")
    : "모름";
  const timeLabel = hour === -1
    ? "모름"
    : `${p2(hour)}:${minuteDisplay} · ${regionDisplay}`;

  const handleSubmit = async () => {
    const user: SajuUser = {
      birth_year:  year,
      birth_month: month,
      birth_day:   day,
      gender,
      ...(hour >= 0 ? {
        birth_hour: hour,
        ...(minute !== undefined ? { birth_minute: minute } : {}),
        ...(region !== undefined ? { birth_region: region } : {}),
      } : {}),
    };

    saveUser(user);
    await clearWidgetCache();
    onComplete();
  };

  return (
    <div className={styles.container}>
      <div className={styles.logo}>🌙</div>
      <h1 className={styles.title}>하루온도</h1>
      <p className={styles.subtitle}>생년월일을 입력하면 매일의 흐름을 알려드려요</p>

      <div className={styles.card}>
        <div className={styles.section}>
          <label className={styles.label}>성별</label>
          <div className={styles.genderRow}>
            <button
              className={`${styles.genderBtn} ${gender === "M" ? styles.genderBtnActive : ""}`}
              onClick={() => setGender("M")}
              type="button"
            >
              남성
            </button>
            <button
              className={`${styles.genderBtn} ${gender === "F" ? styles.genderBtnActive : ""}`}
              onClick={() => setGender("F")}
              type="button"
            >
              여성
            </button>
          </div>
        </div>

        <div className={styles.section}>
          <label className={styles.label}>생년월일</label>
          <div className={styles.selectRow}>
            <button type="button" className={styles.pickerBtn} onClick={openBirthModal}>{year}년</button>
            <button type="button" className={styles.pickerBtn} onClick={openBirthModal}>{month}월</button>
            <button type="button" className={styles.pickerBtn} onClick={openBirthModal}>{day}일</button>
          </div>
          {(() => {
            const hint = isUserInteracted ? getBirthDateHint(month, day) : null;
            return hint ? <p className={styles.birthDateHint}>{hint}</p> : null;
          })()}
        </div>

        <div className={styles.section}>
          <label className={styles.label}>태어난 시간/지역 (선택)</label>
          <button
            type="button"
            className={styles.pickerBtn}
            style={{ width: "100%" }}
            onClick={openTimeModal}
          >
            {timeLabel}
          </button>
        </div>

        <button className={styles.btn} onClick={handleSubmit}>
          시작하기
        </button>
        <p className={styles.hint}>입력 정보는 기기에만 저장됩니다</p>
      </div>

      <WheelPickerModal
        open={birthModalOpen}
        title="생년월일 선택"
        columns={[
          { items: yearItems,     value: draftYear,  onChange: onDraftYearChange },
          { items: monthItems,    value: draftMonth, onChange: onDraftMonthChange },
          { items: draftDayItems, value: draftDay,   onChange: setDraftDay },
        ]}
        onClose={() => setBirthModalOpen(false)}
        onConfirm={confirmBirth}
      />

      <WheelPickerModal
        open={timeModalOpen}
        title="태어난 시간/지역 선택"
        columns={[
          { items: hourItems,   value: draftHour,      onChange: setDraftHour },
          { items: minuteItems, value: draftMinute,    onChange: setDraftMinute },
          { items: regionItems, value: draftRegionIdx, onChange: setDraftRegionIdx },
        ]}
        onClose={() => setTimeModalOpen(false)}
        onConfirm={confirmTime}
      />
    </div>
  );
}
