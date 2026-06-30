/**
 * State Atom Layer Saturation Investigation
 * Answers: which atoms cause health/relations cap saturation and what fixes help
 */
import { buildSajuEngineFromProfile, type SajuEngineProfile } from "./src/engines/sajuEngine.js";
import { buildAstroEngineFromProfile, type AstroProfile, SAMPLE_ASTRO_PROFILE } from "./src/engines/astroEngine.js";
import { computeStateAtoms, type StateAtomKey } from "./src/engines/stateAtomLayer.js";

// ── Profiles (same as final_validation.ts) ────────────────────────────────────
const PROFILE_A_SAJU: SajuEngineProfile = {
  day_stem:"甲", month_stem:"庚", hour_branch:"戌", day_branch:"子",
  month_branch:"午", year_branch:"卯", special_stars:["백호살"],
  dayun_stem:"壬", dayun_branch:"午",
};
const PROFILE_A_ASTRO: AstroProfile = {
  ...SAMPLE_ASTRO_PROFILE,
  planet_houses:{...SAMPLE_ASTRO_PROFILE.planet_houses, Saturn:6},
};

const PROFILE_B_SAJU: SajuEngineProfile = {
  day_stem:"甲", month_stem:"己", hour_branch:"子", day_branch:"寅",
  month_branch:"未", year_branch:"戌", special_stars:[],
  dayun_stem:"甲", dayun_branch:"寅",
};
const PROFILE_B_ASTRO: AstroProfile = {
  ...SAMPLE_ASTRO_PROFILE,
  planet_houses:{...SAMPLE_ASTRO_PROFILE.planet_houses, Saturn:12},
};

const PROFILE_C_SAJU: SajuEngineProfile = {
  day_stem:"丙", month_stem:"甲", hour_branch:"亥", day_branch:"寅",
  month_branch:"午", year_branch:"戌", special_stars:["천덕귀인"],
  dayun_stem:"甲", dayun_branch:"寅",
};
const PROFILE_C_ASTRO: AstroProfile = {
  ...SAMPLE_ASTRO_PROFILE,
  planet_houses:{...SAMPLE_ASTRO_PROFILE.planet_houses, Saturn:10},
};

// ── STATE_TO_CAT  (mirrors stateAtomLayer.ts) ─────────────────────────────────
const STATE_TO_CAT: Record<StateAtomKey, Partial<Record<string, number>>> = {
  stability:          { health:  0.8, love:  0.4, relations:  0.5, career:  0.3 },
  tension:            { health: -0.8, love: -0.3, relations: -0.4, career: -0.2 },
  recovery:           { health:  1.0, study: 0.25, career:   0.25 },
  focus:              { study:   1.0, career: 0.6 },
  emotionalAmplitude: { love:    0.5, relations: -0.25, health: -0.2 },
  socialFatigue:      { relations: -0.9, love: -0.4, health: -0.3 },
  executionFlow:      { career:  1.0, wealth: 0.4, study:   0.3 },
  energySustain:      { health:  0.7, career: 0.4, study:   0.3 },
  organization:       { study:   0.7, career: 0.6, wealth:  0.4 },
  impulsiveness:      { wealth: -0.6, love:   0.2, relations: -0.3, health: -0.2 },
};
const ALL_ATOM_KEYS: StateAtomKey[] = [
  "stability","tension","recovery","focus","emotionalAmplitude",
  "socialFatigue","executionFlow","energySustain","organization","impulsiveness",
];

// ── Option helpers ────────────────────────────────────────────────────────────

function computeRawDelta(atomVals: Record<StateAtomKey, number>, cat: string): number {
  let d = 0;
  for (const k of ALL_ATOM_KEYS) {
    const coeff = (STATE_TO_CAT[k] as Record<string,number>)[cat] ?? 0;
    if (coeff !== 0) d += atomVals[k] * coeff;
  }
  return d;
}

