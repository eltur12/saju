/**
 * FINAL INTEGRATED VALIDATION
 * All fixes applied — compression 0.75, health sens 1.00, relations fixes,
 * 官祿 dahan +3, State Atom Layer, MAX_CAT_DELTA=3
 * Run: npx tsx final_validation.ts
 */
import { FortuneAggregator } from "./src/engines/aggregator.js";
import type { SajuEngineProfile } from "./src/engines/sajuEngine.js";
import { buildSajuEngineFromProfile } from "./src/engines/sajuEngine.js";
import { buildZiweiEngineFromProfile, type ZiweiProfile, SAMPLE_ZIWEI_PROFILE } from "./src/engines/ziweiEngine.js";
import { buildAstroEngineFromProfile, type AstroProfile, SAMPLE_ASTRO_PROFILE } from "./src/engines/astroEngine.js";
import { computeStateAtoms } from "./src/engines/stateAtomLayer.js";

// ── Profiles ──────────────────────────────────────────────────────────────────
const PROFILE_A_SAJU: SajuEngineProfile = {
  day_stem:"甲", month_stem:"庚", hour_branch:"戌", day_branch:"子",
  month_branch:"午", year_branch:"卯", special_stars:["백호살"],
  dayun_stem:"壬", dayun_branch:"午",
};
const PROFILE_A_ZIWEI: ZiweiProfile = {
  ...SAMPLE_ZIWEI_PROFILE,
  year_sihua_palaces:{"化祿":"官祿","化權":"財帛","化科":"遷移","化忌":"疾厄"},
  current_dahan:"疾厄", dahan_stars:[],
};
const PROFILE_A_ASTRO: AstroProfile = {
  ...SAMPLE_ASTRO_PROFILE,
  planet_houses:{...SAMPLE_ASTRO_PROFILE.planet_houses,"Saturn":6},
};

const PROFILE_B_SAJU: SajuEngineProfile = {
  day_stem:"甲", month_stem:"己", hour_branch:"子", day_branch:"寅",
  month_branch:"未", year_branch:"戌", special_stars:[],
  dayun_stem:"甲", dayun_branch:"寅",
};
const PROFILE_B_ZIWEI: ZiweiProfile = {
  ...SAMPLE_ZIWEI_PROFILE,
  year_sihua_palaces:{"化祿":"官祿","化權":"財帛","化科":"遷移","化忌":"兄弟"},
  current_dahan:"官祿", dahan_stars:[],
};
const PROFILE_B_ASTRO: AstroProfile = {
  ...SAMPLE_ASTRO_PROFILE,
  planet_houses:{...SAMPLE_ASTRO_PROFILE.planet_houses,"Saturn":12},
};

const PROFILE_C_SAJU: SajuEngineProfile = {
  day_stem:"丙", month_stem:"甲", hour_branch:"亥", day_branch:"寅",
  month_branch:"午", year_branch:"戌", special_stars:["천덕귀인"],
  dayun_stem:"甲", dayun_branch:"寅",
};
const PROFILE_C_ZIWEI: ZiweiProfile = {
  ...SAMPLE_ZIWEI_PROFILE,
  year_sihua_palaces:{"化祿":"命宮","化權":"財帛","化科":"官祿","化忌":"兄弟"},
  current_dahan:"財帛", dahan_stars:["天府"],
};
const PROFILE_C_ASTRO: AstroProfile = {
  ...SAMPLE_ASTRO_PROFILE,
  planet_houses:{...SAMPLE_ASTRO_PROFILE.planet_houses,"Saturn":10},
};

// ── Helpers ───────────────────────────────────────────────────────────────────
type Cat = "wealth"|"love"|"health"|"career"|"relations"|"study";
const CATS: Cat[] = ["wealth","love","health","career","relations","study"];
const MAX_DELTA = 3;
const BASE = 60;
const COMP = 0.75;
const DW = {
  wealth:{saju:0.50,ziwei:0.35,astro:0.15}, love:{saju:0.40,ziwei:0.35,astro:0.25},
  health:{saju:0.55,ziwei:0.25,astro:0.20}, career:{saju:0.50,ziwei:0.30,astro:0.20},
  relations:{saju:0.45,ziwei:0.30,astro:0.25}, study:{saju:0.45,ziwei:0.25,astro:0.30},
} as const;
const SENS: Record<string,number> = {love:1.25,relations:1.10,health:1.00,wealth:1.10,study:1.08,career:1.00};
const sf = (v:number) => v>85?85+(v-85)*0.5:v<15?15-(15-v)*0.5:v;

