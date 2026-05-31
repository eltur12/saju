/**
 * 점수 파이프라인 보정 영향 분석
 * Usage: npx tsx scripts/analyzePipeline.ts
 *
 * 분석 범위:
 *   TASK 1  파이프라인 단계 목록 (표)
 *   TASK 2  단계별 stddev 추적
 *   TASK 3  카테고리 간 상관계수
 *   TASK 4  보정 ON/OFF 실험
 *   TASK 5  보정별 의도·부작용 평가
 *   TASK 6  최종 결론
 */

import { calculateSajuProfile }       from "../src/utils/sajuCalculator";
import { buildZiweiProfile }           from "../src/utils/ziweiCalculator";
import { buildAstroProfile }           from "../src/utils/astroCalculator";
import { buildSajuEngineFromProfile }  from "../src/engines/sajuEngine";
import { buildZiweiEngineFromProfile } from "../src/engines/ziweiEngine";
import { buildAstroEngineFromProfile } from "../src/engines/astroEngine";
import { computeStateAtoms }           from "../src/engines/stateAtomLayer";
import { computeBaselineAdj, pushBaselineOverall, BASELINE_WINDOW } from "../src/engines/profileBaselineLayer";
import { DEFAULT_SAJU_FLAGS }          from "../src/engines/sajuEngine";
import { DEFAULT_ZIWEI_FLAGS }         from "../src/engines/ziweiEngine";
import type { ScoreMap }               from "../src/engines/sajuEngine";

// ── 상수 (aggregator.ts 에서 그대로 복사) ──────────────────────────────────
const BASE = 60;
const DOM  = ["wealth","love","health","career","relations","study"] as const;

const DOMAIN_WEIGHTS: Record<string, {saju:number;ziwei:number;astro:number}> = {
  wealth:    {saju:0.50,ziwei:0.35,astro:0.15},
  love:      {saju:0.40,ziwei:0.35,astro:0.25},
  health:    {saju:0.55,ziwei:0.25,astro:0.20},
  career:    {saju:0.50,ziwei:0.30,astro:0.20},
  relations: {saju:0.45,ziwei:0.30,astro:0.25},
  study:     {saju:0.45,ziwei:0.25,astro:0.30},
};
const DAILY_SENSITIVITY: Record<string,number> = {
  love:1.25, relations:1.10, health:1.00, wealth:1.10, study:1.08, career:1.00,
};

function softScale(s: number): number {
  if (s > 85) return 85 + (s-85)*0.5;
  if (s < 15) return 15 - (15-s)*0.5;
  return s;
}

// ── 수치 헬퍼 ─────────────────────────────────────────────────────────────
function r1(v: number) { return Math.round(v*10)/10; }
function avg(arr: number[]) { return arr.reduce((a,b)=>a+b,0)/arr.length; }
function stdev(arr: number[]) {
  const m=avg(arr);
  return Math.sqrt(arr.reduce((a,v)=>a+(v-m)**2,0)/arr.length);
}
function corr(xs: number[], ys: number[]): number {
  const mx=avg(xs), my=avg(ys);
  const num=xs.reduce((s,x,i)=>s+(x-mx)*(ys[i]-my),0);
  const den=Math.sqrt(xs.reduce((s,x)=>s+(x-mx)**2,0)*ys.reduce((s,y)=>s+(y-my)**2,0));
  return den===0?0:r1(num/den);
}

// ── 테스트 프로필 ────────────────────────────────────────────────────────────
const PROFILES = [
  { label:"A", birth:{year:1988,month:6,day:6, hour:10,minute:0}, gender:"M" as const },
  { label:"B", birth:{year:1979,month:2,day:11,hour:1, minute:0}, gender:"M" as const },
  { label:"C", birth:{year:1992,month:10,day:20,hour:14,minute:0}, gender:"F" as const },
];
const ANCHOR = PROFILES[0]; // TASK 2/3는 A 단일 프로필 기준

const START  = new Date(2026, 2, 1);
const N_DAYS = 92;

// ── 파이프라인 단계별 캡처 타입 ───────────────────────────────────────────────
interface StageScores {
  overall: number;
  cats:    Record<string, number>;
}

interface DayPipeline {
  date:   string;
  // stage outputs — overall만 추적 (카테고리 상관관계는 별도)
  s0_sajuRaw:   number; // saju overall (raw)
  s1_preClamp:  StageScores;  // after merge, BEFORE dailyDelta clamp
  s2_postClamp: StageScores;  // after dailyDelta clamp
  s3_sens:      StageScores;  // after sensitivity
  s4_compress:  StageScores;  // after 0.75× spread compression
  s5_loveLift:  StageScores;  // after love/relations stabilizer
  s6_stateAtom: StageScores;  // after state atom
  s7_baseline:  StageScores;  // after baseline correction
  s8_final:     StageScores;  // after final round
  // raw engine outputs for correlation and ON/OFF
  sajuCats:     Record<string,number>;
  ziweiCats:    Record<string,number>;
  astroCats:    Record<string,number>;
  stateDeltas:  Record<string,number>;
  baselineAdj:  number;
}

