/**
 * 시간대 점수 display norm 검증
 * raw vs display (timeSegments + timeSegmentSummary + notificationHints) 비교
 * Usage: npx tsx scripts/testTimeSegNorm.ts
 */
import { calculateSajuProfile }           from "../src/utils/sajuCalculator";
import { buildZiweiProfile }              from "../src/utils/ziweiCalculator";
import { buildAstroProfile }              from "../src/utils/astroCalculator";
import { normalizeBirthDateTimeByRegion } from "../src/utils/sajuTime";
import { FortuneAggregator }              from "../src/engines/aggregator";

const NORM_TARGET  = 67;
const NORM_MAX_OFF = 6;
const DISPLAY_ADD  = 5;

function normOffset(rawOveralls: number[]): number {
  const avg = rawOveralls.reduce((s, x) => s + x, 0) / rawOveralls.length;
  return Math.max(-NORM_MAX_OFF, Math.min(NORM_MAX_OFF, NORM_TARGET - avg));
}
function norm(raw: number, off: number): number {
  return Math.round(Math.max(0, Math.min(100, raw + off + DISPLAY_ADD)));
}
function pad(v: string | number, w: number) { return String(v).padStart(w); }

const PROFILES = [
  { name: "P1 (1998M 부산)", birth: { year: 1998, month: 1, day: 22, hour: 12, minute: 10 }, gender: "M" as const, region: "busan" },
  { name: "P2 (1990M 서울)", birth: { year: 1990, month: 1, day: 1,  hour: 0,  minute: 0  }, gender: "M" as const, region: "seoul" },
];

const TEST_YEAR = 2026, TEST_MONTH = 5;
const SAMPLE_DAYS = [1, 15, 31];
const line = "══════════════════════════════════════════════════════════════════";
const dash = "──────────────────────────────────────────────────────────────────";

async function main() {
  for (const profile of PROFILES) {
    console.log(`\n${line}`);
    console.log(`▶ ${profile.name}  — ${TEST_YEAR}-${String(TEST_MONTH).padStart(2,"0")}`);
    console.log(line);

    const nb = normalizeBirthDateTimeByRegion({
      year: profile.birth.year, month: profile.birth.month, day: profile.birth.day,
      hour: profile.birth.hour, minute: profile.birth.minute, regionId: profile.region,
    });
    const saju  = calculateSajuProfile(nb.year, nb.month, nb.day, nb.hour, profile.gender, undefined, nb.minute);
    const ziwei = buildZiweiProfile(nb.year, nb.month, nb.day, nb.hour, TEST_YEAR, profile.gender === "M");
    const astro = await buildAstroProfile(nb.year, nb.month, nb.day, nb.hour, undefined, undefined, nb.minute);
    const birthDate = new Date(profile.birth.year, profile.birth.month - 1, profile.birth.day);

    const agg = new FortuneAggregator(saju, ziwei, astro, undefined, birthDate, true);
    const raw = agg.getMonthlyFortune(TEST_YEAR, TEST_MONTH);

    const rawOveralls = raw.daily_fortunes.map(f => f.scores.overall as number);
    const off = normOffset(rawOveralls);
    console.log(`\n  normOffset: ${off >= 0 ? "+" : ""}${off}  |  DISPLAY_ADD: +${DISPLAY_ADD}`);

    for (const day of SAMPLE_DAYS) {
      const f = raw.daily_fortunes[day - 1];
      if (!f) continue;

      console.log(`\n  ── ${f.date} ──`);
      console.log(`  overall  raw=${f.scores.overall}  display=${norm(f.scores.overall as number, off)}`);

      // timeSegments
      if (f.timeSegments && f.timeSegments.length > 0) {
        console.log(`\n  ${"시간대".padEnd(10)} ${"raw".padStart(5)} ${"display".padStart(8)} ${"tags(raw→disp)".padStart(20)}`);
        console.log("  " + dash.slice(0, 50));
        for (const seg of f.timeSegments) {
          const dispScore = norm(seg.score, off);
          const dispTags  = dispScore >= 75 ? "집중·추진" : dispScore >= 60 ? "정리·무난" : dispScore >= 45 ? "신중·유지" : "휴식·주의";
          const rawTags   = seg.tags.join("·");
          console.log(`  ${String(seg.startHour).padStart(2,"0")}:00~${String(seg.endHour).padStart(2,"0")}:00   ${pad(seg.score, 5)} ${pad(dispScore, 8)}    ${rawTags.padEnd(10)} → ${dispTags}`);
        }
      } else {
        console.log("  (timeSegments 없음)");
      }

      // timeSegmentSummary
      const tss = f.timeSegmentSummary;
      if (tss) {
        console.log(`\n  timeSegmentSummary:`);
        console.log(`    best  : startHour=${tss.best.startHour}  raw=${tss.best.score}  display=${norm(tss.best.score, off)}`);
        console.log(`    worst : startHour=${tss.worst.startHour}  raw=${tss.worst.score}  display=${norm(tss.worst.score, off)}`);
        if (tss.rise) console.log(`    rise  : delta=${tss.rise.delta}  (delta 불변)`);
        if (tss.drop) console.log(`    drop  : delta=${tss.drop.delta}  (delta 불변)`);
      }

      // notificationHints
      if (f.notificationHints && f.notificationHints.length > 0) {
        console.log(`\n  notificationHints:`);
        for (const h of f.notificationHints) {
          console.log(`    [${h.type}]  hour=${h.hour}  raw=${h.score}  display=${norm(h.score, off)}  label="${h.label}"`);
        }
      }
    }

    // 전체 통계
    console.log(`\n  전체 통계 (${TEST_MONTH}월 ${raw.daily_fortunes.length}일):`);
    let totalSegs = 0, maxGap = 0;
    for (const f of raw.daily_fortunes) {
      for (const seg of f.timeSegments ?? []) {
        const dispSeg  = norm(seg.score, off);
        const dispOver = norm(f.scores.overall as number, off);
        const gap = Math.abs(dispSeg - dispOver);
        if (gap > maxGap) maxGap = gap;
        totalSegs++;
      }
    }
    const segSpread: number[] = [];
    for (const f of raw.daily_fortunes) {
      const segs = f.timeSegments;
      if (!segs || segs.length === 0) continue;
      const dispSegs = segs.map(s => norm(s.score, off));
      segSpread.push(Math.max(...dispSegs) - Math.min(...dispSegs));
    }
    const avgSpread = segSpread.reduce((s, x) => s + x, 0) / segSpread.length;
    console.log(`  총 시간대 슬롯: ${totalSegs}개  평균 일내 spread: ${Math.round(avgSpread * 10) / 10}점`);
  }

  console.log(`\n✅ 완료`);
}

main().catch(console.error);
