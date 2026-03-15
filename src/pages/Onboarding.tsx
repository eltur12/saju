import { useState } from "react";
import { saveUser } from "../api/fortuneApi";
import type { SajuUser } from "../api/fortuneApi";
import styles from "./Onboarding.module.css";

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

  const currentYear = new Date().getFullYear();
  const years  = Array.from({ length: currentYear - 1929 }, (_, i) => 1930 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const days   = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  // 월/년 변경 시 day가 범위를 벗어나면 마지막 날로 클램핑
  if (day > daysInMonth) setDay(daysInMonth);

  const handleSubmit = () => {
    const user: SajuUser = {
      birth_year:  year,
      birth_month: month,
      birth_day:   day,
      gender,
      ...(hour >= 0 ? { birth_hour: hour } : {}),
    };
    saveUser(user);
    onComplete();
  };

  return (
    <div className={styles.container}>
      <div className={styles.logo}>🌙</div>
      <h1 className={styles.title}>사주 운세</h1>
      <p className={styles.subtitle}>생년월일을 입력하면 매일의 운세를 알려드려요</p>

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
            <select
              className={styles.select}
              value={year}
              onChange={e => setYear(+e.target.value)}
            >
              {years.map(y => <option key={y} value={y}>{y}년</option>)}
            </select>
            <select
              className={styles.select}
              value={month}
              onChange={e => setMonth(+e.target.value)}
            >
              {months.map(m => <option key={m} value={m}>{m}월</option>)}
            </select>
            <select
              className={styles.select}
              value={day}
              onChange={e => setDay(+e.target.value)}
            >
              {days.map(d => <option key={d} value={d}>{d}일</option>)}
            </select>
          </div>
        </div>

        <div className={styles.section}>
          <label className={styles.label}>태어난 시간 (선택)</label>
          <select
            className={styles.select}
            value={hour}
            onChange={e => setHour(+e.target.value)}
            style={{ width: "100%" }}
          >
            {HOURS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
          </select>
        </div>

        <button className={styles.btn} onClick={handleSubmit}>
          운세 확인하기
        </button>
        <p className={styles.hint}>입력 정보는 기기에만 저장됩니다</p>
      </div>
    </div>
  );
}