// Option A: current — linear sum + clamp at ±3
function optA(raw: number): number { return Math.max(-3, Math.min(3, raw)); }

// Option B: atom-level tanh softScale — if |v|>2, apply tanh compression
function softAtom(v: number): number {
  if (Math.abs(v) <= 2) return v;
  return Math.sign(v) * (2 + Math.tanh((Math.abs(v) - 2) * 0.6));
}
function computeRawDeltaB(atomVals: Record<StateAtomKey, number>, cat: string): number {
  let d = 0;
  for (const k of ALL_ATOM_KEYS) {
    const coeff = (STATE_TO_CAT[k] as Record<string,number>)[cat] ?? 0;
    if (coeff !== 0) d += softAtom(atomVals[k]) * coeff;
  }
  return d;
}

// Option C: tanh category compression — maps any raw value into (-3, +3) asymptotically
function optC(raw: number): number { return Math.tanh(raw / 3) * 3; }

// Option D: reduce negative STATE_TO_CAT coefficients for health & relations by ×0.70
const STATE_TO_CAT_D: Record<StateAtomKey, Partial<Record<string, number>>> = JSON.parse(JSON.stringify(STATE_TO_CAT));
for (const k of ALL_ATOM_KEYS) {
  for (const cat of ["health", "relations"]) {
    const v = (STATE_TO_CAT_D[k] as Record<string,number>)[cat] ?? 0;
    if (v < 0) (STATE_TO_CAT_D[k] as Record<string,number>)[cat] = +(v * 0.70).toFixed(4);
  }
}
function computeRawDeltaD(atomVals: Record<StateAtomKey, number>, cat: string): number {
  let d = 0;
  for (const k of ALL_ATOM_KEYS) {
    const coeff = (STATE_TO_CAT_D[k] as Record<string,number>)[cat] ?? 0;
    if (coeff !== 0) d += atomVals[k] * coeff;
  }
  return d;
}

// ── Data collection ───────────────────────────────────────────────────────────

interface DayRecord {
  date:                  string;
  atomVals:              Record<StateAtomKey, number>;
  rawH:  number;  rawR:  number;  rawL: number;  rawC: number;
  monthOnlyH: number;   monthOnlyR: number;
  events:                string[];
  atomContribH:          Record<StateAtomKey, number>;
  atomContribR:          Record<StateAtomKey, number>;
}

function collectProfile(
  saju: SajuEngineProfile,
  astro: AstroProfile,
  birth: Date,
): DayRecord[] {
  const se = buildSajuEngineFromProfile(saju);
  const ae = buildAstroEngineFromProfile(astro);
  const records: DayRecord[] = [];

  for (let day = 1; day <= 31; day++) {
    const dt  = new Date(2026, 4, day);
    const sr  = se.calculate(dt);
    const ar  = ae.calculate(dt, birth);

    const dayBR   = (sr.factors.day_branch_relation_types   as string[]) ?? [];
    const monBR   = (sr.factors.month_branch_relation_types as string[]) ?? [];
    const aspects = (ar.factors.active_transit_aspects      as string[]) ?? [];

    // Full computation
    const full = computeStateAtoms({
      ten_god_of_day:              sr.factors.ten_god_of_day as string | undefined,
      active_stars:                [],
      day_branch_relation_types:   dayBR,
      month_branch_relation_types: monBR,
      ohaeng_clash_stem:           (sr.factors.ohaeng_clash_stem  as boolean) ?? false,
      ohaeng_clash_branch:         (sr.factors.ohaeng_clash_branch as boolean) ?? false,
      active_transit_aspects:      aspects,
    });

    const atomVals = {} as Record<StateAtomKey, number>;
    for (const [k, e] of Object.entries(full.debug.atoms)) atomVals[k as StateAtomKey] = e.value;

    // Month-branch-only contribution (constant across May — same monBR every day)
    const moOnly = computeStateAtoms({
      ten_god_of_day:              undefined,
      active_stars:                [],
      day_branch_relation_types:   [],
      month_branch_relation_types: monBR,
      ohaeng_clash_stem:           false,
      ohaeng_clash_branch:         false,
      active_transit_aspects:      [],
    });
    const moAtoms = {} as Record<StateAtomKey, number>;
    for (const [k, e] of Object.entries(moOnly.debug.atoms)) moAtoms[k as StateAtomKey] = e.value;
    const monthOnlyH = computeRawDelta(moAtoms, "health");
    const monthOnlyR = computeRawDelta(moAtoms, "relations");

    // Per-atom contributions
    const atomContribH = {} as Record<StateAtomKey, number>;
    const atomContribR = {} as Record<StateAtomKey, number>;
    for (const k of ALL_ATOM_KEYS) {
      atomContribH[k] = atomVals[k] * ((STATE_TO_CAT[k] as Record<string,number>)["health"]    ?? 0);
      atomContribR[k] = atomVals[k] * ((STATE_TO_CAT[k] as Record<string,number>)["relations"] ?? 0);
    }

    records.push({
      date: `05/${String(day).padStart(2,"0")}`,
      atomVals,
      rawH: computeRawDelta(atomVals, "health"),
      rawR: computeRawDelta(atomVals, "relations"),
      rawL: computeRawDelta(atomVals, "love"),
      rawC: computeRawDelta(atomVals, "career"),
      monthOnlyH, monthOnlyR,
      events: full.debug.activeEvents,
      atomContribH, atomContribR,
    });
  }
  return records;
}

