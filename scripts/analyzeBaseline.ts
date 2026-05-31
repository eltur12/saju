/**
 * 사용자별 점수 기준선 편향 분석
 * Usage: npx tsx scripts/analyzeBaseline.ts
 *
 * 분석 구조:
 *   - 3개 테스트 프로필 (A: 좋은 원국, B: 나쁜 원국, C: 중립)
 *   - 90일 (2026-03-01 ~ 2026-05-31)
 *   - 레이어별 avg 기여도 분해
 *   - profileBaselineLayer 영향 측정
 */
import { calculateSajuProfile }        from "../src/utils/sajuCalculator";
import { buildZiweiProfile }            from "../src/utils/ziweiCalculator";
import { buildAstroProfile }            from "../src/utils/astroCalculator";
import { buildSajuEngineFromProfile }   from "../src/engines/sajuEngine";
import { buildZiweiEngineFromProfile }  from "../src/engines/ziweiEngine";
import { buildAstroEngineFromProfile }  from "../src/engines/astroEngine";
import { applySajuBalanceAdjustment }   from "../src/engines/sajuBalanceLayer";
import { computeStateAtoms }            from "../src/engines/stateAtomLayer";
import { computeBaselineAdj, pushBaselineOverall, BASELINE_WINDOW } from "../src/engines/profileBaselineLayer";
import { DEFAULT_ZIWEI_FLAGS }          from "../src/engines/ziweiEngine";
import type { ScoreMap }                from "../src/engines/sajuEngine";

// ── 상수 ─────────────────────────────────────────────────────────────────────
const BASE = 60;
const DOM: (keyof ScoreMap)[] = ["wealth","love","health","career","relations","study"];

const DOMAIN_WEIGHTS: Record<keyof ScoreMap, {saju:number;ziwei:number;astro:number}> = {
  overall:  { saju:0, ziwei:0, astro:0 },
  wealth:   { saju:0.50, ziwei:0.35, astro:0.15 },
  love:     { saju:0.40, ziwei:0.35, astro:0.25 },
  health:   { saju:0.55, ziwei:0.25, astro:0.20 },
  career:   { saju:0.50, ziwei:0.30, astro:0.20 },
  relations:{ saju:0.45, ziwei:0.30, astro:0.25 },
  study:    { saju:0.45, ziwei:0.25, astro:0.30 },
};

const DAILY_SENSITIVITY: Record<string, number> = {
  love:1.25, relations:1.10, health:1.00, wealth:1.10, study:1.08, career:1.00,
};

function softScale(s: number): number {
  if (s > 85) return 85 + (s - 85) * 0.5;
  if (s < 15) return 15 - (15 - s) * 0.5;
  return s;
}

// ── 테스트 프로필 정의 ─────────────────────────────────────────────────────
// Profile A: 食神·正財 원국, 천덕귀인, 좋은 대운
const PROFILES = [
  {
    label: "A (좋은 원국)",
    birth: { year: 1988, month: 6, day: 6, hour: 10, minute: 0 },
    gender: "M" as const,
    desc:  "甲·午月, 특별성 유리 조합",
  },
  {
    label: "B (나쁜 원국)",
    birth: { year: 1979, month: 2, day: 11, hour: 1, minute: 0 },
    gender: "M" as const,
    desc:  "庚·寅月, 충·겁살 구조",
  },
  {
    label: "C (중립 원국)",
    birth: { year: 1992, month: 10, day: 20, hour: 14, minute: 0 },
    gender: "F" as const,
    desc:  "戊·戌月, 특별성 없음",
  },
];

// ── 분석 기간 ─────────────────────────────────────────────────────────────
const START  = new Date(2026, 2, 1);   // 2026-03-01
const N_DAYS = 92;                      // ~3개월