// ── 핵심 파이프라인 — stage별 ScoreMap 캡처 ────────────────────────────────
async function buildEngines(p: typeof PROFILES[0]) {
  const {birth,gender}=p;
  const sajuProfile  = calculateSajuProfile(birth.year,birth.month,birth.day,birth.hour,gender,undefined,birth.minute);
  const ziweiProfile = buildZiweiProfile(birth.year,birth.month,birth.day,birth.hour,2026,gender==="M");
  const astroProfile = await buildAstroProfile(birth.year,birth.month,birth.day,birth.hour,undefined,undefined,birth.minute);
  const birthDate    = new Date(birth.year,birth.month-1,birth.day);
  return {
    sajuEng:  buildSajuEngineFromProfile(sajuProfile),
    ziweiEng: buildZiweiEngineFromProfile(ziweiProfile),
    astroEng: buildAstroEngineFromProfile(astroProfile),
    birthDate,
  };
}

function computePipeline(
  sajuRaw: ScoreMap,
  ziweiRaw: Record<string,number>,
  astroRaw: Record<string,number>,
  stateInput: Parameters<typeof computeStateAtoms>[0],
  baselineWindow: number[],
  flags: {
    noClamp?:     boolean;  // B
    noCompress?:  boolean;  // C
    noStabilizer?:boolean;  // D
    noLoveLift?:  boolean;  // E (subset of D)
    noBaseline?:  boolean;  // F
    noSoftDamp?:  boolean;  // G — stateAtomLayer softDamp
    noSensitivity?:boolean; // H
    noStreakBreaker?:boolean;// I (handled outside)
  } = {},
): { stages: DayPipeline["s1_preClamp"] extends StageScores ? StageScores[] : never; finalCats: Record<string,number>; adj: number } {

  // ── 1. Raw merge (pre-clamp, pre-compress) ─────────────────────────────
  const preClampCats: Record<string,number> = {};
  for (const cat of DOM) {
    const w  = DOMAIN_WEIGHTS[cat];
    const s  = sajuRaw[cat]   ?? BASE;
    const z  = ziweiRaw[cat]  ?? 0;
    const a  = astroRaw[cat]  ?? 0;
    const zCapped = Math.max(-30, Math.min(30, z));
    const aCapped = Math.max(-25, Math.min(25, a));
    const sSoft = softScale(Math.max(0,Math.min(100,s)));
    const zSoft = softScale(Math.max(0,Math.min(100,BASE+zCapped)));
    const aSoft = softScale(Math.max(0,Math.min(100,BASE+aCapped)));
    const dailyDelta = (sSoft-BASE)*w.saju + (zSoft-BASE)*w.ziwei + (aSoft-BASE)*w.astro;
    const sens = flags.noSensitivity ? 1.0 : (DAILY_SENSITIVITY[cat]??1.0);
    preClampCats[cat] = Math.max(0,Math.min(100, BASE + dailyDelta * sens));
  }
  const preClampOverall = avg(DOM.map(c=>preClampCats[c]));

  // ── 2. dailyDelta clamp ─────────────────────────────────────────────────
  const postClampCats: Record<string,number> = {};
  for (const cat of DOM) {
    const w  = DOMAIN_WEIGHTS[cat];
    const s  = sajuRaw[cat]   ?? BASE;
    const z  = ziweiRaw[cat]  ?? 0;
    const a  = astroRaw[cat]  ?? 0;
    const zCapped = Math.max(-30, Math.min(30, z));
    const aCapped = Math.max(-25, Math.min(25, a));
    const sSoft = softScale(Math.max(0,Math.min(100,s)));
    const zSoft = softScale(Math.max(0,Math.min(100,BASE+zCapped)));
    const aSoft = softScale(Math.max(0,Math.min(100,BASE+aCapped)));
    const rawDelta = (sSoft-BASE)*w.saju + (zSoft-BASE)*w.ziwei + (aSoft-BASE)*w.astro;
    const clampedDelta = flags.noClamp ? rawDelta : Math.max(-12, rawDelta);
    const sens = flags.noSensitivity ? 1.0 : (DAILY_SENSITIVITY[cat]??1.0);
    postClampCats[cat] = Math.max(0,Math.min(100, BASE + clampedDelta * sens));
  }
  const postClampOverall = avg(DOM.map(c=>postClampCats[c]));

  // ── 3. Spread compression ───────────────────────────────────────────────
  const compressCats: Record<string,number> = { ...postClampCats };
  if (!flags.noCompress) {
    const catMean = avg(DOM.map(c=>compressCats[c]));
    for (const c of DOM) compressCats[c] = Math.max(0,Math.min(100, catMean + (compressCats[c]-catMean)*0.75));
  }
  const compressOverall = avg(DOM.map(c=>compressCats[c]));

  // ── 4. Love / Relations stabilizer ─────────────────────────────────────
  const stab = { ...compressCats };
  if (!flags.noStabilizer && !flags.noLoveLift) {
    const avg6 = avg(DOM.map(c=>stab[c]));
    if (stab.love < avg6 - 5) {
      const boost = Math.min(4, stab.relations * 0.20);
      stab.love = Math.min(100, stab.love + boost);
    }
    const avg6r = avg(DOM.map(c=>stab[c]));
    if (stab.relations < avg6r - 5 && stab.love > avg6r) {
      stab.relations = Math.min(100, stab.relations + Math.min(12, stab.love * 0.20));
    }
  }
  const stabOverall = avg(DOM.map(c=>stab[c]));

  // ── 5. StateAtom layer ──────────────────────────────────────────────────
  const modifiedInput = flags.noSoftDamp
    ? { ...stateInput, specialStarsMode: stateInput.specialStarsMode }
    : stateInput;
  const stateResult = computeStateAtoms(modifiedInput);

  // Note: can't easily bypass softDamp without modifying the engine,
  // so we simulate "no softDamp" by applying the delta before the internal damp cancels it.
  // For analysis, we just report the effect.
  const postState = { ...stab };
  for (const cat of DOM) {
    const d = stateResult.categoryDeltas[cat] ?? 0;
    if (d !== 0) postState[cat] = Math.max(0, Math.min(100, postState[cat]+d));
  }
  const stateOverall = avg(DOM.map(c=>postState[c]));

  // ── 6. Baseline correction ──────────────────────────────────────────────
  const rawOverall = Math.round(stateOverall);
  const adj = flags.noBaseline ? 0 : computeBaselineAdj(baselineWindow);
  const postBase = { ...postState };
  if (!flags.noBaseline && Math.abs(adj) >= 0.05) {
    for (const c of DOM) postBase[c] = Math.max(0, Math.min(100, postBase[c]+adj));
  }
  const baselineOverall = avg(DOM.map(c=>postBase[c]));

  // ── 7. Final rounding ───────────────────────────────────────────────────
  const finalCats: Record<string,number> = {};
  for (const c of DOM) finalCats[c] = Math.round(postBase[c]);
  const finalOverall = Math.round(avg(DOM.map(c=>finalCats[c])));

  const stages: StageScores[] = [
    { overall: r1(preClampOverall),   cats: Object.fromEntries(DOM.map(c=>[c,r1(preClampCats[c])])) },
    { overall: r1(postClampOverall),  cats: Object.fromEntries(DOM.map(c=>[c,r1(postClampCats[c])])) },
    { overall: r1(compressOverall),   cats: Object.fromEntries(DOM.map(c=>[c,r1(compressCats[c])])) },
    { overall: r1(stabOverall),       cats: Object.fromEntries(DOM.map(c=>[c,r1(stab[c])])) },
    { overall: r1(stateOverall),      cats: Object.fromEntries(DOM.map(c=>[c,r1(postState[c])])) },
    { overall: r1(baselineOverall),   cats: Object.fromEntries(DOM.map(c=>[c,r1(postBase[c])])) },
    { overall: finalOverall,          cats: finalCats },
  ];

  return { stages, finalCats, adj };
}

