/**
 * 한국 하계표준시(KDT) 유틸리티
 *
 * 1987~1988년 88올림픽 준비를 위해 시행된 하계표준시(UTC+10) 보정.
 * SwissEph 등 무거운 의존성 없이 saju/ziwei/natal 모두에서 사용 가능.
 */

/** 한국 하계표준시(KDT) 기간인지 판정 (1987~1988 88올림픽) */
export function isKoreanDaylightTime(year: number, month: number, day: number): boolean {
  if (year === 1987) {
    // 1987-05-10 ~ 1987-10-11
    if (month > 5 && month < 10) return true
    if (month === 5 && day >= 10) return true
    if (month === 10 && day <= 11) return true
  }
  if (year === 1988) {
    // 1988-05-08 ~ 1988-10-09
    if (month > 5 && month < 10) return true
    if (month === 5 && day >= 8) return true
    if (month === 10 && day <= 9) return true
  }
  return false
}

/** KDT 시각 → KST로 보정 (1시간 감산). 날짜 롤백 포함. */
export function adjustKdtToKst(
  year: number, month: number, day: number,
  hour: number, minute: number,
): { year: number; month: number; day: number; hour: number; minute: number } {
  if (!isKoreanDaylightTime(year, month, day)) {
    return { year, month, day, hour, minute }
  }
  hour -= 1
  if (hour < 0) {
    hour += 24
    const d = new Date(year, month - 1, day - 1)
    year = d.getFullYear()
    month = d.getMonth() + 1
    day = d.getDate()
  }
  return { year, month, day, hour, minute }
}