function stats(vals: number[]) {
  const avg = vals.reduce((a,b)=>a+b,0)/vals.length;
  const std = Math.sqrt(vals.reduce((s,v)=>s+(v-avg)**2,0)/vals.length);
  return { avg, std, min:Math.min(...vals), max:Math.max(...vals), range:Math.max(...vals)-Math.min(...vals) };
}
function pct(n:number, d:number) { return `${n}/${d} (${Math.round(n/d*100)}%)`; }

interface DayData {
  date: string;
  scores: Record<Cat,number>;
  overall: number;
  topCat: Cat;
  botCat: Cat;
  atomDeltas: Record<Cat,number>;
  atomSaturated: Record<Cat,boolean>;  // |delta| == MAX_DELTA
  rankOrder: Cat[];
}

function runProfile(
  name: string,
  saju: SajuEngineProfile,
  ziwei: ZiweiProfile,
  astro: AstroProfile,
): DayData[] {
  const birthDate = new Date(1998,0,22);
  const se = buildSajuEngineFromProfile(saju);
  const ze = buildZiweiEngineFromProfile(ziwei);
  const ae = buildAstroEngineFromProfile(astro);

  const days: DayData[] = [];
  for (let d=1; d<=31; d++) {
    const dt = new Date(2026,4,d);
    const sR = se.calculate(dt);
    const zR = ze.calculate(dt);
    const aR = ae.calculate(dt, birthDate);

    const stR = computeStateAtoms({
      ten_god_of_day: sR.factors.ten_god_of_day as string|undefined,
      active_stars: [],
      day_branch_relation_types:   (sR.factors.day_branch_relation_types   as string[])??[],
      month_branch_relation_types: (sR.factors.month_branch_relation_types as string[])??[],
      ohaeng_clash_stem:   (sR.factors.ohaeng_clash_stem   as boolean)??false,
      ohaeng_clash_branch: (sR.factors.ohaeng_clash_branch as boolean)??false,
      active_transit_aspects: (aR.factors.active_transit_aspects as string[])??[],
    });

    // pre-compression merge
    const pre: Record<Cat,number> = {} as Record<Cat,number>;
    for (const cat of CATS) {
      const w = DW[cat];
      const s = sR.scores[cat]??BASE, z = zR.scores[cat]??0, a = aR.scores[cat]??0;
      const zC = Math.max(-30,Math.min(30,z)), aC = Math.max(-25,Math.min(25,a));
      const sS=sf(Math.max(0,Math.min(100,s))), zS=sf(Math.max(0,Math.min(100,BASE+zC))), aS=sf(Math.max(0,Math.min(100,BASE+aC)));
      const del=(sS-BASE)*w.saju+(zS-BASE)*w.ziwei+(aS-BASE)*w.astro;
      pre[cat]=Math.max(0,Math.min(100,BASE+Math.max(-12,del)*(SENS[cat]??1.0)));
    }
    const cAvg = CATS.reduce((s,c)=>s+pre[c],0)/6;
    const comp: Record<Cat,number> = {} as Record<Cat,number>;
    for (const cat of CATS) comp[cat]=Math.max(0,Math.min(100,cAvg+(pre[cat]-cAvg)*COMP));

    const atomDeltas: Record<Cat,number> = {} as Record<Cat,number>;
    const atomSat: Record<Cat,boolean> = {} as Record<Cat,boolean>;
    const scores: Record<Cat,number> = {} as Record<Cat,number>;
    for (const cat of CATS) {
      const d2 = stR.categoryDeltas[cat]??0;
      atomDeltas[cat] = d2;
      atomSat[cat] = Math.abs(d2) >= MAX_DELTA;
      scores[cat] = Math.round(Math.max(0,Math.min(100,comp[cat]+d2)));
    }
    const overall = Math.round(CATS.reduce((s,c)=>s+scores[c],0)/6);
    const ranked = [...CATS].sort((a,b)=>scores[b]-scores[a]);
    days.push({
      date: `05/${String(d).padStart(2,"0")}`,
      scores, overall,
      topCat: ranked[0],
      botCat: ranked[ranked.length-1],
      atomDeltas, atomSaturated: atomSat,
      rankOrder: ranked,
    });
  }
  return days;
}

