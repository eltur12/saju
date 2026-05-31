/**
 * Category score bias diagnostic — raw vs display
 * Usage: npx tsx scripts/testCategoryBias.ts
 */
import { calculateSajuProfile }           from "../src/utils/sajuCalculator";
import { buildZiweiProfile }              from "../src/utils/ziweiCalculator";
import { buildAstroProfile }              from "../src/utils/astroCalculator";
import { normalizeBirthDateTimeByRegion } from "../src/utils/sajuTime";
import { FortuneAggregator }              from "../src/engines/aggregator";

const NORM_TARGET  = 67;
const NORM_MAX_OFF = 6;
const DISPLAY_ADD  = 5;
const CAT_KEYS = ["wealth", "love", "health", "career", "relations", "study"] as const;

function normOffset(rawOveralls: number[]): number {
  const avg = rawOveralls.reduce((s, x) => s + x, 0) / rawOveralls.length;
  return Math.max(-NORM_MAX_OFF, Math.min(NORM_MAX_OFF, NORM_TARGET - avg));
}
function norm(raw: number, off: number): number {
  return Math.round(Math.max(0, Math.min(100, raw + off + DISPLAY_ADD)));
}
function avg(vals: number[]): number { return vals.reduce((s,x)=>s+x,0)/vals.length; }
function stddev(vals: number[]): number {
  const m = avg(vals);
  return Math.sqrt(vals.reduce((s,x)=>s+(x-m)**2,0)/vals.length);
}
function r1(v: number) { return Math.round(v*10)/10; }
function pad(v: string|number, w: number) { return String(v).padStart(w); }

const PROFILES = [
  { name: "P1 (1998M 부산)", birth: { year:1998,month:1,day:22,hour:12,minute:10 }, gender:"M" as const, region:"busan" },
  { name: "P2 (1990M 서울)", birth: { year:1990,month:1,day:1, hour:0, minute:0  }, gender:"M" as const, region:"seoul" },
];
const TEST_YEAR = 2026, TEST_MONTH = 5;
const LINE = "═".repeat(88);
const DASH = "─".repeat(88);

async function runProfile(profile: typeof PROFILES[0]) {
  const nb = normalizeBirthDateTimeByRegion({
    year:profile.birth.year, month:profile.birth.month, day:profile.birth.day,
    hour:profile.birth.hour, minute:profile.birth.minute, regionId:profile.region,
  });
  const saju  = calculateSajuProfile(nb.year, nb.month, nb.day, nb.hour, profile.gender, undefined, nb.minute);
  const ziwei = buildZiweiProfile(nb.year, nb.month, nb.day, nb.hour, TEST_YEAR, profile.gender==="M");
  const astro = await buildAstroProfile(nb.year, nb.month, nb.day, nb.hour, undefined, undefined, nb.minute);
  const birthDate = new Date(profile.birth.year, profile.birth.month-1, profile.birth.day);
  const agg = new FortuneAggregator(saju, ziwei, astro, undefined, birthDate, true);
  const raw = agg.getMonthlyFortune(TEST_YEAR, TEST_MONTH);

  const rawOveralls = raw.daily_fortunes.map(f => f.scores.overall as number);
  const off = normOffset(rawOveralls);

  console.log(`\n${LINE}`);
  console.log(`▶ ${profile.name}  — ${TEST_YEAR}-${String(TEST_MONTH).padStart(2,"0")}  normOffset=${off>=0?"+":""}${off}  DISPLAY_ADD=+${DISPLAY_ADD}`);
  console.log(LINE);

  // ── 30일 테이블 ──
  const hdr = ["date","overall",...CAT_KEYS,"1위","2위","최하위"];
  console.log(hdr.map((c,i)=>i===0?c.padEnd(10):pad(c,8)).join(""));
  console.log(DASH);

  const rank1: Record<string,number> = {};
  const rank2: Record<string,number> = {};
  const rankLast: Record<string,number> = {};
  const dispVals: Record<string,number[]> = {};
  const rawVals:  Record<string,number[]> = {};
  for (const c of CAT_KEYS) { rank1[c]=0; rank2[c]=0; rankLast[c]=0; dispVals[c]=[]; rawVals[c]=[]; }

  for (const f of raw.daily_fortunes) {
    const dOverall = norm(f.scores.overall as number, off);
    const disp: Record<string,number> = {};
    for (const c of CAT_KEYS) {
      const d = norm(f.scores[c] as number, off);
      disp[c] = d;
      dispVals[c].push(d);
      rawVals[c].push(f.scores[c] as number);
    }
    const sorted = [...CAT_KEYS].sort((a,b)=>disp[b]-disp[a]);
    rank1[sorted[0]]++;
    rank2[sorted[1]]++;
    rankLast[sorted[sorted.length-1]]++;

    console.log([
      f.date.slice(5).padEnd(10),
      pad(dOverall,8),
      ...CAT_KEYS.map(c=>pad(disp[c],8)),
      pad(sorted[0],10),
      pad(sorted[1],8),
      pad(sorted[sorted.length-1],8),
    ].join(""));
  }

  // ── 카테고리별 통계 ──
  console.log(`\n── 카테고리별 통계 (display) ──`);
  const sh = ["cat","avg_raw","avg_disp","std_disp","1위","2위","최하위"];
  console.log(sh.map((c,i)=>i===0?c.padEnd(12):pad(c,9)).join(""));
  console.log("─".repeat(12+9*6));
  const n = raw.daily_fortunes.length;
  for (const c of CAT_KEYS) {
    console.log([
      c.padEnd(12),
      r1(avg(rawVals[c])).toFixed(1).padStart(9),
      r1(avg(dispVals[c])).toFixed(1).padStart(9),
      r1(stddev(dispVals[c])).toFixed(1).padStart(9),
      pad(rank1[c],9),
      pad(rank2[c],9),
      pad(rankLast[c],9),
    ].join(""));
  }

  const csFirst = (rank1["career"]||0)+(rank1["study"]||0);
  const lrFirst = (rank1["love"]||0)+(rank1["relations"]||0);
  const wFirst  = rank1["wealth"]||0;
  console.log(`\n  career+study 1위: ${csFirst}일 (${r1(csFirst/n*100)}%)`);
  console.log(`  love+relations 1위: ${lrFirst}일 (${r1(lrFirst/n*100)}%)`);
  console.log(`  wealth 1위: ${wFirst}일 (${r1(wFirst/n*100)}%)`);

  // 카테고리 평균 최고-최저 차이
  const avgVals = CAT_KEYS.map(c=>avg(dispVals[c]));
  const maxAvg = Math.max(...avgVals);
  const minAvg = Math.min(...avgVals);
  console.log(`  카테고리 평균 max-min 차이: ${r1(maxAvg-minAvg)}점`);
}

async function main() {
  for (const p of PROFILES) await runProfile(p);
  console.log(`\n✅ 완료`);
}
main().catch(console.error);
