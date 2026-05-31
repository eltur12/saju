/**
 * 월 흐름 타입 + 활성궁 검증 — 100 profiles × 12 months (2025-06 ~ 2026-05)
 * Usage: npx tsx scripts/validateFlowType.ts
 */
import { calculateSajuProfile } from "../src/utils/sajuCalculator";
import { buildZiweiProfile }    from "../src/utils/ziweiCalculator";
import { buildAstroProfile }    from "../src/utils/astroCalculator";
import { FortuneAggregator }    from "../src/engines/aggregator";

// ── NORM_67+5 (fortuneApi.ts 동일 로직) ──────────────────────────────────────
const NORM_TARGET  = 67;
const NORM_MAX_OFF = 6;
const DISPLAY_ADD  = 5;

function computeMonthlyFlowType(displayScores: number[]): string {
  const n = displayScores.length;
  if (n < 2) return "안정형";
  const first10 = displayScores.slice(0, Math.min(10, n));
  const last10  = displayScores.slice(Math.max(0, n - 10));
  const avg10 = (arr: number[]) => arr.reduce((s, x) => s + x, 0) / arr.length;
  const trend = avg10(last10) - avg10(first10);
  if (trend >= 6)  return "상승형";
  if (trend <= -6) return "하강형";
  const goldCount = displayScores.filter(s => s >= 85).length;
  if (goldCount / n >= 0.15) return "집중형";
  const mean = displayScores.reduce((s, x) => s + x, 0) / n;
  const std  = Math.sqrt(displayScores.reduce((s, x) => s + (x - mean) ** 2, 0) / n);
  if (std < 7) return "안정형";
  return "변화형";
}

function applyNorm(rawScores: number[]): number[] {
  const avg = rawScores.reduce((s, x) => s + x, 0) / rawScores.length;
  const off = Math.max(-NORM_MAX_OFF, Math.min(NORM_MAX_OFF, NORM_TARGET - avg));
  return rawScores.map(r => Math.round(Math.max(0, Math.min(100, r + off + DISPLAY_ADD))));
}