function analyze(name: string, days: DayData[]) {
  const N = days.length;

  console.log(`\n${"═".repeat(72)}`);
  console.log(`  PROFILE ${name}`);
  console.log("═".repeat(72));

  // ── [1] Overall ─────────────────────────────────────────────────────────────
  const ovStats = stats(days.map(d=>d.overall));
  console.log(`\n[1] OVERALL  avg=${ovStats.avg.toFixed(1)}  std=${ovStats.std.toFixed(1)}  min=${ovStats.min}  max=${ovStats.max}`);

  // ── [2] Category avg/std/range ──────────────────────────────────────────────
  console.log(`\n[2] CATEGORY AVG / STD / RANGE`);
  console.log("    Cat        Avg    Std    Min    Max  Range");
  const catStats: Record<Cat,ReturnType<typeof stats>> = {} as Record<Cat,ReturnType<typeof stats>>;
  for (const cat of CATS) {
    const s = stats(days.map(d=>d.scores[cat]));
    catStats[cat] = s;
    const flag = (s.avg < 48) ? " ◀LOW" : (s.avg > 68) ? " ◀HIGH" : "";
    console.log(`    ${cat.padEnd(10)} ${s.avg.toFixed(1).padStart(5)} ${s.std.toFixed(1).padStart(5)} ${s.min.toString().padStart(5)} ${s.max.toString().padStart(5)} ${s.range.toString().padStart(5)}${flag}`);
  }

  // ── [3] Top frequency ───────────────────────────────────────────────────────
  const topCount: Record<Cat,number> = {wealth:0,love:0,health:0,career:0,relations:0,study:0};
  const botCount: Record<Cat,number> = {wealth:0,love:0,health:0,career:0,relations:0,study:0};
  for (const d of days) { topCount[d.topCat]++; botCount[d.botCat]++; }

  console.log(`\n[3] TOP-RANK FREQUENCY`);
  for (const cat of CATS) {
    const topPct = Math.round(topCount[cat]/N*100);
    const bar = "█".repeat(Math.round(topPct/5));
    const flag = topPct >= 60 ? " ◀DOMINANT" : topPct >= 40 ? " ◀ELEVATED" : "";
    console.log(`    ${cat.padEnd(10)} ${pct(topCount[cat],N).padEnd(14)} ${bar}${flag}`);
  }

  // ── [4] Bottom frequency ────────────────────────────────────────────────────
  console.log(`\n[4] BOTTOM-RANK FREQUENCY`);
  for (const cat of CATS) {
    const botPct = Math.round(botCount[cat]/N*100);
    const bar = "░".repeat(Math.round(botPct/5));
    const flag = botPct >= 50 ? " ◀STRUCTURALLY SUPPRESSED" : botPct >= 35 ? " ◀OFTEN LAST" : "";
    console.log(`    ${cat.padEnd(10)} ${pct(botCount[cat],N).padEnd(14)} ${bar}${flag}`);
  }

  // ── [5] Health bottom ───────────────────────────────────────────────────────
  const hBot = botCount.health;
  const hStats = catStats.health;
  console.log(`\n[5] HEALTH BOTTOM  ${pct(hBot,N)}  avg=${hStats.avg.toFixed(1)}  std=${hStats.std.toFixed(1)}`);
  const hSeverity = hBot/N >= 0.60 ? "STRUCTURAL" : hBot/N >= 0.35 ? "ELEVATED" : "ACCEPTABLE";
  console.log(`    Severity: ${hSeverity}`);

  // ── [6] Relations bottom ────────────────────────────────────────────────────
  const rBot = botCount.relations;
  const rStats = catStats.relations;
  console.log(`\n[6] RELATIONS BOTTOM  ${pct(rBot,N)}  avg=${rStats.avg.toFixed(1)}  std=${rStats.std.toFixed(1)}`);
  const rSeverity = rBot/N >= 0.40 ? "STRUCTURAL (pre-fix regression)" : rBot/N >= 0.25 ? "ELEVATED" : "ACCEPTABLE";
  console.log(`    Severity: ${rSeverity}`);

  // ── [7] Study top ───────────────────────────────────────────────────────────
  const sTop = topCount.study;
  console.log(`\n[7] STUDY TOP  ${pct(sTop,N)}  avg=${catStats.study.avg.toFixed(1)}`);

  // ── [8] Career top ──────────────────────────────────────────────────────────
  const cTop = topCount.career;
  console.log(`\n[8] CAREER TOP  ${pct(cTop,N)}  avg=${catStats.career.avg.toFixed(1)}`);
  const cSeverity = cTop/N >= 0.65 ? "ELEVATED — possible structural bias" : cTop/N >= 0.45 ? "MODERATE" : "BALANCED";
  console.log(`    Assessment: ${cSeverity}`);

  // ── [9] Category identity ───────────────────────────────────────────────────
  console.log(`\n[9] CATEGORY IDENTITY`);
  const maxAvg = Math.max(...CATS.map(c=>catStats[c].avg));
  const minAvg = Math.min(...CATS.map(c=>catStats[c].avg));
  const spreadOfAvgs = maxAvg - minAvg;
  console.log(`    Spread of category avgs (max−min): ${spreadOfAvgs.toFixed(1)} pts`);
  console.log(`    Avg std dev across cats: ${(CATS.reduce((s,c)=>s+catStats[c].std,0)/6).toFixed(1)}`);
  // Kendall-like consistency: on how many days does each cat hold its rank?
  const rankStability: Record<Cat, number[]> = {wealth:[],love:[],health:[],career:[],relations:[],study:[]};
  for (const d of days) {
    for (const cat of CATS) {
      rankStability[cat].push(d.rankOrder.indexOf(cat)+1);
    }
  }
  for (const cat of CATS) {
    const ranks = rankStability[cat];
    const rankAvg = ranks.reduce((a,b)=>a+b,0)/ranks.length;
    const rankStd = Math.sqrt(ranks.reduce((s,r)=>s+(r-rankAvg)**2,0)/ranks.length);
    console.log(`    ${cat.padEnd(10)} avg_rank=${rankAvg.toFixed(1)}  rank_std=${rankStd.toFixed(1)}`);
  }

  // ── [10] State atom saturation ──────────────────────────────────────────────
  console.log(`\n[10] STATE ATOM SATURATION (days |delta|=MAX_DELTA=${MAX_DELTA})`);
  for (const cat of CATS) {
    const satDays = days.filter(d=>d.atomSaturated[cat]).length;
    const satPct = Math.round(satDays/N*100);
    const avgDelta = days.reduce((s,d)=>s+d.atomDeltas[cat],0)/N;
    const satFlag = satPct >= 70 ? " ◀FREQUENTLY CLAMPED" : satPct >= 50 ? " ◀OFTEN CLAMPED" : "";
    console.log(`    ${cat.padEnd(10)} saturated=${pct(satDays,N).padEnd(14)} avg_delta=${avgDelta.toFixed(2).padStart(6)}${satFlag}`);
  }
  // check if any cat is always at +3 or always at -3
  for (const cat of CATS) {
    const alwaysMax = days.every(d=>d.atomDeltas[cat]===MAX_DELTA);
    const alwaysMin = days.every(d=>d.atomDeltas[cat]===-MAX_DELTA);
    if (alwaysMax) console.log(`    ⚠ ${cat}: always at +${MAX_DELTA} — atom layer ineffective`);
    if (alwaysMin) console.log(`    ⚠ ${cat}: always at -${MAX_DELTA} — atom layer stuck negative`);
  }

  // ── [11] Extreme outlier check ───────────────────────────────────────────────
  console.log(`\n[11] EXTREME OUTLIER CHECK`);
  const CEIL = 82, FLOOR = 38;
  const highs: string[] = [], lows: string[] = [];
  for (const d of days) {
    for (const cat of CATS) {
      if (d.scores[cat] > CEIL) highs.push(`${d.date} ${cat}=${d.scores[cat]}`);
      if (d.scores[cat] < FLOOR) lows.push(`${d.date} ${cat}=${d.scores[cat]}`);
    }
    if (d.overall > 85) highs.push(`${d.date} OVERALL=${d.overall}`);
    if (d.overall < 42) lows.push(`${d.date} OVERALL=${d.overall}`);
  }
  if (highs.length) console.log(`    HIGH (>${CEIL}): ${highs.join(", ")}`);
  else              console.log(`    No highs >${CEIL} detected`);
  if (lows.length)  console.log(`    LOW  (<${FLOOR}): ${lows.join(", ")}`);
  else              console.log(`    No lows <${FLOOR} detected`);

  // ── [12] Structural suppression ──────────────────────────────────────────────
  console.log(`\n[12] STRUCTURAL SUPPRESSION CHECK`);
  for (const cat of CATS) {
    const s = catStats[cat];
    const alwaysBelow55 = days.every(d=>d.scores[cat]<55);
    const avgRank = days.reduce((sum,d)=>sum+d.rankOrder.indexOf(cat)+1,0)/N;
    const neverTop = topCount[cat] === 0;
    if (alwaysBelow55)   console.log(`    ⚠ ${cat}: ALL days below 55 — score floor suppression`);
    if (neverTop)        console.log(`    ⚠ ${cat}: never reaches rank 1 in 31 days`);
    if (avgRank > 5.5)   console.log(`    ⚠ ${cat}: avg rank ${avgRank.toFixed(1)} (structural last-place tendency)`);
    if (s.avg < 48)      console.log(`    ⚠ ${cat}: avg score ${s.avg.toFixed(1)} (below structural floor 48)`);
  }
  const suppressedCats = CATS.filter(c=> catStats[c].avg < 48 || days.every(d=>d.scores[c]<55) || topCount[c]===0 && days.reduce((s,d)=>s+d.rankOrder.indexOf(c)+1,0)/N>5);
  if (suppressedCats.length === 0) console.log("    No structural suppression detected");

  // ── [13] Unrealistic dominance ───────────────────────────────────────────────
  console.log(`\n[13] UNREALISTIC DOMINANCE CHECK`);
  for (const cat of CATS) {
    const topPct = topCount[cat]/N;
    if (topPct >= 0.65) {
      // check if it's multi-source or single-source
      const source = cat === "career" ? "career → check 官祿大限 + TG structural bias"
                   : cat === "health" ? "health → check 食神 TG"
                   : cat === "relations" ? "relations → check 六合/三合 dominance"
                   : "general";
      console.log(`    ⚠ ${cat}: top ${Math.round(topPct*100)}% — investigate (${source})`);
    }
  }
  const dominantCats = CATS.filter(c=>topCount[c]/N>=0.65);
  if (dominantCats.length === 0) console.log("    No category dominates unrealistically (≥65%)");

  // ── [14] Movement balance ────────────────────────────────────────────────────
  console.log(`\n[14] MOVEMENT BALANCE`);
  const stds = CATS.map(c=>catStats[c].std);
  const stdRange = Math.max(...stds) - Math.min(...stds);
  const ranges = CATS.map(c=>catStats[c].range);
  const rangeMax = Math.max(...ranges), rangeMin = Math.min(...ranges);
  console.log(`    Std dev range across cats: ${Math.min(...stds).toFixed(1)} – ${Math.max(...stds).toFixed(1)} (spread ${stdRange.toFixed(1)})`);
  console.log(`    Score range across cats:   ${rangeMin} – ${rangeMax}`);
  // check any cat with std < 4 (near-static = not moving meaningfully)
  for (const cat of CATS) {
    if (catStats[cat].std < 4) console.log(`    ⚠ ${cat}: std=${catStats[cat].std.toFixed(1)} — near-static, low daily movement`);
  }
  // daily spread: how different are the 6 cats on a given day?
  const dailySpreads = days.map(d => {
    const vals = CATS.map(c=>d.scores[c]);
    return Math.max(...vals) - Math.min(...vals);
  });
  const spreadStats = stats(dailySpreads);
  console.log(`    Daily spread (max−min per day): avg=${spreadStats.avg.toFixed(1)}  std=${spreadStats.std.toFixed(1)}  min=${spreadStats.min}  max=${spreadStats.max}`);
  const tooFlat = dailySpreads.filter(s=>s<6).length;
  console.log(`    Days with spread < 6 pts: ${tooFlat}/${N} (near-identical cat scores)`);
}