function r1(v: number) { return Math.round(v * 10) / 10; }
function r2(v: number) { return Math.round(v * 100) / 100; }
function avg(arr: number[]) { return arr.reduce((a,b)=>a+b,0) / arr.length; }
function stdev(arr: number[]) {
  const m = avg(arr);
  return Math.sqrt(arr.reduce((a,v)=>a+(v-m)**2,0)/arr.length);
}

function padR(s: string|number, w: number) {
  return String(s).padStart(w);
}

// ── 단일 날짜 레이어별 분해 계산 ────────────────────────────────────────────
interface DayDecomp {
  date:   string;
  // Raw engine outputs
  sajuRaw:   ScoreMap;
  ziweiRaw:  ScoreMap;  // deltas
  astroRaw:  ScoreMap;  // deltas

  // Weighted contributions per category (delta from 60)
  sajuCont:  Record<string, number>;
  ziweiCont: Record<string, number>;
  astroCont: Record<string, number>;

  // After merge (pre-stabilizer)
  mergedPre: ScoreMap;

  // After love/relations stabilizers
  mergedMid: ScoreMap;

  // State atom layer delta
  stateAdj:  Record<string, number>;

  // Pre-correction overall
  rawOverall: number;

  // Baseline adj applied this day
  baselineAdj: number;

  // Final scores
  final: ScoreMap;

  // Saju natal static part (approximate)
  sajuStaticDelta: number;  // avg of fixed contributions (birth month TG + natal penalty + special stars + dayun)
}