// ── 100 profiles ──────────────────────────────────────────────────────────────
const PROFILES = [
  { id:  1, birth:{year:1942,month: 2,day:10,hour: 6}, gender:"M" as const },
  { id:  2, birth:{year:1945,month: 6,day:18,hour:14}, gender:"F" as const },
  { id:  3, birth:{year:1948,month: 9,day: 5,hour:22}, gender:"M" as const },
  { id:  4, birth:{year:1951,month:12,day:25,hour: 3}, gender:"F" as const },
  { id:  5, birth:{year:1954,month: 3,day:14,hour:10}, gender:"M" as const },
  { id:  6, birth:{year:1957,month: 7,day:29,hour:18}, gender:"F" as const },
  { id:  7, birth:{year:1958,month: 4,day: 7,hour: 0}, gender:"M" as const },
  { id:  8, birth:{year:1959,month:10,day:21,hour: 8}, gender:"F" as const },
  { id:  9, birth:{year:1960,month: 1,day:30,hour:16}, gender:"M" as const },
  { id: 10, birth:{year:1961,month: 8,day:12,hour: 2}, gender:"F" as const },
  { id: 11, birth:{year:1962,month:11,day: 3,hour:20}, gender:"M" as const },
  { id: 12, birth:{year:1963,month: 5,day:24,hour:12}, gender:"F" as const },
  { id: 13, birth:{year:1964,month: 2,day:16,hour: 4}, gender:"M" as const },
  { id: 14, birth:{year:1965,month: 4,day: 9,hour:23}, gender:"F" as const },
  { id: 15, birth:{year:1966,month: 6,day:27,hour:15}, gender:"M" as const },
  { id: 16, birth:{year:1967,month: 9,day: 1,hour: 7}, gender:"F" as const },
  { id: 17, birth:{year:1968,month:10,day:19,hour:19}, gender:"M" as const },
  { id: 18, birth:{year:1969,month:12,day: 8,hour:11}, gender:"F" as const },
  { id: 19, birth:{year:1970,month: 1,day:22,hour: 5}, gender:"M" as const },
  { id: 20, birth:{year:1971,month: 3,day:15,hour:21}, gender:"F" as const },
  { id: 21, birth:{year:1972,month: 5,day: 6,hour:13}, gender:"M" as const },
  { id: 22, birth:{year:1973,month: 7,day:31,hour: 9}, gender:"F" as const },
  { id: 23, birth:{year:1974,month: 8,day:23,hour: 1}, gender:"M" as const },
  { id: 24, birth:{year:1975,month:11,day:10,hour:17}, gender:"F" as const },
  { id: 25, birth:{year:1976,month: 2,day: 4,hour: 3}, gender:"M" as const },
  { id: 26, birth:{year:1977,month: 4,day:28,hour:22}, gender:"F" as const },
  { id: 27, birth:{year:1978,month: 9,day:16,hour:14}, gender:"M" as const },
  { id: 28, birth:{year:1979,month:12,day:19,hour: 6}, gender:"F" as const },
  { id: 29, birth:{year:1980,month: 1,day: 7,hour:20}, gender:"M" as const },
  { id: 30, birth:{year:1981,month: 3,day:30,hour:12}, gender:"F" as const },
  { id: 31, birth:{year:1982,month: 6,day:13,hour: 8}, gender:"M" as const },
  { id: 32, birth:{year:1983,month: 7,day:26,hour: 0}, gender:"F" as const },
  { id: 33, birth:{year:1984,month: 8,day:11,hour:16}, gender:"M" as const },
  { id: 34, birth:{year:1985,month:10,day: 4,hour: 4}, gender:"F" as const },
  { id: 35, birth:{year:1986,month:11,day:24,hour:18}, gender:"M" as const },
  { id: 36, birth:{year:1987,month: 1,day:17,hour:10}, gender:"F" as const },
  { id: 37, birth:{year:1988,month: 2,day:22,hour: 2}, gender:"M" as const },
  { id: 38, birth:{year:1989,month: 5,day:15,hour:22}, gender:"F" as const },
  { id: 39, birth:{year:1990,month: 4,day: 9,hour:14}, gender:"M" as const },
  { id: 40, birth:{year:1991,month: 6,day: 1,hour: 6}, gender:"F" as const },
  { id: 41, birth:{year:1992,month: 4,day:20,hour:20}, gender:"M" as const },
  { id: 42, birth:{year:1993,month: 9,day:28,hour:12}, gender:"F" as const },
  { id: 43, birth:{year:1994,month:12,day:16,hour: 4}, gender:"M" as const },
  { id: 44, birth:{year:1995,month:10,day: 7,hour:23}, gender:"F" as const },
  { id: 45, birth:{year:1996,month: 1,day:25,hour:15}, gender:"M" as const },
  { id: 46, birth:{year:1997,month: 7,day:19,hour: 7}, gender:"F" as const },
  { id: 47, birth:{year:1998,month: 8,day:30,hour: 3}, gender:"M" as const },
  { id: 48, birth:{year:1999,month:11,day:13,hour:19}, gender:"F" as const },
  { id: 49, birth:{year:2000,month: 2,day: 6,hour:11}, gender:"M" as const },
  { id: 50, birth:{year:2001,month: 5,day:21,hour: 5}, gender:"F" as const },
  { id: 51, birth:{year:2002,month: 3,day:12,hour:21}, gender:"M" as const },
  { id: 52, birth:{year:2003,month: 6,day:25,hour:13}, gender:"F" as const },
  { id: 53, birth:{year:2004,month: 9,day:18,hour: 9}, gender:"M" as const },
  { id: 54, birth:{year:2005,month: 1,day: 3,hour: 1}, gender:"F" as const },
  { id: 55, birth:{year:1972,month: 3,day:15,hour: 0}, gender:"M" as const },
  { id: 56, birth:{year:1975,month: 8,day:20,hour:12}, gender:"F" as const },
  { id: 57, birth:{year:1978,month:11,day: 7,hour: 6}, gender:"M" as const },
  { id: 58, birth:{year:1981,month: 2,day:27,hour:18}, gender:"F" as const },
  { id: 59, birth:{year:1984,month: 5,day:14,hour: 4}, gender:"M" as const },
  { id: 60, birth:{year:1987,month: 8,day: 3,hour:16}, gender:"F" as const },
  { id: 61, birth:{year:1990,month:10,day:22,hour: 8}, gender:"M" as const },
  { id: 62, birth:{year:1993,month: 4,day:11,hour:20}, gender:"F" as const },
  { id: 63, birth:{year:1996,month: 6,day:30,hour: 2}, gender:"M" as const },
  { id: 64, birth:{year:1999,month: 9,day:17,hour:14}, gender:"F" as const },
  { id: 65, birth:{year:2002,month:12,day: 6,hour:22}, gender:"M" as const },
  { id: 66, birth:{year:2005,month: 7,day:23,hour:10}, gender:"F" as const },
  { id: 67, birth:{year:1966,month: 2,day: 3,hour:12}, gender:"M" as const },
  { id: 68, birth:{year:1970,month:12,day:22,hour: 0}, gender:"F" as const },
  { id: 69, birth:{year:1975,month: 6,day:21,hour: 6}, gender:"M" as const },
  { id: 70, birth:{year:1980,month: 1,day: 1,hour: 0}, gender:"F" as const },
  { id: 71, birth:{year:1985,month:12,day:31,hour:23}, gender:"M" as const },
  { id: 72, birth:{year:1990,month: 8,day: 7,hour:18}, gender:"F" as const },
  { id: 73, birth:{year:1955,month:10,day:13,hour: 3}, gender:"M" as const },
  { id: 74, birth:{year:1963,month:12,day: 4,hour:21}, gender:"F" as const },
  { id: 75, birth:{year:1971,month: 4,day:19,hour: 9}, gender:"M" as const },
  { id: 76, birth:{year:1977,month: 7,day: 8,hour:15}, gender:"F" as const },
  { id: 77, birth:{year:1983,month:11,day:27,hour: 7}, gender:"M" as const },
  { id: 78, birth:{year:1989,month: 2,day: 5,hour:23}, gender:"F" as const },
  { id: 79, birth:{year:1995,month: 5,day:12,hour:11}, gender:"M" as const },
  { id: 80, birth:{year:2001,month: 8,day:24,hour:17}, gender:"F" as const },
  { id: 81, birth:{year:1960,month: 6,day:15,hour: 0}, gender:"M" as const },
  { id: 82, birth:{year:1968,month: 9,day:22,hour: 1}, gender:"F" as const },
  { id: 83, birth:{year:1976,month: 1,day:18,hour:23}, gender:"M" as const },
  { id: 84, birth:{year:1984,month: 4,day: 3,hour:13}, gender:"F" as const },
  { id: 85, birth:{year:1992,month: 7,day:16,hour: 5}, gender:"M" as const },
  { id: 86, birth:{year:2000,month:10,day:29,hour:19}, gender:"F" as const },
  { id: 87, birth:{year:1943,month: 3,day:28,hour:10}, gender:"M" as const },
  { id: 88, birth:{year:1947,month:12,day:11,hour: 4}, gender:"F" as const },
  { id: 89, birth:{year:1952,month: 8,day: 6,hour:20}, gender:"M" as const },
  { id: 90, birth:{year:1956,month: 5,day:30,hour:16}, gender:"F" as const },
  { id: 91, birth:{year:2003,month: 2,day:19,hour: 8}, gender:"M" as const },
  { id: 92, birth:{year:2004,month: 6,day:11,hour:22}, gender:"F" as const },
  { id: 93, birth:{year:1969,month: 3,day:25,hour: 4}, gender:"M" as const },
  { id: 94, birth:{year:1974,month:10,day:14,hour: 2}, gender:"F" as const },
  { id: 95, birth:{year:1979,month: 7,day: 5,hour:20}, gender:"M" as const },
  { id: 96, birth:{year:1986,month: 4,day:16,hour: 6}, gender:"F" as const },
  { id: 97, birth:{year:1993,month:12,day:30,hour:18}, gender:"M" as const },
  { id: 98, birth:{year:1998,month:11,day:21,hour:12}, gender:"F" as const },
  { id: 99, birth:{year:1961,month: 6,day: 8,hour: 8}, gender:"M" as const },
  { id:100, birth:{year:2002,month: 1,day:14,hour:16}, gender:"F" as const },
];