// ── Cross-profile summary ─────────────────────────────────────────────────────
function crossProfileSummary(
  profileData: {name:string; days:DayData[]}[]
) {
  console.log(`\n${"═".repeat(72)}`);
  console.log("  CROSS-PROFILE SUMMARY");
  console.log("═".repeat(72));

  // Category avg heat map
  console.log("\n[CROSS] Category avg across all profiles:");
  console.log("  Cat        A-avg   B-avg   C-avg   global  spread");
  for (const cat of CATS) {
    const avgs = profileData.map(p=>stats(p.days.map(d=>d.scores[cat])).avg);
    const globalAvg = avgs.reduce((a,b)=>a+b,0)/avgs.length;
    const spread = Math.max(...avgs)-Math.min(...avgs);
    const flag = spread > 12 ? " ◀high profile variance" : "";
    console.log(`  ${cat.padEnd(10)} ${avgs.map(a=>a.toFixed(1).padStart(6)).join("  ")}  ${globalAvg.toFixed(1).padStart(6)}  ${spread.toFixed(1).padStart(6)}${flag}`);
  }

  // Rank share summary
  console.log("\n[CROSS] Top-rank share (%):");
  console.log("  Cat        A-top%  B-top%  C-top%");
  for (const cat of CATS) {
    const tops = profileData.map(p => {
      const n = p.days.filter(d=>d.topCat===cat).length;
      return Math.round(n/p.days.length*100);
    });
    const flag = tops.some(t=>t>=65) ? " ◀DOMINANT in ≥1 profile" : "";
    console.log(`  ${cat.padEnd(10)} ${tops.map(t=>String(t).padStart(6)).join("  ")}${flag}`);
  }

  // Bottom-rank share summary
  console.log("\n[CROSS] Bottom-rank share (%):");
  console.log("  Cat        A-bot%  B-bot%  C-bot%");
  for (const cat of CATS) {
    const bots = profileData.map(p => {
      const n = p.days.filter(d=>d.botCat===cat).length;
      return Math.round(n/p.days.length*100);
    });
    const flag = bots.some(b=>b>=50) ? " ◀STRUCTURALLY LAST in ≥1 profile" : "";
    console.log(`  ${cat.padEnd(10)} ${bots.map(b=>String(b).padStart(6)).join("  ")}${flag}`);
  }
}

