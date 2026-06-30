/**
 * Persistent vs Acute Signal Investigation
 * birth-month TG, calendar-month TG, dahan, astro-constant vs day TG / branch / transit
 */
import { buildSajuEngineFromProfile, type SajuEngineProfile, STEM_ELEMENT, HEAVENLY_STEMS, EARTHLY_BRANCHES } from "./src/engines/sajuEngine.js";
import { buildZiweiEngineFromProfile, type ZiweiProfile, SAMPLE_ZIWEI_PROFILE } from "./src/engines/ziweiEngine.js";
import { buildAstroEngineFromProfile, type AstroProfile, SAMPLE_ASTRO_PROFILE } from "./src/engines/astroEngine.js";

// ── profiles ──────────────────────────────────────────────────────────────────
const PROFILE_A_SAJU: SajuEngineProfile = { day_stem:"甲", month_stem:"庚", hour_branch:"戌", day_branch:"子", month_branch:"午", year_branch:"卯", special_stars:["백호살"], dayun_stem:"壬", dayun_branch:"午" };
const PROFILE_B_SAJU: SajuEngineProfile = { day_stem:"甲", month_stem:"己", hour_branch:"子", day_branch:"寅", month_branch:"未", year_branch:"戌", special_stars:[], dayun_stem:"甲", dayun_branch:"寅" };
const PROFILE_C_SAJU: SajuEngineProfile = { day_stem:"丙", month_stem:"甲", hour_branch:"亥", day_branch:"寅", month_branch:"午", year_branch:"戌", special_stars:["천덕귀인"], dayun_stem:"甲", dayun_branch:"寅" };

const ZA: ZiweiProfile = { ...SAMPLE_ZIWEI_PROFILE, year_sihua_palaces:{"化祿":"官祿","化權":"財帛","化科":"遷移","化忌":"疾厄"}, current_dahan:"疾厄", dahan_stars:[] };
const ZB: ZiweiProfile = { ...SAMPLE_ZIWEI_PROFILE, year_sihua_palaces:{"化祿":"官祿","化權":"財帛","化科":"遷移","化忌":"兄弟"}, current_dahan:"官祿", dahan_stars:[] };
const ZC: ZiweiProfile = { ...SAMPLE_ZIWEI_PROFILE, year_sihua_palaces:{"化祿":"命宮","化權":"財帛","化科":"官祿","化忌":"兄弟"}, current_dahan:"財帛", dahan_stars:["天府"] };

const AA: AstroProfile = { ...SAMPLE_ASTRO_PROFILE, planet_houses:{...SAMPLE_ASTRO_PROFILE.planet_houses, Saturn:6} };
const AB: AstroProfile = { ...SAMPLE_ASTRO_PROFILE, planet_houses:{...SAMPLE_ASTRO_PROFILE.planet_houses, Saturn:12} };
const AC: AstroProfile = { ...SAMPLE_ASTRO_PROFILE, planet_houses:{...SAMPLE_ASTRO_PROFILE.planet_houses, Saturn:10} };

type Cat = "wealth"|"love"|"health"|"career"|"relations"|"study";
const CATS: Cat[] = ["wealth","love","health","career","relations","study"];
const BASE = 60;
const DW: Record<Cat,{saju:number;ziwei:number;astro:number}> = {
  wealth:{saju:0.50,ziwei:0.35,astro:0.15}, love:{saju:0.40,ziwei:0.35,astro:0.25},
  health:{saju:0.55,ziwei:0.25,astro:0.20}, career:{saju:0.50,ziwei:0.30,astro:0.20},
  relations:{saju:0.45,ziwei:0.30,astro:0.25}, study:{saju:0.45,ziwei:0.25,astro:0.30},
};
const sf = (v:number) => v>85?85+(v-85)*0.5:v<15?15-(15-v)*0.5:v;

