/**
 * SajuEngine 정적 기준선 분리 실험
 * Usage: npx tsx scripts/analyzeStaticBaseline.ts
 *
 * 목표: 특별성, 출생월TG, 원국패널티, 대운TG를 제거했을 때
 *       사용자 간 평균 점수 차이가 줄어드는지 측정.
 *
 * 실험 구성 (6가지):
 *   FULL        — 현행 (4가지 정적 요소 모두 포함)
 *   NO_NATAL    — 원국 패널티만 제외
 *   NO_BIRTH_TG — 출생월 TG만 제외
 *   NO_STARS    — 특별성만 제외
 *   NO_DAYUN    — 대운만 제외
 *   DYNAMIC     — 4가지 전부 제외
 */
import { calculateSajuProfile }   from "../src/utils/sajuCalculator";
import { buildZiweiProfile }       from "../src/utils/ziweiCalculator";
import { buildAstroProfile }       from "../src/utils/astroCalculator";
import { FortuneAggregator }       from "../src/engines/aggregator";
import { DEFAULT_ZIWEI_FLAGS }     from "../src/engines/ziweiEngine";
import {
  DEFAULT_SAJU_FLAGS,
  DYNAMIC_ONLY_SAJU_FLAGS,
  type SajuExperimentFlags,
} from "../src/engines/sajuEngine";
import type { DailyFortune }       from "../src/engines/aggregator";
import type { ScoreMap }           from "../src/engines/sajuEngine";

// ── 프로필 ────────────────────────────────────────────────────────────────────
const PROFILES = [
  {
    label: "A (천덕귀인·좋은원국)",
    birth: { year:1988, month:6,  day:6,  hour:10, minute:0 },
    gender: "M" as const,
  },
  {
    label: "B (겁살·나쁜원국)",
    birth: { year:1979, month:2,  day:11, hour:1,  minute:0 },
    gender: "M" as const,
  },
  {
    label: "C (중립원국)",
    birth: { year:1992, month:10, day:20, hour:14, minute:0 },
    gender: "F" as const,
  },
];

const START  = new Date(2026, 2, 1);
const N_DAYS = 92;
const DOM: (keyof ScoreMap)[] = ["wealth","love","health","career","relations","study"];

function r1(v: number) { return Math.round(v * 10) / 10; }
function avg(a: number[]) { return a.reduce((s,x)=>s+x,0)/a.length; }
function stdev(a: number[]) {
  const m = avg(a);
  return Math.sqrt(a.reduce((s,x)=>s+(x-m)**2,0)/a.length);
}
function pad(s: string|number, w: number) { return String(s).padStart(w); }
function padR(s: string|number, w: number) { return String(s).padEnd(w); }

// ── 실험 구성 ─────────────────────────────────────────────────────────────────
const EXPERIMENTS: { label: string; flags: SajuExperimentFlags }[] = [
  { label: "FULL",        flags: DEFAULT_SAJU_FLAGS },
  { label: "NO_NATAL",    flags: { ...DEFAULT_SAJU_FLAGS, SKIP_NATAL_PENALTY:  true } },
  { label: "NO_BIRTH_TG", flags: { ...DEFAULT_SAJU_FLAGS, SKIP_BIRTH_MONTH_TG: true } },
  { label: "NO_STARS",    flags: { ...DEFAULT_SAJU_FLAGS, SKIP_SPECIAL_STARS:  true } },
  { label: "NO_DAYUN",    flags: { ...DEFAULT_SAJU_FLAGS, SKIP_DAYUN:          true } },
  { label: "DYNAMIC",     flags: DYNAMIC_ONLY_SAJU_FLAGS },
];

// ── 프로필 빌드 ───────────────────────────────────────────────────────────────
interface ProfileData {
  label: string;
  sajuProfile:  ReturnType<typeof calculateSajuProfile>;
  ziweiProfile: ReturnType<typeof buildZiweiProfile>;
  astroProfile: Awaited<ReturnType<typeof buildAstroProfile>>;
  birthDate:    Date;
}

