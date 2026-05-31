/**
 * 2인 프로필 테스트 — 180일 (2025-12-02 ~ 2026-05-31)
 * P1: 1998-01-22 12시10분 부산 남자
 * P2: 1990-01-01 00시00분 서울 남자
 *
 * Usage: npx tsx scripts/testTwoProfiles.ts
 */
import { calculateSajuProfile }          from "../src/utils/sajuCalculator";
import { buildZiweiProfile }              from "../src/utils/ziweiCalculator";
import { buildAstroProfile }              from "../src/utils/astroCalculator";
import { normalizeBirthDateTimeByRegion } from "../src/utils/sajuTime";
import { FortuneAggregator, scoreToBadge } from "../src/engines/aggregator";
import type { MonthlyFortuneResult }      from "../src/engines/aggregator";

// ── NORM_67+5 정규화 (fortuneApi.ts 와 동일 로직) ────────────────────────────
const NORM_TARGET  = 67;
const NORM_MAX_OFF = 6;
const DISPLAY_ADD  = 5;

// ── 기간 ────────────────────────────────────────────────────────────────────
const N_DAYS = 180;
const END    = new Date(2026, 4, 31); // 2026-05-31
const START  = new Date(END);
START.setDate(END.getDate() - (N_DAYS - 1));

// ── 프로필 ──────────────────────────────────────────────────────────────────
const PROFILES = [
  {
    name:   "P1 (1998M 부산)",
    birth:  { year: 1998, month: 1, day: 22, hour: 12, minute: 10 },
    gender: "M" as const,
    region: "busan",
  },
  {
    name:   "P2 (1990M 서울)",
    birth:  { year: 1990, month: 1, day: 1, hour: 0, minute: 0 },
    gender: "M" as const,
    region: "seoul",
  },
];

// ── 유틸 ────────────────────────────────────────────────────────────────────
function r1(v: number)  { return Math.round(v * 10) / 10; }
function avgFn(a: number[]) { return a.reduce((s, x) => s + x, 0) / a.length; }
function stdevFn(a: number[]) {
  const m = avgFn(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length);
}
function pad(s: string | number, w: number) { return String(s).padStart(w); }
function dateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function badgeEmoji(b: string) {
  if (b === "아주좋음") return "🥇";
  if (b === "좋음")     return "✅";
  if (b === "보통")     return "🟡";
  return "🔴";
}

async function buildProfile(p: typeof PROFILES[0], targetYear: number) {
  const nb = normalizeBirthDateTimeByRegion({
    year:     p.birth.year,
    month:    p.birth.month,
    day:      p.birth.day,
    hour:     p.birth.hour,
    minute:   p.birth.minute,
    regionId: p.region,
  });
  const saju  = calculateSajuProfile(nb.year, nb.month, nb.day, nb.hour, p.gender, undefined, nb.minute);
  const ziwei = buildZiweiProfile(nb.year, nb.month, nb.day, nb.hour, targetYear, p.gender === "M");
  const astro = await buildAstroProfile(nb.year, nb.month, nb.day, nb.hour, undefined, undefined, nb.minute);
  const birthDate = new Date(p.birth.year, p.birth.month - 1, p.birth.day);
  return { nb, saju, ziwei, astro, birthDate };
}