// ── Risk assessment ───────────────────────────────────────────────────────────
function riskAssessment(profileData: {name:string; days:DayData[]}[]) {
  console.log(`\n${"═".repeat(72)}`);
  console.log("  [15] FINAL RISK ASSESSMENT");
  console.log("═".repeat(72));

  const risks: {level:"HIGH"|"MEDIUM"|"LOW"; item:string; detail:string}[] = [];

  for (const {name, days} of profileData) {
    const N = days.length;
    const topCount: Record<Cat,number> = {wealth:0,love:0,health:0,career:0,relations:0,study:0};
    const botCount: Record<Cat,number> = {wealth:0,love:0,health:0,career:0,relations:0,study:0};
    for (const d of days) { topCount[d.topCat]++; botCount[d.botCat]++; }

    for (const cat of CATS) {
      const topPct = topCount[cat]/N;
      const botPct = botCount[cat]/N;
      const avgScore = stats(days.map(d=>d.scores[cat])).avg;
      if (topPct >= 0.75) risks.push({level:"HIGH",   item:`${name}: ${cat} top ${Math.round(topPct*100)}%`, detail:"Single category dominates most days — structural bias"});
      else if (topPct >= 0.60) risks.push({level:"MEDIUM", item:`${name}: ${cat} top ${Math.round(topPct*100)}%`, detail:"Career-aligned profile; monitor for ossification"});
      if (botPct >= 0.70) risks.push({level:"HIGH",   item:`${name}: ${cat} bot ${Math.round(botPct*100)}%`, detail:"Structural suppression — category rarely escapes last"});
      else if (botPct >= 0.50) risks.push({level:"MEDIUM", item:`${name}: ${cat} bot ${Math.round(botPct*100)}%`, detail:"Category consistently low; check engine bias"});
      if (avgScore < 46) risks.push({level:"HIGH",   item:`${name}: ${cat} avg ${avgScore.toFixed(1)}`, detail:"Score floor below badge thresholds"});
    }

    // State atom saturation risk
    for (const cat of CATS) {
      const satPct = days.filter(d=>d.atomSaturated[cat]).length/N;
      if (satPct >= 0.75) risks.push({level:"MEDIUM", item:`${name}: ${cat} atom saturated ${Math.round(satPct*100)}%`, detail:"State atom layer clamped most days — range lost"});
    }

    // Outliers
    const hasExtremeHigh = days.some(d=>CATS.some(c=>d.scores[c]>85));
    const hasExtremeLow  = days.some(d=>CATS.some(c=>d.scores[c]<35));
    if (hasExtremeHigh) risks.push({level:"LOW", item:`${name}: cat score >85 detected`, detail:"Verify it's an exceptional aligned day, not a math overflow"});
    if (hasExtremeLow)  risks.push({level:"MEDIUM", item:`${name}: cat score <35 detected`, detail:"Check soft clamp / engine floor guards"});
  }

  if (risks.length === 0) {
    console.log("\n  No significant risks detected. System is stable for architecture finalization.");
  } else {
    const high   = risks.filter(r=>r.level==="HIGH");
    const medium = risks.filter(r=>r.level==="MEDIUM");
    const low    = risks.filter(r=>r.level==="LOW");
    if (high.length)   { console.log("\n  ◆ HIGH"); for (const r of high)   console.log(`    • ${r.item}\n      → ${r.detail}`); }
    if (medium.length) { console.log("\n  ◇ MEDIUM"); for (const r of medium) console.log(`    • ${r.item}\n      → ${r.detail}`); }
    if (low.length)    { console.log("\n  ○ LOW"); for (const r of low)     console.log(`    • ${r.item}\n      → ${r.detail}`); }
  }
}