function mn(arr: number[]) { return arr.reduce((a,b)=>a+b,0)/arr.length; }
function f1(v:number) { return (v>=0?"+":"")+v.toFixed(1); }
function f2(v:number) { return (v>=0?"+":"")+v.toFixed(2); }

// ── TG lookup mirrors sajuEngine ─────────────────────────────────────────────
const TGI: Record<string,Record<Cat,number>> = {
  "比肩":{wealth:0,love:0,health:2,career:0,relations:0,study:0},
  "劫財":{wealth:-8,love:-4,health:0,career:-3,relations:-5,study:-2},
  "食神":{wealth:10,love:5,health:10,career:6,relations:11,study:8},
  "傷官":{wealth:-3,love:-4,health:0,career:3,relations:-1,study:6},
  "偏財":{wealth:8,love:3,health:2,career:6,relations:5,study:3},
  "正財":{wealth:12,love:3,health:4,career:8,relations:5,study:3},
  "偏官":{wealth:-5,love:-5,health:-8,career:-5,relations:-7,study:-3},
  "正官":{wealth:5,love:2,health:4,career:10,relations:6,study:3},
  "偏印":{wealth:0,love:6,health:3,career:5,relations:6,study:2},
  "正印":{wealth:5,love:3,health:7,career:10,relations:5,study:4},
};
const TGM: Record<string,string> = {
  "木_木_true":"比肩","木_木_false":"劫財","木_火_true":"食神","木_火_false":"傷官","木_土_true":"偏財","木_土_false":"正財","木_金_true":"偏官","木_金_false":"正官","木_水_true":"偏印","木_水_false":"正印",
  "火_火_true":"比肩","火_火_false":"劫財","火_土_true":"食神","火_土_false":"傷官","火_金_true":"偏財","火_金_false":"正財","火_水_true":"偏官","火_水_false":"正官","火_木_true":"偏印","火_木_false":"正印",
  "土_土_true":"比肩","土_土_false":"劫財","土_金_true":"食神","土_金_false":"傷官","土_水_true":"偏財","土_水_false":"正財","土_木_true":"偏官","土_木_false":"正官","土_火_true":"偏印","土_火_false":"正印",
  "金_金_true":"比肩","金_金_false":"劫財","金_水_true":"食神","金_水_false":"傷官","金_木_true":"偏財","金_木_false":"正財","金_火_true":"偏官","金_火_false":"正官","金_土_true":"偏印","金_土_false":"正印",
  "水_水_true":"比肩","水_水_false":"劫財","水_木_true":"食神","水_木_false":"傷官","水_火_true":"偏財","水_火_false":"正財","水_土_true":"偏官","水_土_false":"正官","水_金_true":"偏印","水_金_false":"正印",
};
const SE: Record<string,string> = {"甲":"木","乙":"木","丙":"火","丁":"火","戊":"土","己":"土","庚":"金","辛":"金","壬":"水","癸":"水"};
const BE: Record<string,string> = {"子":"水","丑":"土","寅":"木","卯":"木","辰":"土","巳":"火","午":"火","未":"土","申":"金","酉":"金","戌":"土","亥":"水"};

function getTG(dayElement: string, isYang: boolean, stem: string): string|undefined {
  const el = SE[stem] ?? stem;
  const stemIdx = HEAVENLY_STEMS.indexOf(stem);
  const sameYang = stemIdx>=0 ? (stemIdx%2===0)===isYang : isYang;
  return TGM[`${dayElement}_${el}_${sameYang}`];
}
function tgContrib(tg: string|undefined, w: number, cat: Cat): number {
  if (!tg||!TGI[tg]) return 0;
  return TGI[tg][cat] * w;
}