async function buildProfileData(p: typeof PROFILES[0]): Promise<ProfileData> {
  const { birth, gender } = p;
  return {
    label:        p.label,
    sajuProfile:  calculateSajuProfile(birth.year, birth.month, birth.day, birth.hour, gender, undefined, birth.minute),
    ziweiProfile: buildZiweiProfile(birth.year, birth.month, birth.day, birth.hour, 2026, gender === "M"),
    astroProfile: await buildAstroProfile(birth.year, birth.month, birth.day, birth.hour, undefined, undefined, birth.minute),
    birthDate:    new Date(birth.year, birth.month - 1, birth.day),
  };
}

function runDays(pd: ProfileData, sajuFlags: SajuExperimentFlags): DailyFortune[] {
  const agg = new FortuneAggregator(
    pd.sajuProfile, pd.ziweiProfile, pd.astroProfile,
    undefined, pd.birthDate, true,
  );
  const days: DailyFortune[] = [];
  for (let i = 0; i < N_DAYS; i++) {
    const d = new Date(START);
    d.setDate(START.getDate() + i);
    days.push(agg.getDailyFortune(d, DEFAULT_ZIWEI_FLAGS, sajuFlags));
  }
  return days;
}

// ── 통계 계산 ─────────────────────────────────────────────────────────────────
interface Stats {
  overall: { avg: number; std: number; min: number; max: number };
  cats: Record<keyof ScoreMap, { avg: number; std: number }>;
}

function calcStats(days: DailyFortune[]): Stats {
  const overall = days.map(d => d.scores.overall);
  const cats = {} as Record<keyof ScoreMap, { avg: number; std: number }>;
  for (const c of DOM) {
    const vals = days.map(d => d.scores[c]);
    cats[c] = { avg: r1(avg(vals)), std: r1(stdev(vals)) };
  }
  return {
    overall: { avg: r1(avg(overall)), std: r1(stdev(overall)), min: Math.min(...overall), max: Math.max(...overall) },
    cats,
  };
}

