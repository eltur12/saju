import { useState } from "react";
import { saveUser, clearWidgetCache } from "../api/fortuneApi";
import type { SajuUser } from "../api/fortuneApi";
import styles from "./Onboarding.module.css";
import WheelPickerModal from "../components/WheelPickerModal";

const HOURS = [
  { label: "모름", value: -1 },
  { label: "자시 (23~01시)", value: 0 },
  { label: "축시 (01~03시)", value: 2 },
  { label: "인시 (03~05시)", value: 4 },
  { label: "묘시 (05~07시)", value: 6 },
  { label: "진시 (07~09시)", value: 8 },
  { label: "사시 (09~11시)", value: 10 },
  { label: "오시 (11~13시)", value: 12 },
  { label: "미시 (13~15시)", value: 14 },
  { label: "신시 (15~17시)", value: 16 },
  { label: "유시 (17~19시)", value: 18 },
  { label: "술시 (19~21시)", value: 20 },
  { label: "해시 (21~23시)", value: 22 },
];

interface Props { onComplete: () => void }

export default function Onboarding({ onComplete }: Props) {
  const [year, setYear]     = useState(1990);
  const [month, setMonth]   = useState(1);
  const [day, setDay]       = useState(1);
  const [hour, setHour]     = useState(-1);
  const [gender, setGender] = useState<"M" | "F">("M");

  const [birthModalOpen, setBirthModalOpen] = useState(false);
  const [draftYear, setDraftYear]   = useState(1990);
  const [draftMonth, setDraftMonth] = useState(1);
  const [draftDay, setDraftDay]     = useState(1);

  const [timeModalOpen, setTimeModalOpen] = useState(false);
  const [draftHour, setDraftHour]   = useState(-1);

  const currentYear = new Date().getFullYear();
  const daysInMonth = new Date(year, month, 0).getDate();
  // 월/년 변경 시 day가 범위를 벗어나면 마지막 날로 클램핑
  if (day > daysInMonth) setDay(daysInMonth);

  const draftDaysInMonth = new Date(draftYear, draftMonth, 0).getDate();

  const yearItems  = Array.from({ length: currentYear - 1929 }, (_, i) => ({ label: `${1930 + i}년`, value: 1930 + i }));
  const monthItems = Array.from({ length: 12 }, (_, i) => ({ label: `${i + 1}월`, value: i + 1 }));
  const draftDayItems = Array.from({ length: draftDaysInMonth }, (_, i) => ({ label: `${i + 1}일`, value: i + 1 }));

  const openBirthModal = () => {
    setDraftYear(year); setDraftMonth(month); setDraftDay(day);
    setBirthModalOpen(true);
  };
  const confirmBirth = () => {
    setYear(draftYear); setMonth(draftMonth); setDay(draftDay);
    setBirthModalOpen(false);
  };

  const openTimeModal = () => { setDraftHour(hour); setTimeModalOpen(true); };
  const confirmTime   = () => { setHour(draftHour); setTimeModalOpen(false); };

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

  const handleSubmit = async () => {
    const user: SajuUser = {
      birth_year:  year,
      birth_month: month,
      birth_day:   day,
      gender,
      ...(hour >= 0 ? { birth_hour: hour } : {}),
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
        </div>

        <div className={styles.section}>
          <label className={styles.label}>태어난 시간 (선택)</label>
          <button
            type="button"
            className={styles.pickerBtn}
            style={{ width: "100%" }}
            onClick={openTimeModal}
          >
            {HOURS.find(h => h.value === hour)?.label ?? "모름"}
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
        title="태어난 시간 선택"
        columns={[
          { items: HOURS, value: draftHour, onChange: setDraftHour },
        ]}
        onClose={() => setTimeModalOpen(false)}
        onConfirm={confirmTime}
      />
    </div>
  );
}