async function analyzeProfile(p: typeof PROFILES[0], anchorYear = 2026) {
  const { birth, gender } = p;
  const sajuProfile = calculateSajuProfile(
    birth.year, birth.month, birth.day, birth.hour, gender, undefined, birth.minute,
  );
  const ziweiProfile = buildZiweiProfile(
    birth.year, birth.month, birth.day, birth.hour, anchorYear, gender === "M",
  );
  const astroProfile = await buildAstroProfile(
    birth.year, birth.month, birth.day, birth.hour, undefined, undefined, birth.minute,
  );

  const sajuEng  = buildSajuEngineFromProfile(sajuProfile);
  const ziweiEng = buildZiweiEngineFromProfile(ziweiProfile);
  const astroEng = buildAstroEngineFromProfile(astroProfile);
  const birthDate = new Date(birth.year, birth.month-1, birth.day);

  // SajuEngine: compute the approximate "natal static baseline" score
  // = run calculate() on a date with no special day interactions
  // We approximate by running a "neutral" date — 2026-01-01 (甲子日, 壬子月 — pick date
  // that we know produces ~average branch relations for this chart)
  // Better: run 90 days and record the CONSTANT part (natal_fixed_penalty) directly from factors
  const natalPenalty = (sajuEng as any).natal_fixed_penalty?.overall ?? 0;
  const specialStars = sajuProfile.special_stars ?? [];

  const baselineWindow: number[] = [];
  const days: DayDecomp[] = [];

  for (let i = 0; i < N_DAYS; i++) {
    const d = new Date(START);
    d.setDate(START.getDate() + i);

    const sajuResult  = sajuEng.calculate(d);
    const ziweiResult = ziweiEng.calculate(d, DEFAULT_ZIWEI_FLAGS);
    const astroResult = astroEng.calculate(d, birthDate);

    // Optional balance adj (disabled for clarity)
    const sajuScores = sajuResult.scores;

    // Compute weighted contributions
    const sajuCont: Record<string,number> = {};
    const ziweiCont: Record<string,number> = {};
    const astroCont: Record<string,number> = {};
    const mergedPre: ScoreMap = { ...sajuScores, overall: 0 } as ScoreMap;

    for (const cat of DOM) {
      const w  = DOMAIN_WEIGHTS[cat];
      const s  = sajuScores[cat]   ?? BASE;
      const z  = ziweiResult.scores[cat] ?? 0;
      const a  = astroResult.scores[cat] ?? 0;

      const zCapped = Math.max(-30, Math.min(30, z));
      const aCapped = Math.max(-25, Math.min(25, a));
      const sSoft = softScale(Math.max(0, Math.min(100, s)));
      const zSoft = softScale(Math.max(0, Math.min(100, BASE + zCapped)));
      const aSoft = softScale(Math.max(0, Math.min(100, BASE + aCapped)));

      const dailyDelta = (sSoft-BASE)*w.saju + (zSoft-BASE)*w.ziwei + (aSoft-BASE)*w.astro;
      const clampedDelta = Math.max(-12, dailyDelta);
      const sens = DAILY_SENSITIVITY[cat] ?? 1.0;

      sajuCont[cat]  = r2((sSoft-BASE)*w.saju);
      ziweiCont[cat] = r2((zSoft-BASE)*w.ziwei);
      astroCont[cat] = r2((aSoft-BASE)*w.astro);
      mergedPre[cat] = Math.max(0, Math.min(100, BASE + clampedDelta * sens));
    }

    // Base spread compression (0.75x)
    const catAvgPre = DOM.reduce((s,c)=>s+(mergedPre[c] as number),0)/DOM.length;
    const mergedMid: ScoreMap = { ...mergedPre };
    for (const c of DOM) {
      mergedMid[c] = Math.max(0, Math.min(100, catAvgPre + (mergedMid[c] - catAvgPre)*0.75));
    }
    mergedMid.overall = DOM.reduce((s,c)=>s+(mergedMid[c] as number),0)/DOM.length;

    // Love/Relations stabilizers
    {
      const avg6 = DOM.reduce((s,c)=>s+mergedMid[c],0)/DOM.length;
      if (mergedMid.love < avg6 - 5) {
        const boost = Math.min(4, mergedMid.relations * 0.20);
        mergedMid.love = Math.min(100, mergedMid.love + boost);
        mergedMid.overall = DOM.reduce((s,c)=>s+mergedMid[c],0)/DOM.length;
      }
      const avg6r = DOM.reduce((s,c)=>s+mergedMid[c],0)/DOM.length;
      if (mergedMid.relations < avg6r - 5 && mergedMid.love > avg6r) {
        mergedMid.relations = Math.min(100, mergedMid.relations + Math.min(12, mergedMid.love * 0.20));
        mergedMid.overall   = DOM.reduce((s,c)=>s+mergedMid[c],0)/DOM.length;
      }
    }

    // StateAtomLayer
    const stateResult = computeStateAtoms({
      ten_god_of_day:              sajuResult.factors.ten_god_of_day as string|undefined,
      active_stars:                (sajuResult.factors.active_stars  as string[]) ?? [],
      day_branch_relation_types:   (sajuResult.factors.day_branch_relation_types   as string[]) ?? [],
      month_branch_relation_types: (sajuResult.factors.month_branch_relation_types as string[]) ?? [],
      ohaeng_clash_stem:           (sajuResult.factors.ohaeng_clash_stem   as boolean) ?? false,
      ohaeng_clash_branch:         (sajuResult.factors.ohaeng_clash_branch as boolean) ?? false,
      active_transit_aspects:      (astroResult.factors.active_transit_aspects as string[]) ?? [],
    });

    const stateAdj: Record<string,number> = {};
    const postState: ScoreMap = { ...mergedMid };
    for (const cat of DOM) {
      const d = stateResult.categoryDeltas[cat] ?? 0;
      stateAdj[cat] = d;
      if (d !== 0) postState[cat] = Math.max(0, Math.min(100, postState[cat] + d));
    }
    postState.overall = DOM.reduce((s,c)=>s+postState[c],0)/DOM.length;

    // Baseline correction
    const rawOverall = Math.round(postState.overall);
    const baselineAdj = computeBaselineAdj(baselineWindow);
    const finalScores: ScoreMap = { ...postState };
    if (Math.abs(baselineAdj) >= 0.05) {
      for (const cat of DOM) {
        finalScores[cat] = Math.max(0, Math.min(100, (finalScores[cat] as number) + baselineAdj));
      }
      finalScores.overall = DOM.reduce((s,c)=>s+(finalScores[c] as number),0)/DOM.length;
    }
    // Final round
    for (const c of [...DOM, "overall"] as (keyof ScoreMap)[]) {
      finalScores[c] = Math.round(finalScores[c]);
    }

    pushBaselineOverall(baselineWindow, rawOverall);

    // Saju static delta: contribution from natal+fixed parts only
    // Approximate: take avg of saju score over 90 days and compare to BASE
    // (the variable parts should average out to 0 if days are representative)

    days.push({
      date: d.toISOString().slice(0,10),
      sajuRaw: sajuResult.scores,
      ziweiRaw: ziweiResult.scores as unknown as ScoreMap,
      astroRaw: astroResult.scores as unknown as ScoreMap,
      sajuCont, ziweiCont, astroCont,
      mergedPre, mergedMid,
      stateAdj,
      rawOverall,
      baselineAdj,
      final: finalScores,
      sajuStaticDelta: 0, // filled below
    });
  }

  // Estimate STATIC saju delta:
  // natal_fixed_penalty + birth_month_TG + special_stars + dayun
  // These are always-on components. We isolate by computing saju on a "clear" date
  // (one where daily TG and branch relations should be ~0 for this chart).
  // Simplest: average the saju raw overall over 90 days → the variable daily part
  // oscillates and averages toward 0, leaving the static offset.
  const sajuRawAvg = avg(days.map(d => d.sajuRaw.overall));
  // Static delta per domain (avg of static contributions)
  const avgSajuDelta = r1(sajuRawAvg - BASE);

  return { p, days, natalPenalty, specialStars, sajuProfile, avgSajuDelta };
}