// ── 12개월 목록 (2025-06 ~ 2026-05) ──────────────────────────────────────────
const MONTHS: { year: number; month: number }[] = [];
for (let y = 2025, m = 6; ; ) {
  MONTHS.push({ year: y, month: m });
  if (y === 2026 && m === 5) break;
  m++; if (m > 12) { m = 1; y++; }
}

type Row = {
  profileId: number;
  ym: string;
  palace: string;
  flowType: string;
  std: number;
  trend: number;
  goldPct: number;
};

async function main() {
  const rows: Row[] = [];
  let done = 0;

  for (const p of PROFILES) {
    const saju  = calculateSajuProfile(p.birth.year, p.birth.month, p.birth.day, p.birth.hour, p.gender);
    const astro = await buildAstroProfile(p.birth.year, p.birth.month, p.birth.day, p.birth.hour);

    for (const { year, month } of MONTHS) {
      const ziwei = buildZiweiProfile(p.birth.year, p.birth.month, p.birth.day, p.birth.hour, year, p.gender === "M");
      const agg   = new FortuneAggregator(saju, ziwei, astro, undefined, new Date(p.birth.year, p.birth.month - 1, p.birth.day), true);
      const res   = agg.getMonthlyFortune(year, month);

      const rawScores  = res.daily_fortunes.map(f => f.scores.overall as number);
      const dispScores = applyNorm(rawScores);
      const n = dispScores.length;

      const mean = dispScores.reduce((s, x) => s + x, 0) / n;
      const std  = Math.sqrt(dispScores.reduce((s, x) => s + (x - mean) ** 2, 0) / n);

      const first10 = dispScores.slice(0, Math.min(10, n));
      const last10  = dispScores.slice(Math.max(0, n - 10));
      const avg10   = (arr: number[]) => arr.reduce((s, x) => s + x, 0) / arr.length;
      const trend   = avg10(last10) - avg10(first10);

      const goldPct  = dispScores.filter(s => s >= 85).length / n;
      const flowType = computeMonthlyFlowType(dispScores);
      const palace   = res.monthly_palace;

      rows.push({
        profileId: p.id,
        ym: `${year}-${String(month).padStart(2, "0")}`,
        palace,
        flowType,
        std: Math.round(std * 10) / 10,
        trend: Math.round(trend * 10) / 10,
        goldPct: Math.round(goldPct * 1000) / 10,
      });
    }

    done++;
    if (done % 10 === 0) process.stdout.write(`  ${done}/100 프로필 완료\r`);
  }

  process.stdout.write("\n");

  const total = rows.length;
  console.log(`\n✅ 완료: ${total}건 (${PROFILES.length}프로필 × ${MONTHS.length}개월)\n`);

  const line = "══════════════════════════════════════════════════════";
  const dash = "──────────────────────────────────────────────────────";

  // ── 1. 흐름 타입 분포 ────────────────────────────────────────────────────────
  console.log(line);
  console.log("항목 1: 월 흐름 타입 분포");
  console.log(line + "\n");

  const typeCounts: Record<string, number> = {};
  for (const r of rows) typeCounts[r.flowType] = (typeCounts[r.flowType] ?? 0) + 1;

  const typeOrder = ["상승형", "하강형", "집중형", "안정형", "변화형"];
  for (const t of typeOrder) {
    const n = typeCounts[t] ?? 0;
    const pct = Math.round(n / total * 100);
    const bar = "█".repeat(Math.round(pct / 2));
    console.log(`  ${t.padEnd(5)}  ${String(n).padStart(5)}건  (${String(pct).padStart(3)}%)  ${bar}`);
  }

  // ── 2. 활성궁 분포 ──────────────────────────────────────────────────────────
  console.log("\n" + line);
  console.log("항목 2: 활성궁 분포");
  console.log(line + "\n");

  const palaceCounts: Record<string, number> = {};
  for (const r of rows) {
    const k = r.palace || "(없음)";
    palaceCounts[k] = (palaceCounts[k] ?? 0) + 1;
  }
  const palaceSorted = Object.entries(palaceCounts).sort((a, b) => b[1] - a[1]);
  for (const [k, n] of palaceSorted) {
    const pct = Math.round(n / total * 100);
    console.log(`  ${k.padEnd(8)}  ${String(n).padStart(5)}건  (${String(pct).padStart(3)}%)`);
  }

  // ── 3. 프로필별 흐름 타입 다양성 ─────────────────────────────────────────────
  console.log("\n" + line);
  console.log("항목 3: 프로필별 흐름 타입 다양성 (12개월 중 고유 타입 수)");
  console.log(line + "\n");

  const typesByProfile: Record<number, Set<string>> = {};
  for (const r of rows) {
    if (!typesByProfile[r.profileId]) typesByProfile[r.profileId] = new Set();
    typesByProfile[r.profileId].add(r.flowType);
  }
  const uniqueCounts = Object.values(typesByProfile).map(s => s.size);
  const avgUnique = uniqueCounts.reduce((s, x) => s + x, 0) / uniqueCounts.length;
  const dist: Record<number, number> = {};
  for (const u of uniqueCounts) dist[u] = (dist[u] ?? 0) + 1;

  console.log(`  평균 고유 타입 수: ${Math.round(avgUnique * 10) / 10}개/프로필`);
  for (const [k, v] of Object.entries(dist).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    console.log(`    고유 ${k}개 타입:  ${v}명`);
  }

  // ── 4. 샘플 — 프로필 3개 × 12개월 ───────────────────────────────────────────
  console.log("\n" + line);
  console.log("항목 4: 샘플 프로필 3개 (P001, P039, P099) × 12개월");
  console.log(line + "\n");

  for (const pid of [1, 39, 99]) {
    const pRows = rows.filter(r => r.profileId === pid);
    console.log(`  P${String(pid).padStart(3, "0")}:`);
    console.log(`  ${"월".padEnd(8)} ${"활성궁".padEnd(8)} ${"흐름".padEnd(6)} ${"std".padStart(5)} ${"trend".padStart(7)} ${"85%+".padStart(6)}`);
    console.log("  " + dash.slice(0, 52));
    for (const r of pRows) {
      console.log(`  ${r.ym.padEnd(8)} ${r.palace.padEnd(8)} ${r.flowType.padEnd(6)} ${String(r.std).padStart(5)} ${String(r.trend).padStart(7)} ${String(r.goldPct).padStart(5)}%`);
    }
    console.log("");
  }

  // ── 5. 검증 기준 ─────────────────────────────────────────────────────────────
  console.log(line);
  console.log("항목 5: 검증 기준");
  console.log(line + "\n");

  const noPalace    = rows.filter(r => !r.palace).length;
  const noFlowType  = rows.filter(r => !r.flowType).length;
  const unknownType = rows.filter(r => !typeOrder.includes(r.flowType)).length;

  console.log(`  활성궁 빈 케이스:     ${noPalace}건  (${Math.round(noPalace/total*100)}%)`);
  console.log(`  흐름 타입 빈 케이스:  ${noFlowType}건`);
  console.log(`  알 수 없는 타입:     ${unknownType}건`);

  const maxSingleTypePct = Math.max(...typeOrder.map(t => (typeCounts[t] ?? 0) / total * 100));
  const isOverConcentrated = maxSingleTypePct > 60;

  console.log(`\n  단일 타입 최대 비중: ${Math.round(maxSingleTypePct)}%`);
  console.log(`  과집중 (60% 초과):  ${isOverConcentrated ? "⚠️ 있음" : "✅ 없음"}`);
  console.log(`  활성궁 누락:        ${noPalace === 0 ? "✅ 없음" : `⚠️ ${noPalace}건`}`);
}

main().catch(console.error);