// ── decompose saju into persistent layers ────────────────────────────────────
function decomposeSaju(prof: SajuEngineProfile) {
  const dayEl  = SE[prof.day_stem];
  const isYang = HEAVENLY_STEMS.indexOf(prof.day_stem) % 2 === 0;

  // Persistent fixed each day (weighted contributions in saju-score space)
  const birthMonthTG    = getTG(dayEl, isYang, prof.month_stem);
  const dahanStemTG     = getTG(dayEl, isYang, prof.dayun_stem);
  const dahanBranchTG   = getTG(dayEl, isYang, BE[prof.dayun_branch] ?? prof.dayun_branch);
  // Note: dahanBranchTG uses element, not stem — check engine logic
  // Engine: const branchElem = BRANCH_ELEMENT[this.dayun_branch]; getTenGod(branchElem) uses is_yang only
  const dahanBranchTG2 = (() => {
    const el = BE[prof.dayun_branch];
    if (!el) return undefined;
    const key = `${dayEl}_${el}_${isYang}`;
    return TGM[key];
  })();

  const persist: Record<Cat,number> = {} as Record<Cat,number>;
  for (const cat of CATS) {
    persist[cat] =
      tgContrib(birthMonthTG,   0.53, cat) +  // birth month — every day
      tgContrib(dahanStemTG,    0.40, cat) +  // dahan stem — every day
      tgContrib(dahanBranchTG2, 0.27, cat);   // dahan branch — every day
  }
  return {
    birthMonthTG, dahanStemTG, dahanBranchTG: dahanBranchTG2,
    persistSaju: persist,
  };
}

// ── collect 31-day data ────────────────────────────────────────────────────────
function collect(saju: SajuEngineProfile, ziwei: ZiweiProfile, astro: AstroProfile) {
  const se = buildSajuEngineFromProfile(saju);
  const ze = buildZiweiEngineFromProfile(ziwei);
  const ae = buildAstroEngineFromProfile(astro);
  const birth = new Date(1998,0,22);
  const dayEl  = SE[saju.day_stem];
  const isYang = HEAVENLY_STEMS.indexOf(saju.day_stem) % 2 === 0;

  const rows = [];
  for (let d=1; d<=31; d++) {
    const dt  = new Date(2026,4,d);
    const sr  = se.calculate(dt);
    const zr  = ze.calculate(dt);
    const ar  = ae.calculate(dt, birth);

    // Saju full score → merged delta contribution
    const sajuFull: Record<Cat,number> = {} as Record<Cat,number>;
    for (const cat of CATS) {
      const s = sr.scores[cat] ?? BASE;
      const w = DW[cat].saju;
      sajuFull[cat] = (sf(Math.max(0,Math.min(100,s))) - BASE) * w;
    }

    // Ziwei merged delta
    const ziweiMerged: Record<Cat,number> = {} as Record<Cat,number>;
    for (const cat of CATS) {
      const z = zr.scores[cat] ?? 0;
      const zC = Math.max(-30,Math.min(30,z));
      ziweiMerged[cat] = (sf(Math.max(0,Math.min(100,BASE+zC))) - BASE) * DW[cat].ziwei;
    }

    // Astro merged delta
    const astroMerged: Record<Cat,number> = {} as Record<Cat,number>;
    for (const cat of CATS) {
      const a = ar.scores[cat] ?? 0;
      const aC = Math.max(-25,Math.min(25,a));
      astroMerged[cat] = (sf(Math.max(0,Math.min(100,BASE+aC))) - BASE) * DW[cat].astro;
    }

    // Persistent saju (birth month TG + dahan) contribution in merged space
    const dec = decomposeSaju(saju);
    const persInMerged: Record<Cat,number> = {} as Record<Cat,number>;
    for (const cat of CATS) {
      persInMerged[cat] = dec.persistSaju[cat] * DW[cat].saju;
    }

    // Calendar month TG (current) × 0.47
    const calMonthTG = sr.factors.ten_god_of_target_month as string|undefined;
    const calMonthPersist: Record<Cat,number> = {} as Record<Cat,number>;
    for (const cat of CATS) {
      calMonthPersist[cat] = tgContrib(calMonthTG, 0.47, cat) * DW[cat].saju;
    }

    // Day TG (acute) × 0.33
    const dayTG = sr.factors.ten_god_of_day as string|undefined;
    const dayTGContrib: Record<Cat,number> = {} as Record<Cat,number>;
    for (const cat of CATS) {
      dayTGContrib[cat] = tgContrib(dayTG, 0.33, cat) * DW[cat].saju;
    }

    // 2026 astro constants (persistent, in merged space)
    const astroConst: Record<Cat,number> = {} as Record<Cat,number>;
    for (const cat of CATS) {
      const raw = cat==="health" ? -6 : cat==="career" ? -3 : 0;
      // approximate: these are direct subtractions from astro scores
      // contribution through merge = raw * DW[cat].astro (rough approximation)
      astroConst[cat] = raw * DW[cat].astro;
    }

    rows.push({
      date: `05/${String(d).padStart(2,"0")}`,
      sajuFull, ziweiMerged, astroMerged,
      persInMerged, calMonthPersist, dayTGContrib,
      astroConst,
      dayTG, calMonthTG,
      ziweiRaw: zr.scores,
    });
  }
  return { rows, dec: decomposeSaju(saju) };
}