// ── Final recommendation ───────────────────────────────────────────────────────
function finalRecommendation(profileData: {name:string; days:DayData[]}[]) {
  console.log(`\n${"═".repeat(72)}`);
  console.log("  [16] FINAL RECOMMENDATION");
  console.log("═".repeat(72));

  // Collect key metrics
  const metrics: Record<string, number> = {};
  for (const {name, days} of profileData) {
    const key = name.split(" ")[0];
    const N = days.length;
    const botCount: Record<Cat,number> = {wealth:0,love:0,health:0,career:0,relations:0,study:0};
    const topCount: Record<Cat,number> = {wealth:0,love:0,health:0,career:0,relations:0,study:0};
    for (const d of days) { botCount[d.botCat]++; topCount[d.topCat]++; }
    metrics[`${key}_health_bot`]  = botCount.health/N;
    metrics[`${key}_rel_bot`]     = botCount.relations/N;
    metrics[`${key}_career_top`]  = topCount.career/N;
    metrics[`${key}_daily_spread`] = stats(days.map(d=>Math.max(...CATS.map(c=>d.scores[c]))-Math.min(...CATS.map(c=>d.scores[c])))).avg;
  }

  const maxHealthBot  = Math.max(metrics["A_health_bot"],metrics["B_health_bot"],metrics["C_health_bot"]);
  const maxRelBot     = Math.max(metrics["A_rel_bot"],metrics["B_rel_bot"],metrics["C_rel_bot"]);
  const maxCareerTop  = Math.max(metrics["A_career_top"],metrics["B_career_top"],metrics["C_career_top"]);
  const avgSpread     = (metrics["A_daily_spread"]+metrics["B_daily_spread"]+metrics["C_daily_spread"])/3;

  const healthOk    = maxHealthBot < 0.65;
  const relOk       = maxRelBot    < 0.30;
  const careerOk    = maxCareerTop < 0.65;
  const spreadOk    = avgSpread    > 8;

  console.log(`\n  Balance gate results:`);
  console.log(`    Health bottom < 65%:   ${maxHealthBot < 0.65 ? "PASS" : "FAIL"} (worst: ${Math.round(maxHealthBot*100)}%)`);
  console.log(`    Relations bottom < 30%: ${maxRelBot < 0.30 ? "PASS" : "FAIL"} (worst: ${Math.round(maxRelBot*100)}%)`);
  console.log(`    Career top < 65%:      ${maxCareerTop < 0.65 ? "PASS" : "FAIL"} (worst: ${Math.round(maxCareerTop*100)}%)`);
  console.log(`    Avg daily spread > 8:  ${avgSpread > 8 ? "PASS" : "FAIL"} (avg: ${avgSpread.toFixed(1)} pts)`);

  const passCount = [healthOk, relOk, careerOk, spreadOk].filter(Boolean).length;

  console.log(`\n  Gates passed: ${passCount}/4`);
  if (passCount === 4) {
    console.log("\n  ✔ ARCHITECTURE STABLE — ready for persisted model migration.");
    console.log("    All structural biases are within acceptable bounds.");
    console.log("    Category identity, daily spread, and rank distribution are balanced.");
  } else if (passCount >= 3) {
    console.log("\n  ◑ CONDITIONALLY STABLE — proceed with noted caveats:");
    if (!healthOk)   console.log("    • Health bottom remains elevated — 2026 astro constant and TG table bias not yet addressed");
    if (!relOk)      console.log("    • Relations bottom elevated — check for regression in month-branch scaling");
    if (!careerOk)   console.log("    • Career top elevated — 官祿 dahan fix reduced but did not eliminate dominance; may need PALACE_WEIGHT adjustment");
    if (!spreadOk)   console.log("    • Daily spread too narrow — consider looser compression or increased sensitivity");
    console.log("\n    Persisted model migration can proceed, with remaining items as known issues to track post-launch.");
  } else {
    console.log("\n  ✗ NOT STABLE — do not finalize architecture until remaining gates pass.");
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log("╔══════════════════════════════════════════════════════════════════════╗");
console.log("║         FINAL INTEGRATED VALIDATION — Scoring System v1.0           ║");
console.log("║  Compression 0.75 | Health sens 1.00 | 官祿 +3 | StateAtom MAX=3    ║");
console.log("╚══════════════════════════════════════════════════════════════════════╝");

const profileData = [
  { name:"A (Stress)",   days: runProfile("A", PROFILE_A_SAJU, PROFILE_A_ZIWEI, PROFILE_A_ASTRO) },
  { name:"B (Neutral)",  days: runProfile("B", PROFILE_B_SAJU, PROFILE_B_ZIWEI, PROFILE_B_ASTRO) },
  { name:"C (Positive)", days: runProfile("C", PROFILE_C_SAJU, PROFILE_C_ZIWEI, PROFILE_C_ASTRO) },
];

for (const p of profileData) analyze(p.name, p.days);
crossProfileSummary(profileData);
riskAssessment(profileData);
finalRecommendation(profileData);

console.log(`\n${"═".repeat(72)}`);
console.log("  END OF VALIDATION REPORT");
console.log("═".repeat(72)+"\n");