async function main() {
  const line = "══════════════════════════════════════════════════════════════════";
  const dash = "──────────────────────────────────────────────────────────────────";

  const startStr = dateStr(START);
  console.log(`\n=== 2인 프로필 테스트 — 180일 (${startStr} ~ 2026-05-31) ===`);
  console.log("구조: displayScore = clamp(raw + NORM67_offset + 5, 0, 100)");
  console.log("배지: 85+ 아주좋음 / 75~84 좋음 / 61~74 보통 / 60이하 주의\n");

  for (const profile of PROFILES) {
    console.log(line);
    const bStr = `${profile.birth.year}-${String(profile.birth.month).padStart(2,"0")}-${String(profile.birth.day).padStart(2,"0")} ${String(profile.birth.hour).padStart(2,"0")}:${String(profile.birth.minute).padStart(2,"0")}`;
    console.log(`▶ ${profile.name}  (출생: ${bStr}  지역: ${profile.region})`);
    console.log(line + "\n");

    const built = await buildProfile(profile, END.getFullYear());

    console.log(`  진태양시 보정: ${profile.birth.hour}:${String(profile.birth.minute).padStart(2,"0")} → ${built.nb.hour}:${String(built.nb.minute ?? 0).padStart(2,"0")}\n`);

    const agg = new FortuneAggregator(
      built.saju, built.ziwei, built.astro,
      undefined, built.birthDate, true,
    );

    // 180일 raw 수집 (월별 묶음)
    type DayRaw = { date: string; raw: number };
    const rawEntries: DayRaw[] = [];
    let monthCache: MonthlyFortuneResult | null = null;
    let cachedYM = "";

    for (let i = 0; i < N_DAYS; i++) {
      const d  = new Date(START);
      d.setDate(START.getDate() + i);
      const y  = d.getFullYear(), m = d.getMonth() + 1;
      const ym = `${y}-${m}`;
      if (ym !== cachedYM) {
        monthCache = agg.getMonthlyFortune(y, m);
        cachedYM   = ym;
      }
      const ds = dateStr(d);
      const f  = monthCache!.daily_fortunes.find(x => x.date === ds);
      if (f) rawEntries.push({ date: ds, raw: f.scores.overall as number });
    }

    // NORM_67+5 계산
    const rawScores = rawEntries.map(e => e.raw);
    const rawAvg    = r1(avgFn(rawScores));
    const normOff   = r1(Math.max(-NORM_MAX_OFF, Math.min(NORM_MAX_OFF, NORM_TARGET - rawAvg)));
    const entries   = rawEntries.map(e => ({
      date:    e.date,
      raw:     e.raw,
      display: Math.round(Math.max(0, Math.min(100, e.raw + normOff + DISPLAY_ADD))),
    }));
    const dispScores = entries.map(e => e.display);

    // 헤더 통계
    console.log(`  raw 평균: ${rawAvg}  │  normOffset: ${normOff >= 0 ? "+" : ""}${normOff}  │  display avg: ${r1(avgFn(dispScores))}`);
    console.log(`  raw 범위: ${Math.min(...rawScores)} ~ ${Math.max(...rawScores)}`);
    console.log(`  disp 범위: ${Math.min(...dispScores)} ~ ${Math.max(...dispScores)}  │  std: ${r1(stdevFn(dispScores))}\n`);

    // 일별 표
    console.log(`  ${"날짜".padEnd(12)} ${"raw".padStart(4)} ${"disp".padStart(5)}  배지`);
    console.log("  " + dash.slice(0, 48));
    for (const e of entries) {
      const b     = scoreToBadge(e.display);
      const emoji = badgeEmoji(b);
      const mark  = e.date === "2026-05-31" ? " ◀ 오늘" : "";
      console.log(`  ${e.date.padEnd(12)} ${pad(e.raw, 4)} ${pad(e.display, 5)}  ${emoji} ${b}${mark}`);
    }

    // 배지 분포
    const T   = entries.length;
    const b85 = entries.filter(e => e.display >= 85).length;
    const b75 = entries.filter(e => e.display >= 75 && e.display < 85).length;
    const b61 = entries.filter(e => e.display >= 61 && e.display < 75).length;
    const b60 = entries.filter(e => e.display <= 60).length;
    console.log(`\n  배지 분포 (${T}일):`);
    console.log(`    🥇 아주좋음 (85+):  ${b85}일  (${Math.round(b85/T*100)}%)`);
    console.log(`    ✅ 좋음 (75~84):    ${b75}일  (${Math.round(b75/T*100)}%)`);
    console.log(`    🟡 보통 (61~74):    ${b61}일  (${Math.round(b61/T*100)}%)`);
    console.log(`    🔴 주의 (60이하):   ${b60}일  (${Math.round(b60/T*100)}%)`);

    // 월별 평균
    console.log(`\n  월별 display 평균:`);
    const monthMap: Record<string, number[]> = {};
    for (const e of entries) {
      const ym = e.date.slice(0, 7);
      (monthMap[ym] ??= []).push(e.display);
    }
    for (const [ym, vals] of Object.entries(monthMap)) {
      const avg = r1(avgFn(vals));
      const bar = "█".repeat(Math.round(avg / 5));
      console.log(`    ${ym}  avg ${pad(avg, 5)}  ${bar}`);
    }

    // 오늘 상세 (카테고리 원점수 — raw month 재계산)
    const may = agg.getMonthlyFortune(2026, 5);
    const todayRaw = may.daily_fortunes.find(f => f.date === "2026-05-31");
    const todayDisp = entries.find(e => e.date === "2026-05-31")?.display;
    if (todayRaw && todayDisp !== undefined) {
      const badge = scoreToBadge(todayDisp);
      console.log(`\n  ─── 오늘 (2026-05-31) 상세 ───`);
      console.log(`  overall: ${todayDisp}점  배지: ${badgeEmoji(badge)} ${badge}`);
      const cats = ["wealth","love","health","career","relations","study"] as const;
      const labels: Record<string, string> = { wealth:"재물", love:"애정", health:"건강", career:"직업", relations:"인간관계", study:"학업" };
      for (const c of cats) {
        console.log(`  ${labels[c].padEnd(6)}: ${pad(todayRaw.scores[c] as number, 3)}점`);
      }
      console.log(`  요약: ${todayRaw.summary}`);
    }
    console.log("");
  }
}

main().catch(console.error);