// ── analyze ────────────────────────────────────────────────────────────────────
function analyze(label: string, saju: SajuEngineProfile, ziwei: ZiweiProfile, astro: AstroProfile) {
  const { rows, dec } = collect(saju, ziwei, astro);
  const N = rows.length;

  console.log(`\n${"═".repeat(68)}`);
  console.log(`  PROFILE ${label}`);
  console.log("═".repeat(68));

  // Persistent breakdown (fixed for the whole 31 days)
  console.log(`\n  [PERSISTENT — same every day]`);
  console.log(`  Source                  health   career   (merged-space contribution/day)`);

  // Birth month TG
  const bmH = rows[0].persInMerged.health;  // constant
  const bmC = rows[0].persInMerged.career;
  // Note: persInMerged excludes calMonthTG; it's birthMonth+dahan only
  console.log(`  Birth-month TG (${(dec.birthMonthTG??"?").padEnd(4)}) ×0.53  ${f2(bmH).padStart(8)}  ${f2(bmC).padStart(8)}`);

  // Dahan stem TG
  const dsh = tgContrib(dec.dahanStemTG, 0.40, "health") * DW.health.saju;
  const dsc = tgContrib(dec.dahanStemTG, 0.40, "career") * DW.career.saju;
  console.log(`  Dahan stem TG (${(dec.dahanStemTG??"?").padEnd(4)}) ×0.40   ${f2(dsh).padStart(8)}  ${f2(dsc).padStart(8)}`);

  // Dahan branch TG
  const dbh = tgContrib(dec.dahanBranchTG, 0.27, "health") * DW.health.saju;
  const dbc = tgContrib(dec.dahanBranchTG, 0.27, "career") * DW.career.saju;
  console.log(`  Dahan branch TG (${(dec.dahanBranchTG??"?").padEnd(4)}) ×0.27  ${f2(dbh).padStart(8)}  ${f2(dbc).padStart(8)}`);

  // Ziwei dahan (persistent daily)
  const zwH = mn(rows.map(r=>r.ziweiMerged.health));
  const zwC = mn(rows.map(r=>r.ziweiMerged.career));
  console.log(`  Ziwei (dahan+passive) avg          ${f2(zwH).padStart(8)}  ${f2(zwC).padStart(8)}`);

  // Astro 2026 constants
  console.log(`  Astro 2026 constant (토성 트랜짓)   ${f2(rows[0].astroConst.health).padStart(8)}  ${f2(rows[0].astroConst.career).padStart(8)}`);

  // Calendar month TG (same for most of May — count distinct TGs)
  const calTgFreq: Record<string,number> = {};
  for (const r of rows) calTgFreq[r.calMonthTG??"없음"] = (calTgFreq[r.calMonthTG??"없음"]??0)+1;
  const calMonthAvgH = mn(rows.map(r=>r.calMonthPersist.health));
  const calMonthAvgC = mn(rows.map(r=>r.calMonthPersist.career));
  const calTgStr = Object.entries(calTgFreq).map(([k,v])=>`${k}(${v}일)`).join(", ");
  console.log(`  Calendar-month TG avg ×0.47 [${calTgStr}]`);
  console.log(`    → health: ${f2(calMonthAvgH)}  career: ${f2(calMonthAvgC)}`);

  // Total persistent
  const totalPersH = bmH + dsh + dbh + zwH + rows[0].astroConst.health + calMonthAvgH;
  const totalPersC = bmC + dsc + dbc + zwC + rows[0].astroConst.career  + calMonthAvgC;
  console.log(`  ─────────────────────────────────────────────────────────────`);
  console.log(`  TOTAL PERSISTENT (avg/day)         ${f2(totalPersH).padStart(8)}  ${f2(totalPersC).padStart(8)}`);

  // Acute (day TG + branch + transit aspects — residual)
  const acuteH = mn(rows.map(r=>r.sajuFull.health)) - (bmH+dsh+dbh) - calMonthAvgH;
  const acuteC = mn(rows.map(r=>r.sajuFull.career)) - (bmC+dsc+dbc) - calMonthAvgC;
  const acuteAstroH = mn(rows.map(r=>r.astroMerged.health)) - rows[0].astroConst.health;
  const acuteAstroC = mn(rows.map(r=>r.astroMerged.career)) - rows[0].astroConst.career;
  const totalAcuteH = acuteH + acuteAstroH;
  const totalAcuteC = acuteC + acuteAstroC;
  console.log(`\n  [ACUTE — daily rotating]`);
  console.log(`  Day TG (×0.33, rotates daily) avg  ${f2(mn(rows.map(r=>r.dayTGContrib.health))).padStart(8)}  ${f2(mn(rows.map(r=>r.dayTGContrib.career))).padStart(8)}`);
  console.log(`  Branch+clash+ohaeng residual avg   ${f2(acuteH - mn(rows.map(r=>r.dayTGContrib.health))).padStart(8)}  ${f2(acuteC - mn(rows.map(r=>r.dayTGContrib.career))).padStart(8)}`);
  console.log(`  Astro transit (daily) avg          ${f2(acuteAstroH).padStart(8)}  ${f2(acuteAstroC).padStart(8)}`);
  console.log(`  ─────────────────────────────────────────────────────────────`);
  console.log(`  TOTAL ACUTE (avg/day)              ${f2(totalAcuteH).padStart(8)}  ${f2(totalAcuteC).padStart(8)}`);

  // Ratio
  const totalAbsH = Math.abs(totalPersH) + Math.abs(totalAcuteH);
  const totalAbsC = Math.abs(totalPersC) + Math.abs(totalAcuteC);
  const persRatioH = totalAbsH > 0 ? Math.abs(totalPersH)/totalAbsH : 0;
  const persRatioC = totalAbsC > 0 ? Math.abs(totalPersC)/totalAbsC : 0;
  console.log(`\n  Persistent share  health:${Math.round(persRatioH*100)}%  career:${Math.round(persRatioC*100)}%`);
  console.log(`  Persistent/acute  health: ${f1(totalPersH)}/${f1(totalAcuteH)}  career: ${f1(totalPersC)}/${f1(totalAcuteC)}`);

  // Day TG distribution
  const tgFreq: Record<string,number> = {};
  for (const r of rows) tgFreq[r.dayTG??"없음"] = (tgFreq[r.dayTG??"없음"]??0)+1;
  const topTg = Object.entries(tgFreq).sort((a,b)=>b[1]-a[1]).slice(0,5);
  console.log(`\n  Day TG distribution (top 5):  ${topTg.map(([k,v])=>`${k}:${v}일`).join("  ")}`);

  // 偏官 month TG specific
  if (dec.birthMonthTG === "偏官") {
    const bh = TGI["偏官"].health * 0.53 * DW.health.saju;
    const bc = TGI["偏官"].career * 0.53 * DW.career.saju;
    console.log(`\n  ⚠ 偏官 月TG 고정 발동: health ${f2(bh)}/day  career ${f2(bc)}/day`);
    console.log(`     30일 누적: health ${f1(bh*31)}  career ${f1(bc*31)}`);
    console.log(`     다른 TG가 이를 상쇄하려면 매일 health ${f2(-bh)} 이상 필요`);
  }

  // 官祿大限 specific
  const dahanName = ziwei.current_dahan;
  const zwDahanC = mn(rows.map(r=>r.ziweiMerged.career));
  if (dahanName === "官祿") {
    console.log(`\n  ⚠ 官祿大限: ziwei career avg ${f2(zwDahanC)}/day (direct +3 포함)`);
    console.log(`     30일 누적: career ${f1(zwDahanC*31)}`);
  }
  if (dahanName === "疾厄") {
    const zwDahanH = mn(rows.map(r=>r.ziweiMerged.health));
    console.log(`\n  ⚠ 疾厄大限: ziwei health avg ${f2(zwDahanH)}/day (direct -5 포함)`);
    console.log(`     30일 누적: health ${f1(zwDahanH*31)}`);
  }
}