// ── Analysis ──────────────────────────────────────────────────────────────────

function mean(arr: number[]) { return arr.reduce((a,b)=>a+b,0)/arr.length; }
function minOf(arr: number[]) { return Math.min(...arr); }
function maxOf(arr: number[]) { return Math.max(...arr); }
function satNeg(arr: number[], threshold=-3) { return arr.filter(v=>v<=threshold).length; }

function analyzeProfile(label: string, records: DayRecord[]) {
  const N = records.length;
  console.log(`\n${"═".repeat(70)}`);
  console.log(`  PROFILE ${label}`);
  console.log("═".repeat(70));

  // [1] Raw delta stats
  const rawH = records.map(r=>r.rawH);
  const rawR = records.map(r=>r.rawR);
  const rawL = records.map(r=>r.rawL);
  const rawC = records.map(r=>r.rawC);

  console.log("\n[1] RAW CATEGORY DELTA BEFORE CLAMP  (neg = suppresses score)");
  console.log(`    Cat         mean    min    max  sat≤-3  sat≥+3`);
  for (const [lb, arr] of [["health   ",rawH],["relations",rawR],["love     ",rawL],["career   ",rawC]] as [string,number[]][]) {
    const sN = satNeg(arr,-3), sP = arr.filter(v=>v>=3).length;
    console.log(`    ${lb}   ${mean(arr).toFixed(2).padStart(6)}  ${minOf(arr).toFixed(1).padStart(5)}  ${maxOf(arr).toFixed(1).padStart(5)}   ${String(sN).padStart(2)}d(${Math.round(sN/N*100)}%)  ${String(sP).padStart(2)}d(${Math.round(sP/N*100)}%)`);
  }

  // [2] Per-atom mean contribution to health and relations
  const printContribs = (cat: "atomContribH"|"atomContribR", catLabel: string) => {
    console.log(`\n[2${cat==="atomContribH"?"a":"b"}] MEAN PER-ATOM CONTRIBUTION → ${catLabel}`);
    const contribs = ALL_ATOM_KEYS.map(k => ({
      k, mean: records.reduce((s,r)=>s+r[cat][k],0)/N,
      coeff: (STATE_TO_CAT[k] as Record<string,number>)[catLabel==="HEALTH"?"health":"relations"] ?? 0,
    })).filter(x=>Math.abs(x.mean)>=0.01).sort((a,b)=>a.mean-b.mean);
    for (const {k, mean: m, coeff} of contribs) {
      const bar = m < 0 ? "▼".repeat(Math.min(8, Math.round(Math.abs(m)))) : "▲".repeat(Math.min(8, Math.round(m)));
      console.log(`    ${k.padEnd(20)}  ${(m>=0?"+":"")}${m.toFixed(2)}  coeff:${coeff.toFixed(2).padStart(5)}  ${bar}`);
    }
    const total = contribs.reduce((s,x)=>s+x.mean,0);
    console.log(`    ${"────────────".padEnd(20)}  ${(total>=0?"+":"")}${total.toFixed(2)}  ← mean raw delta`);
  };
  printContribs("atomContribH", "HEALTH");
  printContribs("atomContribR", "RELATIONS");

  // [3] Month-branch persistent contribution
  const mbH = records[0].monthOnlyH;  // same every day
  const mbR = records[0].monthOnlyR;
  console.log(`\n[3] MONTH BRANCH PERSISTENT CONTRIBUTION (fixed for all of May)`);
  console.log(`    health   : ${mbH.toFixed(3)} pts (constant term, 0.5× scaled)`);
  console.log(`    relations: ${mbR.toFixed(3)} pts (constant term, 0.5× scaled)`);
  const dayAcuteH = records.map(r=>r.rawH - r.monthOnlyH);
  const dayAcuteR = records.map(r=>r.rawR - r.monthOnlyR);
  console.log(`    health   acute (day+astro only):    mean=${mean(dayAcuteH).toFixed(2)}  range [${minOf(dayAcuteH).toFixed(1)}, ${maxOf(dayAcuteH).toFixed(1)}]`);
  console.log(`    relations acute (day+astro only):   mean=${mean(dayAcuteR).toFixed(2)}  range [${minOf(dayAcuteR).toFixed(1)}, ${maxOf(dayAcuteR).toFixed(1)}]`);
  const satAcuteH = dayAcuteH.filter(v=>v+mbH<=-3).length;
  const satAcuteR = dayAcuteR.filter(v=>v+mbR<=-3).length;
  console.log(`    Saturation driven by month-branch alone (acute > 0 but total ≤ -3): ${satAcuteH}d health, ${satAcuteR}d relations`);

  // [4] Raw atom value ranges
  console.log("\n[4] RAW ATOM VALUE RANGES (before coefficient multiply)");
  console.log(`    Atom                  mean    min    max`);
  for (const k of ALL_ATOM_KEYS) {
    const vals = records.map(r=>r.atomVals[k]);
    const m = mean(vals), mn = minOf(vals), mx = maxOf(vals);
    if (Math.abs(m)<0.05 && Math.abs(mn)<0.1 && mx<0.1) continue;
    console.log(`    ${k.padEnd(20)}  ${m.toFixed(2).padStart(5)}  ${mn.toFixed(1).padStart(5)}  ${mx.toFixed(1).padStart(5)}`);
  }

  // [5] Options simulation
  console.log("\n[5] OPTION SIMULATIONS  (sat = days where final delta ≤ -3)");
  console.log(`    ${"Option".padEnd(36)}  hSat    rSat    hMean  rMean  lMean  cMean`);

  type SimEntry = { label: string; hd: number[]; rd: number[]; ld: number[]; cd: number[] };
  const sims: SimEntry[] = [
    {
      label: "A: Current  linear+clamp",
      hd: records.map(r=>optA(r.rawH)),
      rd: records.map(r=>optA(r.rawR)),
      ld: records.map(r=>optA(r.rawL)),
      cd: records.map(r=>optA(r.rawC)),
    },
    {
      label: "B: Atom softScale+clamp",
      hd: records.map(r=>optA(computeRawDeltaB(r.atomVals,"health"))),
      rd: records.map(r=>optA(computeRawDeltaB(r.atomVals,"relations"))),
      ld: records.map(r=>optA(computeRawDeltaB(r.atomVals,"love"))),
      cd: records.map(r=>optA(computeRawDeltaB(r.atomVals,"career"))),
    },
    {
      label: "C: tanh(raw/3)*3  no hard clamp",
      hd: records.map(r=>optC(r.rawH)),
      rd: records.map(r=>optC(r.rawR)),
      ld: records.map(r=>optC(r.rawL)),
      cd: records.map(r=>optC(r.rawC)),
    },
    {
      label: "D: neg coeff ×0.70 H/R",
      hd: records.map(r=>optA(computeRawDeltaD(r.atomVals,"health"))),
      rd: records.map(r=>optA(computeRawDeltaD(r.atomVals,"relations"))),
      ld: records.map(r=>optA(r.rawL)),
      cd: records.map(r=>optA(r.rawC)),
    },
    {
      label: "E: Month branch 0.3× (was 0.5×)",
      // Approximate: reduce month-branch contribution by 0.4x its 0.5x fraction
      hd: records.map(r=>optA(r.rawH - r.monthOnlyH * 0.4)),
      rd: records.map(r=>optA(r.rawR - r.monthOnlyR * 0.4)),
      ld: records.map(r=>optA(r.rawL)),
      cd: records.map(r=>optA(r.rawC)),
    },
    {
      label: "B+C: atomSoft + tanh",
      hd: records.map(r=>optC(computeRawDeltaB(r.atomVals,"health"))),
      rd: records.map(r=>optC(computeRawDeltaB(r.atomVals,"relations"))),
      ld: records.map(r=>optC(computeRawDeltaB(r.atomVals,"love"))),
      cd: records.map(r=>optC(computeRawDeltaB(r.atomVals,"career"))),
    },
  ];

  for (const s of sims) {
    const hSn = satNeg(s.hd), rSn = satNeg(s.rd);
    const hSp = `${hSn}d(${Math.round(hSn/N*100)}%)`;
    const rSp = `${rSn}d(${Math.round(rSn/N*100)}%)`;
    const lbl = s.label.padEnd(36);
    console.log(`    ${lbl}  ${hSp.padEnd(8)}${rSp.padEnd(8)}  ${mean(s.hd).toFixed(2).padStart(5)}  ${mean(s.rd).toFixed(2).padStart(5)}  ${mean(s.ld).toFixed(2).padStart(5)}  ${mean(s.cd).toFixed(2).padStart(5)}`);
  }

  // [6] Event frequency
  const evCnt: Record<string,number> = {};
  for (const r of records) for (const e of r.events) evCnt[e] = (evCnt[e]??0)+1;
  const topEvts = Object.entries(evCnt).sort((a,b)=>b[1]-a[1]).slice(0,12);
  console.log("\n[6] EVENT FREQUENCY (days/31)");
  for (const [e,c] of topEvts) {
    console.log(`    ${String(c).padStart(3)}/31  ${e}`);
  }

  // [7] Worst saturation days
  const worst = records.filter(r=>r.rawH<=-3.5||r.rawR<=-3.5).slice(0,5);
  if (worst.length) {
    console.log("\n[7] WORST DAYS (rawH≤-3.5 or rawR≤-3.5)");
    console.log(`    Date  rawH rawR  tension  socialFatigue  emotAmp impuls  stability recovery`);
    for (const r of worst) {
      const av = r.atomVals;
      console.log(`    ${r.date}  ${r.rawH.toFixed(1).padStart(4)} ${r.rawR.toFixed(1).padStart(4)}` +
        `  ${av.tension.toFixed(1).padStart(7)}  ${av.socialFatigue.toFixed(1).padStart(13)}` +
        `  ${av.emotionalAmplitude.toFixed(1).padStart(7)} ${av.impulsiveness.toFixed(1).padStart(6)}` +
        `  ${av.stability.toFixed(1).padStart(9)} ${av.recovery.toFixed(1).padStart(8)}`);
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log("╔══════════════════════════════════════════════════════════════════════╗");
console.log("║   STATE ATOM LAYER SATURATION — Root Cause Investigation            ║");
console.log("╚══════════════════════════════════════════════════════════════════════╝");

const birth = new Date(1998,0,22);
const recA = collectProfile(PROFILE_A_SAJU, PROFILE_A_ASTRO, birth);
const recB = collectProfile(PROFILE_B_SAJU, PROFILE_B_ASTRO, birth);
const recC = collectProfile(PROFILE_C_SAJU, PROFILE_C_ASTRO, birth);

analyzeProfile("A (Stress)",   recA);
analyzeProfile("B (Neutral)",  recB);
analyzeProfile("C (Positive)", recC);

// ── Cross-profile summary + gate check ───────────────────────────────────────
console.log(`\n${"═".repeat(70)}`);
console.log("  CROSS-PROFILE GATE CHECK — per option");
console.log("═".repeat(70));

const allRecs = [recA, recB, recC];
const optionDefs: Array<{label: string; hFn(r:DayRecord):number; rFn(r:DayRecord):number}> = [
  { label:"A: Current",                    hFn:r=>optA(r.rawH), rFn:r=>optA(r.rawR) },
  { label:"B: Atom softScale",             hFn:r=>optA(computeRawDeltaB(r.atomVals,"health")), rFn:r=>optA(computeRawDeltaB(r.atomVals,"relations")) },
  { label:"C: tanh compression",           hFn:r=>optC(r.rawH), rFn:r=>optC(r.rawR) },
  { label:"D: neg coeff ×0.70",            hFn:r=>optA(computeRawDeltaD(r.atomVals,"health")), rFn:r=>optA(computeRawDeltaD(r.atomVals,"relations")) },
  { label:"E: Month branch 0.3×",          hFn:r=>optA(r.rawH-r.monthOnlyH*0.4), rFn:r=>optA(r.rawR-r.monthOnlyR*0.4) },
  { label:"B+C: atomSoft+tanh",            hFn:r=>optC(computeRawDeltaB(r.atomVals,"health")), rFn:r=>optC(computeRawDeltaB(r.atomVals,"relations")) },
];

console.log(`\n  ${"Option".padEnd(30)}  hSat(A/B/C)%  rSat(A/B/C)%  hGate  rGate  notes`);
for (const opt of optionDefs) {
  const hPcts = allRecs.map(recs => Math.round(satNeg(recs.map(opt.hFn),-3)/31*100));
  const rPcts = allRecs.map(recs => Math.round(satNeg(recs.map(opt.rFn),-3)/31*100));
  const worstH = Math.max(...hPcts), worstR = Math.max(...rPcts);
  const hGate = worstH < 65 ? "PASS" : "FAIL";
  const rGate = worstR < 30 ? "PASS" : "FAIL";
  // Note: rGate <30% is the original "relations bottom <30%" gate, adapted here as saturation proxy
  const hStr = hPcts.map(v=>`${v}%`).join("/");
  const rStr = rPcts.map(v=>`${v}%`).join("/");
  const notes = worstH<65 && worstR<30 ? "← passes both" : worstH<65 ? "← H ok" : worstR<30 ? "← R ok" : "";
  console.log(`  ${opt.label.padEnd(30)}  ${hStr.padEnd(14)}${rStr.padEnd(14)}  ${hGate}   ${rGate}  ${notes}`);
}

// Saturation → bottom-rank relationship note
console.log(`\n  Note: saturation% ≈ days when atom layer fully clamps (delta at floor).`);
console.log(`  Health bottom-rank gate is < 65%. Relations bottom-rank gate is < 30%.`);
console.log(`  High saturation ≠ guaranteed bottom rank (engine base score also matters),`);
console.log(`  but high negative saturation correlates strongly with bottom-rank frequency.`);
console.log("");