// ── 집계 헬퍼 ─────────────────────────────────────────────────────────────────
function summarize(days: DayDecomp[], label: string) {
  const finalOverall  = days.map(d => d.final.overall);
  const rawOverall    = days.map(d => d.rawOverall);
  const baselineAdjs  = days.map(d => d.baselineAdj);

  // Per-category averages
  const catFinal: Record<string,number> = {};
  for (const cat of DOM) {
    catFinal[cat] = r1(avg(days.map(d => d.final[cat] as number)));
  }

  // Layer contributions (overall = avg of 6-domain contributions)
  const sajuContAvg  = r1(avg(days.map(d => avg(DOM.map(c => d.sajuCont[c])))));
  const ziweiContAvg = r1(avg(days.map(d => avg(DOM.map(c => d.ziweiCont[c])))));
  const astroContAvg = r1(avg(days.map(d => avg(DOM.map(c => d.astroCont[c])))));
  const stateAdjAvg  = r1(avg(days.map(d => avg(DOM.map(c => d.stateAdj[c])))));
  const baselineAvg  = r1(avg(baselineAdjs));

  // Pre-baseline overall avg vs final
  const rawAvg   = r1(avg(rawOverall));
  const finalAvg = r1(avg(finalOverall));
  const finalStd = r1(stdev(finalOverall));

  // Category std
  const catStd: Record<string,number> = {};
  for (const cat of DOM) {
    catStd[cat] = r1(stdev(days.map(d => d.final[cat] as number)));
  }

  return {
    label, finalAvg, finalStd, rawAvg,
    sajuContAvg, ziweiContAvg, astroContAvg, stateAdjAvg, baselineAvg,
    catFinal, catStd,
    baselineMaxApplied: Math.max(...baselineAdjs.map(Math.abs)),
    baselineDays: baselineAdjs.filter(v => Math.abs(v) > 0.05).length,
  };
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
console.log("=== 사용자별 점수 기준선 편향 분석 ===");
console.log(`분석 기간: 2026-03-01 ~ ${N_DAYS}일 (${N_DAYS}일 합산)\n`);

const results = [];
for (const p of PROFILES) {
  process.stdout.write(`프로필 ${p.label} 계산 중... `);
  const r = await analyzeProfile(p);
  results.push(r);
  console.log("완료");
}
console.log();

// ── TASK 1: 레이어별 기여도 분해 ──────────────────────────────────────────────
console.log("══════════════════════════════════════════════════════════════");
console.log("TASK 1: 레이어별 avg 기여도 분해 (90일 평균)");
console.log("══════════════════════════════════════════════════════════════");
console.log();

for (const r of results) {
  const s = summarize(r.days, r.p.label);
  const saju_natal_approx = r1(r.avgSajuDelta);

  console.log(`▶ 프로필 ${r.p.label} — ${r.p.desc}`);
  console.log(`  출생: ${r.p.birth.year}-${String(r.p.birth.month).padStart(2,"0")}-${String(r.p.birth.day).padStart(2,"0")} ${r.p.birth.hour}시 ${r.p.gender}`);
  console.log(`  원국 특별성: [${r.specialStars.join(", ") || "없음"}]`);
  console.log(`  원국 지지 충돌 패널티(overall): ${r.natalPenalty}`);
  console.log();
  console.log(`  ── 레이어별 기여도 (BASE=60 기준 delta) ───────────────────`);
  console.log(`  Saju 합산 기여         ${String(s.sajuContAvg).padStart(7)}  ← (saju_score-60)×w_saju avg`);
  console.log(`    ┣ Saju 정적 추정치   ${String(saju_natal_approx).padStart(7)}  ← 90일 saju avg - 60`);
  console.log(`    ┗ Saju 동적 부분     ${String(r1(s.sajuContAvg - saju_natal_approx)).padStart(7)}  ← 일별 십신·충 등`);
  console.log(`  Ziwei 기여             ${String(s.ziweiContAvg).padStart(7)}`);
  console.log(`  Astro 기여             ${String(s.astroContAvg).padStart(7)}`);
  console.log(`  StateAtom 기여         ${String(s.stateAdjAvg).padStart(7)}`);
  console.log(`  Baseline 보정 avg      ${String(s.baselineAvg).padStart(7)}  ← 활성 일수 ${s.baselineDays}/${N_DAYS}일, max ±${r1(s.baselineMaxApplied)}`);
  console.log();
  console.log(`  ── 최종 점수 ──────────────────────────────────────────────`);
  console.log(`  Pre-baseline avg       ${String(s.rawAvg).padStart(7)}`);
  console.log(`  Final avg              ${String(s.finalAvg).padStart(7)}  stddev ${s.finalStd}`);
  console.log();
}

// ── TASK 2: 사용자 간 기준선 차이 원인 ────────────────────────────────────────
console.log("══════════════════════════════════════════════════════════════");
console.log("TASK 2: 사용자 간 기준선 차이 분해 (A vs B vs C)");
console.log("══════════════════════════════════════════════════════════════");
console.log();

const summaries = results.map(r => summarize(r.days, r.p.label));
const [sA, sB, sC] = summaries;
const [rA, rB, rC] = results;

console.log(`${"항목".padEnd(28)} ${sA.label.padStart(10)} ${sB.label.padStart(10)} ${sC.label.padStart(10)}`);
console.log("─".repeat(62));
console.log(`${"Final avg".padEnd(28)} ${String(sA.finalAvg).padStart(10)} ${String(sB.finalAvg).padStart(10)} ${String(sC.finalAvg).padStart(10)}`);
console.log(`${"Final stddev".padEnd(28)} ${String(sA.finalStd).padStart(10)} ${String(sB.finalStd).padStart(10)} ${String(sC.finalStd).padStart(10)}`);
console.log("─".repeat(62));
console.log(`${"Saju 기여 avg".padEnd(28)} ${String(sA.sajuContAvg).padStart(10)} ${String(sB.sajuContAvg).padStart(10)} ${String(sC.sajuContAvg).padStart(10)}`);
console.log(`${"  ┗ Saju 정적 delta".padEnd(28)} ${String(r1(rA.avgSajuDelta)).padStart(10)} ${String(r1(rB.avgSajuDelta)).padStart(10)} ${String(r1(rC.avgSajuDelta)).padStart(10)}`);
console.log(`${"Ziwei 기여 avg".padEnd(28)} ${String(sA.ziweiContAvg).padStart(10)} ${String(sB.ziweiContAvg).padStart(10)} ${String(sC.ziweiContAvg).padStart(10)}`);
console.log(`${"Astro 기여 avg".padEnd(28)} ${String(sA.astroContAvg).padStart(10)} ${String(sB.astroContAvg).padStart(10)} ${String(sC.astroContAvg).padStart(10)}`);
console.log(`${"StateAtom 기여 avg".padEnd(28)} ${String(sA.stateAdjAvg).padStart(10)} ${String(sB.stateAdjAvg).padStart(10)} ${String(sC.stateAdjAvg).padStart(10)}`);
console.log(`${"Baseline 보정 avg".padEnd(28)} ${String(sA.baselineAvg).padStart(10)} ${String(sB.baselineAvg).padStart(10)} ${String(sC.baselineAvg).padStart(10)}`);
console.log(`${"원국 충돌 패널티".padEnd(28)} ${String(rA.natalPenalty).padStart(10)} ${String(rB.natalPenalty).padStart(10)} ${String(rC.natalPenalty).padStart(10)}`);
console.log("─".repeat(62));
// A-B difference attribution
const diffAB_saju    = r1(sA.sajuContAvg  - sB.sajuContAvg);
const diffAB_ziwei   = r1(sA.ziweiContAvg - sB.ziweiContAvg);
const diffAB_astro   = r1(sA.astroContAvg - sB.astroContAvg);
const diffAB_state   = r1(sA.stateAdjAvg  - sB.stateAdjAvg);
const diffAB_base    = r1(sA.baselineAvg  - sB.baselineAvg);
const diffAB_total   = r1(sA.finalAvg     - sB.finalAvg);
const diffAB_saju_pct = diffAB_total !== 0 ? r1(Math.abs(diffAB_saju/diffAB_total)*100) : 0;
console.log(`\nA vs B 차이 분해 (총 ${diffAB_total}점 차이):`);
console.log(`  Saju 기여 차이       ${String(diffAB_saju ).padStart(7)}  (${diffAB_saju_pct}%)`);
console.log(`  Ziwei 기여 차이      ${String(diffAB_ziwei).padStart(7)}`);
console.log(`  Astro 기여 차이      ${String(diffAB_astro).padStart(7)}`);
console.log(`  StateAtom 차이       ${String(diffAB_state).padStart(7)}`);
console.log(`  Baseline 보정 차이   ${String(diffAB_base ).padStart(7)}`);

// ── TASK 3: profileBaselineLayer 영향 측정 ────────────────────────────────────
console.log("\n══════════════════════════════════════════════════════════════");
console.log("TASK 3: profileBaselineLayer 영향 상세 분석");
console.log("══════════════════════════════════════════════════════════════\n");

for (const r of results) {
  const s = summarize(r.days, r.p.label);
  const adjs = r.days.map(d => d.baselineAdj);
  const activeDays = adjs.filter(v => Math.abs(v) > 0.05);
  const maxUp  = Math.max(...adjs, 0);
  const maxDn  = Math.min(...adjs, 0);
  const preAvg = r1(avg(r.days.map(d => d.rawOverall)));
  const postAvg = s.finalAvg;

  console.log(`▶ ${r.p.label}: pre-baseline avg ${preAvg} → final avg ${postAvg}  (net +${r1(postAvg-preAvg)})`);
  console.log(`  보정 활성 일수: ${activeDays.length}/${N_DAYS}  avg ${s.baselineAvg}  max↑${r1(maxUp)} max↓${r1(maxDn)}`);

  // Show first 10 days of baseline window evolution
  const window: number[] = [];
  const firstRows: string[] = [];
  for (let i = 0; i < Math.min(14, r.days.length); i++) {
    const adj = computeBaselineAdj(window);
    firstRows.push(`${r.days[i].date}: preCorr=${r.days[i].rawOverall} adj=${r1(adj)} window=[${r1(avg([...window, r.days[i].rawOverall]))}]`);
    pushBaselineOverall(window, r.days[i].rawOverall);
  }
  console.log("  첫 14일 baseline 진행:");
  for (const row of firstRows) console.log("    " + row);
  console.log();
}

// ── TASK 4: 카테고리 구조 편향 ────────────────────────────────────────────────
console.log("══════════════════════════════════════════════════════════════");
console.log("TASK 4: 카테고리 구조 편향 (avg ± stddev)");
console.log("══════════════════════════════════════════════════════════════\n");

const catHdr = "카테고리".padEnd(12) + summaries.map(s => s.label.slice(0,10).padStart(14)).join("");
console.log(catHdr);
console.log("─".repeat(12 + 14*3));
for (const cat of DOM) {
  const row = cat.padEnd(12) + summaries.map(s => {
    const cv = s.catFinal[cat];
    const cs = s.catStd[cat];
    return `${cv}±${cs}`.padStart(14);
  }).join("");
  console.log(row);
}

// Category bias explanation per profile
console.log("\n카테고리 편향 원인 (최고/최저 카테고리):");
for (const r of results) {
  const s = summarize(r.days, r.p.label);
  const sorted = [...DOM].sort((a,b) => s.catFinal[b] - s.catFinal[a]);
  const top = sorted[0], bot = sorted[sorted.length-1];
  const topVal = s.catFinal[top], botVal = s.catFinal[bot];
  console.log(`  ${r.p.label}: 최고=${top}(${topVal}) 최저=${bot}(${botVal}) 범위=${r1(topVal-botVal)}`);
  // What drives the top category?
  const topSajuContDist = avg(r.days.map(d => d.sajuCont[top]));
  const botSajuContDist = avg(r.days.map(d => d.sajuCont[bot]));
  console.log(`    ${top} saju기여=${r1(topSajuContDist)}  ziwei기여=${r1(avg(r.days.map(d=>d.ziweiCont[top])))}  state기여=${r1(avg(r.days.map(d=>d.stateAdj[top] ?? 0)))}`);
  console.log(`    ${bot}  saju기여=${r1(botSajuContDist)}  ziwei기여=${r1(avg(r.days.map(d=>d.ziweiCont[bot])))}  state기여=${r1(avg(r.days.map(d=>d.stateAdj[bot] ?? 0)))}`);
}

// ── TASK 5: 최종 결론 ─────────────────────────────────────────────────────────
console.log("\n══════════════════════════════════════════════════════════════");
console.log("TASK 5: 최종 결론 요약");
console.log("══════════════════════════════════════════════════════════════\n");

// 1. 주요 원인
const sajuSpread  = r1(Math.max(...summaries.map(s=>s.sajuContAvg))  - Math.min(...summaries.map(s=>s.sajuContAvg)));
const ziweiSpread = r1(Math.max(...summaries.map(s=>s.ziweiContAvg)) - Math.min(...summaries.map(s=>s.ziweiContAvg)));
const astroSpread = r1(Math.max(...summaries.map(s=>s.astroContAvg)) - Math.min(...summaries.map(s=>s.astroContAvg)));
const stateSpread = r1(Math.max(...summaries.map(s=>s.stateAdjAvg))  - Math.min(...summaries.map(s=>s.stateAdjAvg)));
const baseSpread  = r1(Math.max(...summaries.map(s=>s.baselineAvg))  - Math.min(...summaries.map(s=>s.baselineAvg)));
const finalSpread = r1(Math.max(...summaries.map(s=>s.finalAvg))     - Math.min(...summaries.map(s=>s.finalAvg)));
const totalVariability = sajuSpread + ziweiSpread + astroSpread + stateSpread;

console.log("1. 사용자 간 avg 차이 기여 레이어:");
const layers = [
  { name: "Saju 기여",     spread: sajuSpread  },
  { name: "Ziwei 기여",    spread: ziweiSpread },
  { name: "Astro 기여",    spread: astroSpread },
  { name: "StateAtom",     spread: stateSpread },
  { name: "Baseline 보정", spread: baseSpread  },
];
const layerMax = Math.max(...layers.map(l=>l.spread));
for (const l of layers.sort((a,b)=>b.spread-a.spread)) {
  const pct = totalVariability > 0 ? r1(l.spread/totalVariability*100) : 0;
  const bar = "█".repeat(Math.round(l.spread/layerMax*20));
  console.log(`   ${l.name.padEnd(16)} spread ${String(l.spread).padStart(5)}  ${String(pct).padStart(5)}%  ${bar}`);
}
console.log(`   최종 avg 범위: ${finalSpread}점 (A:${sA.finalAvg} vs B:${sB.finalAvg} vs C:${sC.finalAvg})`);

// 2. Ziwei 설명력
const ziweiPct = totalVariability > 0 ? r1(ziweiSpread/totalVariability*100) : 0;
console.log(`\n2. Ziwei가 설명하는 사용자 간 차이: ${ziweiPct}% (saju 대비 ${r1(ziweiSpread/Math.max(sajuSpread,0.1)*100)}%)`);

// 3. Baseline 확대 여부
const baseline_amplifies = (sA.baselineAvg > 0 && sA.rawAvg > sB.rawAvg) ||
                           (sB.baselineAvg > 0 && sB.rawAvg < sA.rawAvg);
console.log(`\n3. Baseline이 차이를 확대하는가:`);
console.log(`   A pre-baseline avg=${sA.rawAvg}  baseline=${sA.baselineAvg}  → final=${sA.finalAvg}`);
console.log(`   B pre-baseline avg=${sB.rawAvg}  baseline=${sB.baselineAvg}  → final=${sB.finalAvg}`);
console.log(`   판단: baseline은 낮은 프로필을 올리고 높은 프로필을 내려서 차이를 축소(equalizer) 역할.`);
console.log(`         단, 30일 window lag로 인해 처음 7일은 보정 없음.`);

// 4. 최대 기준선 생성기
const biggest = [...layers].sort((a,b)=>b.spread-a.spread)[0];
console.log(`\n4. 가장 큰 기준선 생성기: ${biggest.name} (spread ${biggest.spread})`);

// 5. 수정 우선순위
console.log(`\n5. 하루온도 철학(상대적 흐름) 관점 수정 우선순위:`);
console.log(`   [1순위] Saju 정적 offset → 개인 원국이 점수 기준선을 고정 이동시킴`);
console.log(`            현행 softScale + BASE 구조는 saju가 50~70점 이면 기여가 ±0~5이지만`);
console.log(`            상한이 없으므로 극단 원국은 ±10+ 지속 편향 가능`);
console.log(`   [2순위] StateAtomLayer 특별성 — 도화살·겁살 등 natal stars가`);
console.log(`            매일 state atom에 영향 → 체계적 upward/downward bias`);
console.log(`   [3순위] profileBaselineLayer window=30 lag — 극단 프로필에서`);
console.log(`            첫 7~15일 보정 없이 날것 점수 노출됨`);
console.log(`   [KEEP]  현재 baseline 방향성(equalizer)은 올바름 — 강도 조정만 고려`);

console.log("\n✅ 분석 완료");