// ── main ──────────────────────────────────────────────────────────────────────
console.log("╔══════════════════════════════════════════════════════════════════════╗");
console.log("║      PERSISTENT vs ACUTE SIGNAL INVESTIGATION                      ║");
console.log("╚══════════════════════════════════════════════════════════════════════╝");

analyze("A (Stress)",   PROFILE_A_SAJU, ZA, AA);
analyze("B (Neutral)",  PROFILE_B_SAJU, ZB, AB);
analyze("C (Positive)", PROFILE_C_SAJU, ZC, AC);

// ── cross-profile summary ─────────────────────────────────────────────────────
console.log(`\n${"═".repeat(68)}`);
console.log("  CROSS-PROFILE: persistent 신호 구조 요약");
console.log("═".repeat(68));

const profiles: Array<[string, SajuEngineProfile, ZiweiProfile, AstroProfile]> = [
  ["A", PROFILE_A_SAJU, ZA, AA],
  ["B", PROFILE_B_SAJU, ZB, AB],
  ["C", PROFILE_C_SAJU, ZC, AC],
];
console.log("\n  Birth-month TG 비교:");
for (const [lbl, sp] of profiles) {
  const dayEl  = SE[sp.day_stem];
  const isYang = HEAVENLY_STEMS.indexOf(sp.day_stem) % 2 === 0;
  const tg = (() => {
    const el = SE[sp.month_stem];
    const si = HEAVENLY_STEMS.indexOf(sp.month_stem);
    const sy = si>=0 ? (si%2===0)===isYang : isYang;
    return TGM[`${dayEl}_${el}_${sy}`];
  })();
  const h = tg ? TGI[tg].health * 0.53 * DW.health.saju : 0;
  const c = tg ? TGI[tg].career * 0.53 * DW.career.saju : 0;
  console.log(`    Profile ${lbl}: month_stem ${sp.month_stem} → ${(tg??"?").padEnd(4)}  health ${f2(h)}/day  career ${f2(c)}/day  (×31: h${f1(h*31)} c${f1(c*31)})`);
}

