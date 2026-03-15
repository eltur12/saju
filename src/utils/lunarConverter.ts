/**
 * 양력 → 음력 변환 유틸 (korean-lunar-calendar 패키지 사용)
 */
import KoreanLunarCalendar from "korean-lunar-calendar";

export function getLunarDate(date: Date): string {
  const calendar = new KoreanLunarCalendar();
  calendar.setSolarDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const lunar = calendar.getLunarCalendar();
  const leapStr = lunar.intercalation ? "(윤)" : "";
  return `${lunar.month}/${lunar.day}${leapStr}`;
}