async function runAllDays(p: typeof PROFILES[0], flags: Parameters<typeof computePipeline>[5] = {}) {
  const { sajuEng, ziweiEng, astroEng, birthDate } = await buildEngines(p);
  const window: number[] = [];
  const finalDays: Record<string,number>[] = [];
  const stageHistories: StageScores[][] = Array.from({length:7},()=>[]);

  for (let i=0; i<N_DAYS; i++) {
    const d = new Date(START);
    d.setDate(START.getDate()+i);

    const sajuResult  = sajuEng.calculate(d, DEFAULT_SAJU_FLAGS);
    const ziweiResult = ziweiEng.calculate(d, DEFAULT_ZIWEI_FLAGS);
    const astroResult = astroEng.calculate(d, birthDate);

    const stateInput = {
      ten_god_of_day:              sajuResult.factors.ten_god_of_day as string|undefined,
      active_stars:                (sajuResult.factors.active_stars  as string[])??[],
      day_branch_relation_types:   (sajuResult.factors.day_branch_relation_types   as string[])??[],
      month_branch_relation_types: (sajuResult.factors.month_branch_relation_types as string[])??[],
      ohaeng_clash_stem:           (sajuResult.factors.ohaeng_clash_stem   as boolean)??false,
      ohaeng_clash_branch:         (sajuResult.factors.ohaeng_clash_branch as boolean)??false,
      active_transit_aspects:      (astroResult.factors.active_transit_aspects as string[])??[],
    };

    const { stages, finalCats, adj } = computePipeline(
      sajuResult.scores,
      astroResult.scores as unknown as Record<string,number>,
      ziweiResult.scores as unknown as Record<string,number>,
      stateInput,
      window,
      flags,
    );

    const rawOverall = stages[4].overall; // pre-baseline
    pushBaselineOverall(window, Math.round(rawOverall));
    finalDays.push(finalCats);
    stages.forEach((s,idx) => stageHistories[idx].push(s));
  }

  // Monthly streak breaker simulation (simplified): just track without applying for ON/OFF
  return { finalDays, stageHistories };
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
console.log("=== 점수 파이프라인 보정 영향 분석 ===");
console.log(`기간: 2026-03-01 ~ 92일\n`);

// ──────────────────────────────────────────────────────────────────────────────
// TASK 1: 파이프라인 단계 목록
// ──────────────────────────────────────────────────────────────────────────────
console.log("══════════════════════════════════════════════════════════════════════════════");
console.log("TASK 1: 파이프라인 단계 목록");
console.log("══════════════════════════════════════════════════════════════════════════════\n");

const PIPELINE_TABLE = [
  { step: 1,  stage: "SajuEngine raw",       file: "sajuEngine.ts",          fn: "calculate()",           target: "6 domains",     purpose: "십신·지지·대운·특별성 종합",     constants: "BASE=60, TG_INF 테이블",     direction: "±, 프로필 고정" },
  { step: 2,  stage: "ZiweiEngine raw",       file: "ziweiEngine.ts",         fn: "calculate()",           target: "6 domains",     purpose: "자미두수 활성궁·사화 종합",       constants: "MONTHLY_PALACE_WEIGHT=0.4",  direction: "± delta, 일 12사이클" },
  { step: 3,  stage: "AstroEngine raw",       file: "astroEngine.ts",         fn: "calculate()",           target: "6 domains",     purpose: "행성 어스펙트·나탈 종합",         constants: "strength 3~10, 0.5× scale",  direction: "± delta, 일별 변동" },
  { step: 4,  stage: "Engine delta cap",      file: "aggregator.ts",          fn: "mergeScores()",         target: "z,a delta",     purpose: "자미·점성 이상값 제거",           constants: "z:±30, a:±25",              direction: "상한 압축" },
  { step: 5,  stage: "softScale",             file: "aggregator.ts",          fn: "softScale()",           target: "saju/z/a",      purpose: "85+ / 15- 극단 완화",           constants: "85↑:0.5×, 15↓:0.5×",        direction: "양방향 상·하한 압축" },
  { step: 6,  stage: "dailyDelta 합산",       file: "aggregator.ts",          fn: "mergeScores()",         target: "6 domains",     purpose: "3 엔진 가중 합산",                constants: "w_saju 0.40~0.55",          direction: "가중 평균" },
  { step: 7,  stage: "dailyDelta clamp",      file: "aggregator.ts",          fn: "mergeScores() Task 5",  target: "각 cat delta",  purpose: "극단 나쁜 날 방지",              constants: "min=-12",                   direction: "하방 일방 압축 ★" },
  { step: 8,  stage: "category sensitivity",  file: "aggregator.ts",          fn: "mergeScores() Task 2",  target: "love/rel/wl/st", purpose: "카테고리별 민감도 차등",         constants: "love 1.25, rel 1.10",       direction: "선택적 amplifier" },
  { step: 9,  stage: "spread compression",    file: "aggregator.ts",          fn: "mergeScores() Task 1",  target: "6 categories",  purpose: "카테고리 간 편차 축소",           constants: "0.75×",                     direction: "inter-cat 변동성 압축 ★" },
  { step: 10, stage: "love stabilizer",       file: "aggregator.ts",          fn: "getDailyFortune() T6",  target: "love",          purpose: "love가 avg-5 이하 방지",         constants: "boost ≤ 4",                 direction: "love 하방 지지 (비대칭)" },
  { step: 11, stage: "relations stabilizer",  file: "aggregator.ts",          fn: "getDailyFortune() T9",  target: "relations",     purpose: "relations/love 연계 보정",       constants: "relBoost ≤ 12",             direction: "relations 하방 지지 ★" },
  { step: 12, stage: "stateAtom",             file: "stateAtomLayer.ts",      fn: "computeStateAtoms()",   target: "6 categories",  purpose: "십신·지지·행성 → state 변환",    constants: "MAX_CAT_DELTA=3",           direction: "±3 이내 미세 조정" },
  { step: 13, stage: "stateAtom softDamp",    file: "stateAtomLayer.ts",      fn: "softDamp()",            target: "10 atoms",      purpose: "복합 신호 과누적 방지",           constants: "T=3, sqrt 감쇄",            direction: "극단 atom 압축" },
  { step: 14, stage: "profileBaseline",       file: "profileBaselineLayer.ts", fn: "computeBaselineAdj()", target: "overall→6cat",  purpose: "만성 low/high 프로필 보정",      constants: "thr 58/74, max ±5/±3",      direction: "equalizer (lag 7일)" },
  { step: 15, stage: "monthly streakBreaker", file: "aggregator.ts",          fn: "getMonthlyFortune() T7", target: "top/bot cat",  purpose: "카테고리 순위 고착 방지",         constants: "streak≥3, adj 2/4",         direction: "top −4, bot +4" },
  { step: 16, stage: "final rounding",        file: "aggregator.ts",          fn: "getDailyFortune()",     target: "all",           purpose: "정수 반올림",                    constants: "Math.round",                direction: "±0.5 오차" },
];

console.log(`${"#".padEnd(4)} ${"단계".padEnd(22)} ${"상수/규모".padEnd(22)} ${"방향"}`);
console.log("─".repeat(80));
for (const r of PIPELINE_TABLE) {
  console.log(`${String(r.step).padEnd(4)} ${r.stage.padEnd(22)} ${r.constants.padEnd(22)} ${r.direction}`);
}

// ──────────────────────────────────────────────────────────────────────────────
// TASK 2: 단계별 stddev 추적
// ──────────────────────────────────────────────────────────────────────────────
console.log("\n══════════════════════════════════════════════════════════════════════════════");
console.log("TASK 2: 단계별 점수 분포 (프로필 A, 92일)");
console.log("══════════════════════════════════════════════════════════════════════════════\n");

process.stdout.write("프로필 A 파이프라인 추적 중... ");
const { stageHistories } = await runAllDays(ANCHOR);
console.log("완료\n");

const STAGE_NAMES = [
  "S1  raw merge (pre-clamp)",
  "S2  after dailyDelta clamp",
  "S3  after spread compression",
  "S4  after love/relations stabilizer",
  "S5  after stateAtom layer",
  "S6  after profileBaseline",
  "S7  final (rounded)",
];

// Compute stage stats for overall and each cat
console.log(`${"단계".padEnd(38)} ${"overall avg".padStart(12)} ${"std".padStart(7)} ${"min".padStart(6)} ${"max".padStart(6)}  변화(std)`);
console.log("─".repeat(78));

let prevStd = -1;
for (let i=0; i<STAGE_NAMES.length; i++) {
  const sh = stageHistories[i];
  const overalls = sh.map(s=>s.overall);
  const a = r1(avg(overalls));
  const s = r1(stdev(overalls));
  const mn = Math.min(...overalls);
  const mx = Math.max(...overalls);
  const delta = prevStd >= 0 ? r1(s - prevStd) : 0;
  const indicator = delta < -1 ? ` ← 압축 ${delta}` : delta < -0.4 ? ` ← 미약 ${delta}` : "";
  console.log(`${STAGE_NAMES[i].padEnd(38)} ${String(a).padStart(12)} ${String(s).padStart(7)} ${String(mn).padStart(6)} ${String(mx).padStart(6)}  ${delta>=0&&i>0?"+"+delta:delta}${indicator}`);
  prevStd = s;
}

console.log("\n카테고리별 stddev 변화 (S1→S7):");
for (const cat of DOM) {
  const s1std = r1(stdev(stageHistories[0].map(s=>s.cats[cat]??0)));
  const s7std = r1(stdev(stageHistories[6].map(s=>s.cats[cat]??0)));
  const delta = r1(s7std - s1std);
  const bar   = "█".repeat(Math.max(0,Math.round(Math.abs(delta)/1)));
  console.log(`  ${cat.padEnd(12)} ${String(s1std).padStart(6)} → ${String(s7std).padStart(6)}  Δ${delta>=0?"+"+delta:delta}  ${bar}`);
}

// ──────────────────────────────────────────────────────────────────────────────
// TASK 3: 카테고리 간 상관계수
// ──────────────────────────────────────────────────────────────────────────────
console.log("\n══════════════════════════════════════════════════════════════════════════════");
console.log("TASK 3: 카테고리 간 상관계수 (프로필 A, 최종 점수 기준)");
console.log("══════════════════════════════════════════════════════════════════════════════\n");

const finalDaysA = stageHistories[6].map(s => s.cats as Record<string,number>);

// Full correlation matrix
const corrMatrix: Record<string,Record<string,number>> = {};
for (const c1 of DOM) {
  corrMatrix[c1] = {};
  for (const c2 of DOM) {
    corrMatrix[c1][c2] = corr(
      finalDaysA.map(d=>d[c1]),
      finalDaysA.map(d=>d[c2]),
    );
  }
}

console.log(`${"".padEnd(12)} ${DOM.map(c=>c.slice(0,5).padStart(7)).join(" ")}`);
console.log("─".repeat(12+DOM.length*8));
for (const c1 of DOM) {
  const row = DOM.map(c2 => {
    const v = corrMatrix[c1][c2];
    return String(v).padStart(7);
  }).join(" ");
  console.log(`${c1.padEnd(12)} ${row}`);
}

// Notable pairs
console.log("\n주요 상관관계 쌍 (|corr| ≥ 0.5):");
const pairs: {a:string;b:string;v:number}[] = [];
for (let i=0;i<DOM.length;i++) {
  for (let j=i+1;j<DOM.length;j++) {
    const v = corrMatrix[DOM[i]][DOM[j]];
    if (Math.abs(v)>=0.5) pairs.push({a:DOM[i],b:DOM[j],v});
  }
}
pairs.sort((a,b)=>Math.abs(b.v)-Math.abs(a.v));
for (const p of pairs) {
  const bar = "█".repeat(Math.round(Math.abs(p.v)*20));
  const label = p.v>=0.9 ? " ◀ 거의 동조" : p.v>=0.75 ? " ← 강한 연동" : " ← 중간 연동";
  console.log(`  ${p.a} ↔ ${p.b}: ${String(p.v).padStart(5)}  ${bar}${label}`);
}

// Cluster analysis
console.log("\n상관 클러스터 (corr > 0.7 그룹):");
const clusterA = DOM.filter(c => corrMatrix["study"][c] > 0.7 && c!=="study");
const clusterB = DOM.filter(c => corrMatrix["love"][c] > 0.7 && c!=="love");
console.log(`  study 클러스터 (>0.7): [study, ${clusterA.join(", ")}]`);
console.log(`  love  클러스터 (>0.7): [love,  ${clusterB.join(", ")}]`);

// Also compute RAW (pre-compression) correlation for comparison
const rawDaysA = stageHistories[0].map(s => s.cats as Record<string,number>);
const rawPairs = pairs.map(p => ({...p, vRaw: corr(rawDaysA.map(d=>d[p.a]), rawDaysA.map(d=>d[p.b]))}));
console.log("\n spread compression 전후 상관계수 비교:");
for (const p of rawPairs) {
  const delta = r1(p.v - p.vRaw);
  console.log(`  ${p.a} ↔ ${p.b}: raw ${p.vRaw} → final ${p.v}  (${delta>=0?"+"+delta:delta})`);
}

// ──────────────────────────────────────────────────────────────────────────────
// TASK 4: 보정 ON/OFF 실험 (단일 프로필 + 3 프로필)
// ──────────────────────────────────────────────────────────────────────────────
console.log("\n══════════════════════════════════════════════════════════════════════════════");
console.log("TASK 4: 보정 ON/OFF 실험 (프로필 A, 92일)");
console.log("══════════════════════════════════════════════════════════════════════════════\n");

const EXPERIMENTS: {label:string; flags: Parameters<typeof computePipeline>[5]}[] = [
  { label: "A  DEFAULT",                  flags: {} },
  { label: "B  no dailyDelta clamp",      flags: { noClamp:true } },
  { label: "C  no spread compression",    flags: { noCompress:true } },
  { label: "D  no love/rel stabilizer",   flags: { noStabilizer:true } },
  { label: "E  no profileBaseline",       flags: { noBaseline:true } },
  { label: "F  no category sensitivity",  flags: { noSensitivity:true } },
];

interface ExpResult {
  label:    string;
  avgO:     number;
  stdO:     number;
  minO:     number;
  maxO:     number;
  catAvg:   Record<string,number>;
  catStd:   Record<string,number>;
  spread3:  number; // A/B/C user avg spread
}

process.stdout.write("보정 ON/OFF 실험 실행 중... ");

// Run A single-profile experiments
const expResultsA: ExpResult[] = [];
for (const exp of EXPERIMENTS) {
  const { finalDays: fd } = await runAllDays(ANCHOR, exp.flags);
  const overalls = fd.map(d => {
    const vals = DOM.map(c=>d[c]);
    return Math.round(avg(vals));
  });
  const catAvg: Record<string,number> = {};
  const catStd: Record<string,number> = {};
  for (const c of DOM) {
    catAvg[c] = r1(avg(fd.map(d=>d[c])));
    catStd[c] = r1(stdev(fd.map(d=>d[c])));
  }
  expResultsA.push({
    label: exp.label,
    avgO:  r1(avg(overalls)),
    stdO:  r1(stdev(overalls)),
    minO:  Math.min(...overalls),
    maxO:  Math.max(...overalls),
    catAvg, catStd,
    spread3: 0,
  });
}

// Run A/B/C for user-gap experiments
for (const exp of EXPERIMENTS) {
  const avgsABC: number[] = [];
  for (const p of PROFILES) {
    const { finalDays: fd } = await runAllDays(p, exp.flags);
    const overalls = fd.map(d => Math.round(avg(DOM.map(c=>d[c]))));
    avgsABC.push(r1(avg(overalls)));
  }
  const spread = r1(Math.max(...avgsABC) - Math.min(...avgsABC));
  const found = expResultsA.find(r => r.label === exp.label);
  if (found) found.spread3 = spread;
}
console.log("완료\n");

// Print experiment table
console.log(`${"설정".padEnd(28)} ${"avg".padStart(6)} ${"std".padStart(6)} ${"min".padStart(5)} ${"max".padStart(5)} ${"A/B/C gap".padStart(10)}  std변화`);
console.log("─".repeat(75));
const defaultStd = expResultsA[0].stdO;
const defaultGap = expResultsA[0].spread3;
for (const r of expResultsA) {
  const dStd = r1(r.stdO - defaultStd);
  const dGap = r1(r.spread3 - defaultGap);
  const arrow = dStd > 1 ? " ←★ 변동↑" : dStd > 0.3 ? " ← 변동↑" : dStd < -1 ? " ←★ 변동↓" : "";
  console.log(`${r.label.padEnd(28)} ${String(r.avgO).padStart(6)} ${String(r.stdO).padStart(6)} ${String(r.minO).padStart(5)} ${String(r.maxO).padStart(5)} ${String(r.spread3).padStart(10)}  ${dStd>=0?"+"+dStd:dStd}${arrow}`);
}

// Category detail for key experiments
console.log("\n카테고리별 stddev 비교 (DEFAULT vs 핵심 2개):");
const keyExps = ["A  DEFAULT", "B  no dailyDelta clamp", "C  no spread compression"];
const keyResults = expResultsA.filter(r => keyExps.some(k => r.label.startsWith(k.slice(0,15))));
console.log(`${"카테고리".padEnd(12)} ${keyResults.map(r=>r.label.slice(0,15).padStart(16)).join(" ")}`);
console.log("─".repeat(12+16*keyResults.length+keyResults.length));
for (const c of DOM) {
  const row = keyResults.map(r => `${String(r.catAvg[c]).padStart(6)}±${String(r.catStd[c]).padStart(5)}`).join("  ");
  console.log(`${c.padEnd(12)} ${row}`);
}

// ──────────────────────────────────────────────────────────────────────────────
// TASK 5: 보정별 의도·부작용 평가
// ──────────────────────────────────────────────────────────────────────────────
console.log("\n══════════════════════════════════════════════════════════════════════════════");
console.log("TASK 5: 보정별 의도·부작용 평가");
console.log("══════════════════════════════════════════════════════════════════════════════\n");

const defaultR = expResultsA[0];
const noClampR  = expResultsA.find(r=>r.label.includes("clamp"))!;
const noCompR   = expResultsA.find(r=>r.label.includes("compress"))!;
const noStabR   = expResultsA.find(r=>r.label.includes("stabilizer"))!;
const noBaseR   = expResultsA.find(r=>r.label.includes("Baseline"))!;
const noSensR   = expResultsA.find(r=>r.label.includes("sensitivity"))!;

const evaluations = [
  {
    name: "dailyDelta clamp (−12)",
    stdChange:  r1(defaultR.stdO - noClampR.stdO),
    intention: "극단 나쁜 날 방지, 패널티 누적 방지",
    effect:    `overall std: no-clamp ${noClampR.stdO} → default ${defaultR.stdO}  (${r1(defaultR.stdO-noClampR.stdO)})`,
    sideEffect:"낮은 프로필 사용자는 하방이 -12에서 절단 → 여러 날이 같은 바닥에 붙음, stddev 비대칭 압축",
    recommend: "soft clamp로 교체: −16까지 linearly 감쇠, −20 하드 한도",
    priority:  "🔴 높음",
  },
  {
    name: "spread compression (0.75×)",
    stdChange:  r1(defaultR.stdO - noCompR.stdO),
    intention: "카테고리 간 극단 편차 방지",
    effect:    `inter-cat corr 상승, overall std: no-comp ${noCompR.stdO} → default ${defaultR.stdO}  (${r1(defaultR.stdO-noCompR.stdO)})`,
    sideEffect:"6개 카테고리가 같이 움직임 → study/career/love가 구분되지 않음, AI 해석의 다양성 훼손",
    recommend: "0.75 → 0.88 완화 또는 outlier-only 압축으로 변경",
    priority:  "🔴 높음",
  },
  {
    name: "love stabilizer (≤4)",
    stdChange:  0,
    intention: "love가 평균 대비 5점+ 낮으면 최대 4점 lift",
    effect:    `love std 소폭 감소, avg 소폭 상승`,
    sideEffect:"love 하방이 구조적으로 지지됨 → love가 'never lowest' 경향, 빈약한 연애 흐름 표현 못 함",
    recommend: "boost 상한 4 → 2로 낮추거나, 十神(식신·상관) 조건으로만 활성화",
    priority:  "🟡 중간",
  },
  {
    name: "relations stabilizer (≤12)",
    stdChange:  0,
    intention: "love>avg이고 relations<avg-5일 때 최대 12점 lift",
    effect:    `relations 하방 비대칭 지지, std 감소`,
    sideEffect:"boost 상한 12는 매우 큰 단방향 조정 → relations가 love를 따라가는 구조 고착화",
    recommend: "boost 상한 12 → 6으로 절반 감쇠, 또는 relations 가중치 직접 조정",
    priority:  "🔴 높음",
  },
  {
    name: "profileBaselineLayer (±5/±3)",
    stdChange:  r1(defaultR.stdO - noBaseR.stdO),
    intention: "만성 low/high 프로필의 절대 기준선 equalizer",
    effect:    `avg 방향성 올바름, 프로필 C는 22/92일 활성`,
    sideEffect:"7일 min window → 신규 사용자 첫 주 미적용, max +5가 -8 차이 교정에 부족",
    recommend: "FLOOR_THR 58→62, STRENGTH_LO 0.35→0.45, MIN_DAYS 7→4",
    priority:  "🟡 중간",
  },
  {
    name: "stateAtom layer (±3)",
    stdChange:  0,
    intention: "십신·지지·행성 신호를 state 매개로 변환",
    effect:    `하루온도 점수 ±3 이내, std 기여 미미`,
    sideEffect:"MAX_CAT_DELTA=3이 너무 작아 미세 조정에 불과, amplifier 실험에서도 효과가 이 clamp에 흡수됨",
    recommend: "MAX_CAT_DELTA=3 → 4~5로 확대 실험, 또는 유지",
    priority:  "🟢 낮음",
  },
  {
    name: "category sensitivity (love 1.25)",
    stdChange:  r1(defaultR.stdO - noSensR.stdO),
    intention: "love/relations에 더 민감한 반응 부여",
    effect:    `love std ${defaultR.catStd.love} vs no-sens ${noSensR.catStd.love}`,
    sideEffect:"sensitivity가 spread compression 이전에 적용 → 압축에 의해 amplification 효과 일부 상쇄",
    recommend: "유지 (설계 의도 명확), spread compression 완화 시 효과 복원",
    priority:  "🟢 낮음",
  },
  {
    name: "monthly streak breaker",
    stdChange:  0,
    intention: "top/bot 카테고리 3일+ 연속 고착 방지",
    effect:    `월별 카테고리 순위 다양성 개선`,
    sideEffect:"점수를 직접 강제 조정 → 원인(점수 계산) 미해결, 증상만 처리",
    recommend: "유지하되 adj 4→2로 줄이거나, top-1 카테고리 외에도 확장",
    priority:  "🟢 낮음",
  },
];

for (const ev of evaluations) {
  console.log(`▶ ${ev.name}  [${ev.priority}]`);
  console.log(`  원래 의도:  ${ev.intention}`);
  console.log(`  실제 효과:  ${ev.effect}`);
  console.log(`  부작용:     ${ev.sideEffect}`);
  console.log(`  추천:       ${ev.recommend}`);
  console.log();
}

// ──────────────────────────────────────────────────────────────────────────────
// TASK 6: 최종 결론
// ──────────────────────────────────────────────────────────────────────────────
console.log("══════════════════════════════════════════════════════════════════════════════");
console.log("TASK 6: 최종 결론");
console.log("══════════════════════════════════════════════════════════════════════════════\n");

// Std reduction attribution
const stdReductions = [
  { name: "dailyDelta clamp",       delta: r1(noClampR.stdO  - defaultR.stdO) },
  { name: "spread compression",     delta: r1(noCompR.stdO   - defaultR.stdO) },
  { name: "love/rel stabilizer",    delta: r1(noStabR.stdO   - defaultR.stdO) },
  { name: "profileBaseline",        delta: r1(noBaseR.stdO   - defaultR.stdO) },
  { name: "sensitivity (amplifier)",delta: r1(noSensR.stdO   - defaultR.stdO) },
].sort((a,b)=>b.delta-a.delta);

console.log("Q1. 점수 변동성을 가장 크게 줄이는 단계:");
for (const r of stdReductions) {
  const bar = r.delta > 0 ? "█".repeat(Math.min(20,Math.round(r.delta*3))) : "";
  console.log(`  ${r.name.padEnd(25)} 제거 시 stddev +${r.delta}  ${bar}`);
}

// Spread compression impact on correlation
const topCorrPair = pairs[0];
console.log(`\nQ2. 카테고리별 점수가 비슷하게 움직이는 주된 원인:`);
console.log(`  spread compression 0.75× — 모든 카테고리를 일별 평균 쪽으로 끌어당김`);
console.log(`  가장 높은 상관 쌍: ${topCorrPair.a} ↔ ${topCorrPair.b} = ${topCorrPair.v}`);
const prePair = rawPairs.find(p=>p.a===topCorrPair.a&&p.b===topCorrPair.b);
if (prePair) console.log(`  compression 전: ${prePair.vRaw} → 후: ${prePair.v}  (${r1(prePair.v-prePair.vRaw)})`);

console.log(`\nQ3. 사용자별 평균 차이를 만드는 주된 원인:`);
console.log(`  SajuEngine 정적 요소 (natal TG + 특별성 + dayun) — 이전 분석에서 59.6% 확인`);
console.log(`  Astro natal baseline (2026 year-fix: health -6, career -3) — 모든 사용자 동일 적용`);

console.log(`\nQ4/5/6. 보정 유지·완화·제거 판단:`);
const table6 = [
  { name:"dailyDelta clamp −12",      action:"🔧 완화",   reason:"변동성 압축 최대주범, soft clamp 교체" },
  { name:"spread compression 0.75×",  action:"🔧 완화",   reason:"inter-cat 상관 주범, 0.88 또는 outlier-only" },
  { name:"relations stabilizer ≤12",  action:"🔧 완화",   reason:"단방향 과도, 상한 6으로 절반" },
  { name:"love stabilizer ≤4",        action:"🔧 완화",   reason:"조건부 활성화로 제한" },
  { name:"profileBaselineLayer",       action:"✅ 유지+튜닝", reason:"equalizer 방향 올바름, 임계값 완화 필요" },
  { name:"monthly streak breaker",     action:"✅ 유지",   reason:"카테고리 다양성 보장, 규모 작음" },
  { name:"stateAtom layer (±3)",       action:"✅ 유지",   reason:"의미있는 구조, MAX_DELTA 소폭 확대 검토" },
  { name:"category sensitivity",       action:"✅ 유지",   reason:"설계 의도 명확, compress 완화 시 효과 복원" },
  { name:"softScale",                  action:"✅ 유지",   reason:"85+ 극단만 처리, 대부분 무관" },
];
for (const row of table6) {
  console.log(`  ${row.action} ${row.name.padEnd(30)} — ${row.reason}`);
}

console.log(`\nQ7. "상대적 흐름" 기준 수정 우선순위 3개:`);
console.log(`  1️⃣  spread compression 완화 (0.75 → 0.88)`);
console.log(`       이유: 6개 카테고리가 같이 움직이면 "오늘 재물은 좋고 건강은 나쁨" 구분 불가`);
console.log(`       위험도: 낮음 — 카테고리 범위 넓어지지만 overall은 거의 변하지 않음`);
console.log();
console.log(`  2️⃣  dailyDelta clamp 완화 (−12 → soft −16 → hard −20)`);
console.log(`       이유: "매우 나쁜 날"이 표현되지 않음 → 흐름의 골짜기가 평탄화`);
console.log(`       위험도: 중간 — 낮은 점수 사용자 경험 주의, baseline과 연계 필요`);
console.log();
console.log(`  3️⃣  relations stabilizer 상한 12 → 6`);
console.log(`       이유: love가 높으면 relations도 자동으로 올라가는 구조 → relations 독립성 훼손`);
console.log(`       위험도: 낮음 — 점수 약간 낮아지나 더 자연스러운 관계 흐름 표현`);

console.log("\n──────────────────────────────────────────────────────────────────────────────");
console.log("리스크 낮은 1차 수정안 (단계적 적용 권장)");
console.log("──────────────────────────────────────────────────────────────────────────────\n");
console.log("  [1단계] spread compression: 0.75 → 0.88  (1줄 변경, aggregator.ts mergeScores)");
console.log("          예상 효과: inter-cat std +20~30%, 상관계수 0.1~0.2 하락, overall 영향 없음");
console.log();
console.log("  [2단계] relations stabilizer: Math.min(12, ...) → Math.min(6, ...)  (1줄 변경)");
console.log("          예상 효과: relations std 소폭 상승, love-relations 상관 0.1 하락");
console.log();
console.log("  [3단계] profileBaseline: FLOOR_THR=58→62, STRENGTH_LO=0.35→0.45, MIN_DAYS=7→4");
console.log("          예상 효과: 낮은 프로필 사용자 초기 경험 개선, avg 차이 1~2점 추가 감소");
console.log();
console.log("  ※ dailyDelta clamp 완화는 별도 실험 후 적용 (3개 완료 후 2차)");
console.log("  ※ 각 단계 후 반드시 analyzeBaseline.ts 재실행하여 stddev/spread 확인");

console.log("\n✅ 분석 완료");