console.log("\n  Dahan 비교 (stem+branch 합산):");
for (const [lbl, sp, zp] of profiles) {
  const dayEl  = SE[sp.day_stem];
  const isYang = HEAVENLY_STEMS.indexOf(sp.day_stem) % 2 === 0;
  const ds = (() => { const si=HEAVENLY_STEMS.indexOf(sp.dayun_stem); const el=SE[sp.dayun_stem]; const sy=si>=0?(si%2===0)===isYang:isYang; return TGM[`${dayEl}_${el}_${sy}`]; })();
  const db = (() => { const el=BE[sp.dayun_branch]; if(!el)return undefined; return TGM[`${dayEl}_${el}_${isYang}`]; })();
  const h = (ds?TGI[ds].health*0.40*DW.health.saju:0) + (db?TGI[db].health*0.27*DW.health.saju:0);
  const c = (ds?TGI[ds].career*0.40*DW.career.saju:0) + (db?TGI[db].career*0.27*DW.career.saju:0);
  console.log(`    Profile ${lbl}: dahan ${sp.dayun_stem}${sp.dayun_branch} → stem:${ds??"?"} branch:${db??"?"}  h:${f2(h)}/day  c:${f2(c)}/day  ziweiDahan:${zp.current_dahan}`);
}

console.log(`
  ── 수정 후보 (persistent 신호 정규화) ──────────────────────────────

  현재 구조 핵심:
  - birth-month TG: 10년 이상 고정. 오행 구조에 따라 매일 동일 방향 delta 발생.
    (Profile A의 庚月 → 偏官 health -${Math.abs(TGI["偏官"].health * 0.53 * DW.health.saju).toFixed(2)}/day = 31일 내내 불변)
  - dahan TG: 대운(10년) 동안 고정. 대운 상태가 일진과 동일 가중치로 적용.
  - ziwei dahan direct bonus(+3 career): 매일 동일 기여, 변동 없음.

  background signal은 "일진처럼" 처리되고 있어
  매일 동일 방향의 delta를 생성 → category rank 고착.

  후보:

  ①  persistentScale  [위험 낮음]
      birth-month TG ×0.53 → ×0.35
      dahan stem TG  ×0.40 → ×0.28
      dahan branch TG ×0.27 → ×0.19
      효과: persistent 기여 ~35% 감소. acute 비중 증가.
      부작용: 대운 / 월간 신호가 전반적으로 약해짐 — 의미 있는 대운 변화 감소.

  ②  backgroundWeight (분리 weight 적용)  [위험 중간]
      현재: birth-month TG ×0.53 (acute day TG ×0.33과 거의 동급)
      제안: birth-month TG ×0.25, dahan ×0.20 (persistent을 background로 재정의)
      효과: acute signal 비중 대폭 증가, persistent lock 해소.
      부작용: 대운 영향력이 매우 약해짐 — 사주 해석 체계와 괴리.

  ③  monthly TG attenuation (calendar month TG 제거)  [위험 낮음]
      현재 calendar-month TG ×0.47이 birth-month TG ×0.53과 동시 적용
      → 같은 TG 중복 발동 가능성 (Profile A: 庚월 5/1~5/5 → 偏官 ×1.0 중복)
      제안: calendar-month TG를 제거하거나 ×0.20으로 축소
      효과: 월간 TG 중복 완화, health/career 고착 약화.
      부작용: 당월 사주 월간 영향 약화.

  ④  dahan direct bonus 범위 제한  [위험 낮음]
      현재: 官祿 career +3, 疾厄 health -5 등 매일 동일 직접 적용
      제안: monthly attenuation — 일 단위가 아닌 월 평균에만 반영
      또는: dahan direct bonus 크기 축소 (±3→±1, ±5→±3)
      효과: 官祿大限 career lock 약화, 疾厄大限 health lock 약화.
      부작용: 대운 효과 체감 약화.

  추천:
  ③ + ④ 조합이 가장 안전.
  calendar-month TG 축소(×0.20) + dahan direct bonus 반감으로
  persistent signal 총량을 ~40% 줄이면서
  birth-month TG ×0.53는 유지 → 월간 사주 특성은 보존.
`);