// ── 메인 ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("=== SajuEngine 정적 기준선 분리 실험 ===");
  console.log(`기간: 2026-03-01 ~ ${N_DAYS}일  프로필: ${PROFILES.length}개\n`);

  console.log("프로필 빌드 중...");
  const profileData = await Promise.all(PROFILES.map(buildProfileData));
  console.log("완료\n");

  // 전체 결과 수집
  const results: Array<{
    expLabel: string;
    stats: Stats[];           // per profile
  }> = [];

  for (const exp of EXPERIMENTS) {
    const stats: Stats[] = [];
    for (const pd of profileData) {
      const days = runDays(pd, exp.flags);
      stats.push(calcStats(days));
    }
    results.push({ expLabel: exp.label, stats });
  }

  // ── TASK 1: 정적 요소별 개별 기여도 ─────────────────────────────────────────
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log("TASK 1: 정적 요소별 평균 기여도 (FULL 대비 제거 시 변화)");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  const fullResult = results.find(r => r.expLabel === "FULL")!;

  console.log("요소              프로필A 변화   프로필B 변화   프로필C 변화   평균변화");
  console.log("─".repeat(72));

  const componentExps = ["NO_NATAL","NO_BIRTH_TG","NO_STARS","NO_DAYUN"];
  const componentLabels: Record<string, string> = {
    NO_NATAL:    "원국패널티 제거",
    NO_BIRTH_TG: "출생월TG 제거 ",
    NO_STARS:    "특별성 제거   ",
    NO_DAYUN:    "대운 제거     ",
  };

  for (const expLabel of componentExps) {
    const expResult = results.find(r => r.expLabel === expLabel)!;
    const changes = profileData.map((pd, i) => {
      const diff = expResult.stats[i].overall.avg - fullResult.stats[i].overall.avg;
      return diff;
    });
    const meanChange = avg(changes);
    const label = componentLabels[expLabel];
    const cols = changes.map(c => `${c >= 0 ? "+" : ""}${r1(c)}`).map(s => pad(s,8)).join("  ");
    console.log(`${padR(label, 18)} ${cols}  ${pad(r1(meanChange) >= 0 ? "+"+r1(meanChange) : r1(meanChange), 8)}`);
  }

  // DYNAMIC (전부 제거)
  const dynResult = results.find(r => r.expLabel === "DYNAMIC")!;
  const dynChanges = profileData.map((_, i) =>
    dynResult.stats[i].overall.avg - fullResult.stats[i].overall.avg
  );
  console.log(`${"전부 제거(DYNAMIC)".padEnd(18)} ${dynChanges.map(c => pad(`${c>=0?"+":""}${r1(c)}`,8)).join("  ")}  ${pad(r1(avg(dynChanges)),8)}`);

  // ── TASK 2: 모드별 프로필 avg/std 전체 표 ────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log("TASK 2: 실험별 × 프로필별 overall avg / std");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  // 헤더
  const profCols = profileData.map(pd => padR(pd.label.split(" ")[0], 12)).join("");
  console.log(`${"실험".padEnd(14)} ${profCols}  A/B갭  A/C갭  B/C갭  3인std`);
  console.log("─".repeat(80));

  for (const r of results) {
    const avgs  = r.stats.map(s => s.overall.avg);
    const stds  = r.stats.map(s => s.overall.std);
    const abGap = r1(Math.abs(avgs[0] - avgs[1]));
    const acGap = r1(Math.abs(avgs[0] - avgs[2]));
    const bcGap = r1(Math.abs(avgs[1] - avgs[2]));
    const interStd = r1(stdev(avgs));

    const cols = avgs.map((a, i) => `${r1(a)}±${stds[i]}`).map(s => pad(s, 11)).join(" ");
    console.log(`${padR(r.expLabel, 14)} ${cols}  ${pad(abGap,5)}  ${pad(acGap,5)}  ${pad(bcGap,5)}  ${pad(interStd,6)}`);
  }

  // ── TASK 3: 유저 간 갭 변화 요약 ─────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log("TASK 3: 사용자 간 평균 갭 변화 (3인 표준편차 기준)");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  const fullInterStd   = r1(stdev(fullResult.stats.map(s => s.overall.avg)));
  const dynInterStd    = r1(stdev(dynResult.stats.map(s => s.overall.avg)));
  const reduction      = r1(((fullInterStd - dynInterStd) / fullInterStd) * 100);

  console.log(`FULL    3인 inter-user std: ${fullInterStd}`);
  console.log(`DYNAMIC 3인 inter-user std: ${dynInterStd}`);
  console.log(`갭 감소율: ${reduction}%`);
  console.log();

  console.log("요소 제거별 3인 std:");
  for (const expLabel of [...componentExps, "DYNAMIC"]) {
    const r = results.find(x => x.expLabel === expLabel)!;
    const iStd = r1(stdev(r.stats.map(s => s.overall.avg)));
    const delta = r1(iStd - fullInterStd);
    const bar = delta < 0 ? "▼".repeat(Math.min(Math.round(-delta), 10)) : "▲".repeat(Math.min(Math.round(delta), 10));
    console.log(`  ${padR(expLabel, 12)} inter-std=${iStd}  (${delta >= 0 ? "+" : ""}${delta})  ${bar}`);
  }

  // ── TASK 4: 카테고리별 평균 변화 (FULL vs DYNAMIC) ────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log("TASK 4: 카테고리별 평균 변화 (FULL → DYNAMIC, 프로필별)");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  console.log(`${"카테고리".padEnd(10)} ${"A FULL→DYN".padEnd(14)} ${"B FULL→DYN".padEnd(14)} ${"C FULL→DYN".padEnd(14)}`);
  console.log("─".repeat(56));

  for (const cat of DOM) {
    const cols = profileData.map((_, i) => {
      const fAvg = fullResult.stats[i].cats[cat].avg;
      const dAvg = dynResult.stats[i].cats[cat].avg;
      const diff = r1(dAvg - fAvg);
      return `${fAvg}→${dAvg} (${diff >= 0 ? "+" : ""}${diff})`.padEnd(14);
    }).join(" ");
    console.log(`${padR(cat, 10)} ${cols}`);
  }

  // ── TASK 5: 개별 요소 기여도 분해 (정적 합계 재구성) ─────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log("TASK 5: 정적 요소 4개의 사용자 기준선 기여도 분해");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  // 각 요소가 각 프로필의 평균에 미치는 영향 = FULL avg - (해당 요소 제거) avg
  const decompRows: Array<{ name: string; vals: number[] }> = [];

  for (const expLabel of componentExps) {
    const expR = results.find(r => r.expLabel === expLabel)!;
    const name = componentLabels[expLabel].trim();
    const vals = profileData.map((_, i) =>
      fullResult.stats[i].overall.avg - expR.stats[i].overall.avg
    );
    decompRows.push({ name, vals });
  }

  // 합계 확인 (교호작용 무시한 가법 근사)
  const sumRow = profileData.map((_, i) =>
    decompRows.reduce((s, r) => s + r.vals[i], 0)
  );
  // DYNAMIC 실제 제거 효과
  const dynRow = profileData.map((_, i) =>
    fullResult.stats[i].overall.avg - dynResult.stats[i].overall.avg
  );

  console.log(`${"요소".padEnd(16)} ${"A 기여".padStart(8)} ${"B 기여".padStart(8)} ${"C 기여".padStart(8)}  A-B차이  설명`);
  console.log("─".repeat(72));

  for (const row of decompRows) {
    const ab = r1(row.vals[0] - row.vals[1]);
    const sign = (v: number) => v >= 0 ? "+" : "";
    const cols = row.vals.map(v => `${sign(v)}${r1(v)}`).map(s => pad(s,8)).join(" ");
    const interpretation =
      Math.abs(row.vals[0] - row.vals[1]) > 2.0 ? "◀ 사용자 차이 큼" :
      Math.abs(row.vals[0] - row.vals[1]) > 0.5 ? "◁ 사용자 차이 중간" : "";
    console.log(`${padR(row.name, 16)} ${cols}  ${pad(ab >= 0 ? "+"+ab : ab, 7)}  ${interpretation}`);
  }

  console.log("─".repeat(72));
  const signFn = (v: number) => v >= 0 ? "+" : "";
  console.log(`${"요소별 합계(가법)".padEnd(16)} ${sumRow.map(v => pad(`${signFn(v)}${r1(v)}`,8)).join(" ")}  ${pad(r1(sumRow[0]-sumRow[1]),7)}`);
  console.log(`${"DYNAMIC 실측값".padEnd(16)} ${dynRow.map(v => pad(`${signFn(v)}${r1(v)}`,8)).join(" ")}  ${pad(r1(dynRow[0]-dynRow[1]),7)}`);
  console.log(`${"교호작용".padEnd(16)} ${dynRow.map((v,i) => pad(`${signFn(v-sumRow[i])}${r1(v-sumRow[i])}`,8)).join(" ")}`);

  // ── TASK 6: 결론 ────────────────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log("TASK 6: 결론 및 권고");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  // 어떤 요소가 A-B 갭을 가장 크게 만드는가
  const abContribs = decompRows.map(r => ({ name: r.name, abDiff: Math.abs(r1(r.vals[0] - r.vals[1])) }));
  abContribs.sort((a, b) => b.abDiff - a.abDiff);

  console.log("A-B 사용자 갭 기여도 순위 (큰 순서):");
  for (const [i, c] of abContribs.entries()) {
    console.log(`  ${i+1}. ${c.name.padEnd(18)} A-B 차이 = ${c.abDiff}`);
  }

  console.log();
  console.log(`FULL  → 3인 inter-user std = ${fullInterStd}`);
  console.log(`DYNAMIC → 3인 inter-user std = ${dynInterStd}  (${reduction}% 감소)`);

  if (Number(reduction) >= 30) {
    console.log("\n✅ 권고: 정적 기준선 분리가 사용자 편향 해소에 효과적. 단계적 적용 권장.");
    console.log("   가장 큰 기여 요소부터 우선 분리 검토.");
  } else if (Number(reduction) >= 10) {
    console.log("\n⚠️  권고: 정적 기준선 분리 효과 부분적. 다른 요인(profileBaselineLayer) 병용 필요.");
  } else {
    console.log("\n❌ 권고: 정적 기준선 분리만으로는 사용자 편향 해소 효과 미미.");
    console.log("   profileBaselineLayer 강화 또는 다른 접근 검토.");
  }

  console.log("\n✅ 분석 완료");
}

main().catch(console.error);
