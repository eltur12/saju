/**
 * Structural Baseline Investigation
 * 카테고리별 엔진 structural mean 분석 — 코드 수정 없음, 조사만
 */
import { buildSajuEngineFromProfile, type SajuEngineProfile, STEM_ELEMENT, HEAVENLY_STEMS, EARTHLY_BRANCHES } from "./src/engines/sajuEngine.js";
import { buildZiweiEngineFromProfile, type ZiweiProfile, SAMPLE_ZIWEI_PROFILE } from "./src/engines/ziweiEngine.js";
import { buildAstroEngineFromProfile, type AstroProfile, SAMPLE_ASTRO_PROFILE } from "./src/engines/astroEngine.js";

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
  planet_houses:{...SAMPLE_ASTRO_PROFILE.planet_houses, Saturn:6},
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
  planet_houses:{...SAMPLE_ASTRO_PROFILE.planet_houses, Saturn:12},
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
  planet_houses:{...SAMPLE_ASTRO_PROFILE.planet_houses, Saturn:10},
};

const CATS = ["wealth","love","health","career","relations","study"] as const;
type Cat = typeof CATS[number];
const BASE = 60;

// ── [1] TEN_GOD_INFLUENCE 테이블 (소스에서 복사) ─────────────────────────────
const TEN_GOD_INFLUENCE: Record<string, Record<Cat, number>> = {
  "比肩": { wealth:0,   love:0,   health:0,  career:0,   relations:0,  study:0  },
  "劫財": { wealth:-8,  love:-4,  health:-2, career:-3,  relations:-5, study:-2 },
  "食神": { wealth:10,  love:5,   health:10, career:6,   relations:11, study:8  },
  "傷官": { wealth:-3,  love:-4,  health:-2, career:3,   relations:-1, study:6  },
  "偏財": { wealth:8,   love:3,   health:2,  career:6,   relations:5,  study:3  },
  "正財": { wealth:12,  love:3,   health:4,  career:8,   relations:5,  study:3  },
  "偏官": { wealth:-5,  love:-5,  health:-8, career:-5,  relations:-7, study:-3 },
  "正官": { wealth:5,   love:2,   health:4,  career:10,  relations:6,  study:3  },
  "偏印": { wealth:0,   love:6,   health:3,  career:5,   relations:6,  study:2  },
  "正印": { wealth:5,   love:3,   health:7,  career:10,  relations:5,  study:4  },
};
const TEN_GOD_NAMES = Object.keys(TEN_GOD_INFLUENCE);

// ── Aggregator 상수 ───────────────────────────────────────────────────────────
const DOMAIN_WEIGHTS: Record<Cat, {saju:number;ziwei:number;astro:number}> = {
  wealth:   {saju:0.50, ziwei:0.35, astro:0.15},
  love:     {saju:0.40, ziwei:0.35, astro:0.25},
  health:   {saju:0.55, ziwei:0.25, astro:0.20},
  career:   {saju:0.50, ziwei:0.30, astro:0.20},
  relations:{saju:0.45, ziwei:0.30, astro:0.25},
  study:    {saju:0.45, ziwei:0.25, astro:0.30},
};
const BRANCH_REL_CAT_W: Record<string,number> = {
  love:1.2, relations:1.2, health:1.1, wealth:1.0, study:0.9, career:0.8,
};
// relations negative override
const DAILY_SENSITIVITY: Record<string,number> = {
  love:1.25, relations:1.10, health:1.00, wealth:1.10, study:1.08, career:1.00,
};
const COMPRESSION = 0.75;

function mean(arr: number[]): number { return arr.reduce((a,b)=>a+b,0)/arr.length; }
function pad(s: string|number, w: number): string { return String(s).padStart(w); }

// ── [1] TEN_GOD_INFLUENCE 평균 분석 ──────────────────────────────────────────
console.log("╔══════════════════════════════════════════════════════════════════════════╗");
console.log("║  STRUCTURAL BASELINE INVESTIGATION — 카테고리별 엔진 기대값             ║");
console.log("╚══════════════════════════════════════════════════════════════════════════╝");

console.log("\n══════════════════════════════════════════════════════════════════════════");
console.log("  [1] TEN_GOD_INFLUENCE 전체 평균 (10개 십신 단순평균)");
console.log("══════════════════════════════════════════════════════════════════════════");

// Per-TG values and mean
const tgMeans: Record<Cat, number> = {} as Record<Cat,number>;
console.log(`\n  십신       ${"wealth".padStart(7)}  ${"love".padStart(7)}  ${"health".padStart(7)}  ${"career".padStart(7)}  ${"relations".padStart(9)}  ${"study".padStart(7)}`);
for (const tg of TEN_GOD_NAMES) {
  const v = TEN_GOD_INFLUENCE[tg];
  console.log(`  ${tg.padEnd(6)}     ${pad(v.wealth,7)}  ${pad(v.love,7)}  ${pad(v.health,7)}  ${pad(v.career,7)}  ${pad(v.relations,9)}  ${pad(v.study,7)}`);
}
console.log("  ──────────────────────────────────────────────────────────────────────");
for (const cat of CATS) {
  tgMeans[cat] = TEN_GOD_NAMES.reduce((s,tg) => s + TEN_GOD_INFLUENCE[tg][cat], 0) / TEN_GOD_NAMES.length;
}
console.log(`  평균(mean)  ${CATS.map(c=>pad(tgMeans[c].toFixed(1),7)).join("  ")}`);

// Rank by mean
const ranked = [...CATS].sort((a,b)=>tgMeans[b]-tgMeans[a]);
console.log(`\n  카테고리 평균 순위 (높은 순):`);
ranked.forEach((c,i) => console.log(`    ${i+1}. ${c.padEnd(10)} ${tgMeans[c].toFixed(1)} pts/TG`));

// Per-TG health vs career gap
console.log(`\n  십신별 career vs health 차이:`);
for (const tg of TEN_GOD_NAMES) {
  const gap = TEN_GOD_INFLUENCE[tg].career - TEN_GOD_INFLUENCE[tg].health;
  const bar = gap > 0 ? "▲".repeat(Math.min(6,gap)) : "▼".repeat(Math.min(6,Math.abs(gap)));
  console.log(`    ${tg.padEnd(6)}  career:${pad(TEN_GOD_INFLUENCE[tg].career,3)}  health:${pad(TEN_GOD_INFLUENCE[tg].health,3)}  gap:${gap>0?"+":""}${gap}  ${bar}`);
}
const healthTopTGs = TEN_GOD_NAMES.filter(tg => TEN_GOD_INFLUENCE[tg].health >= 4);
const careerTopTGs = TEN_GOD_NAMES.filter(tg => TEN_GOD_INFLUENCE[tg].career >= 8);
const healthBadTGs = TEN_GOD_NAMES.filter(tg => TEN_GOD_INFLUENCE[tg].health < 0);
console.log(`\n  health ≥4인 십신: ${healthTopTGs.join(", ")} (${healthTopTGs.length}/10개)`);
console.log(`  career ≥8인 십신: ${careerTopTGs.join(", ")} (${careerTopTGs.length}/10개)`);
console.log(`  health 음수 십신: ${healthBadTGs.join(", ")} (${healthBadTGs.length}/10개)`);

// ── [2] 사주 엔진 TG 가중치별 기대값 ────────────────────────────────────────
console.log("\n══════════════════════════════════════════════════════════════════════════");
console.log("  [2] 사주 엔진 내 TG 적용 가중치 구조");
console.log("══════════════════════════════════════════════════════════════════════════");
console.log(`
  TG 이벤트 / 가중치:
  ├── 출생 월간(birth month stem)   × 0.53  [매일 고정]
  ├── 현재 월간(calendar month stem) × 0.47  [월 단위 고정, May2026 전체 동일]
  ├── 대운 천간(dayun stem)          × 0.40  [10년 고정]
  ├── 대운 지지(dayun branch)        × 0.27  [10년 고정]
  └── 일진 천간(target day stem)     × 0.33  [매일 회전]
  합계 총 가중치: 0.53+0.47+0.40+0.27+0.33 = 2.00
`);

// Structural saju contribution = mean(TG) × sum_weights × domain_weight
const TOTAL_TG_WEIGHT = 0.53 + 0.47 + 0.40 + 0.27 + 0.33; // 2.00
console.log("  카테고리별 TG 구조적 기대 기여 (BASE 초과분 = mean×2.00):");
console.log(`  Cat        TGmean  ×totalW  =sajuDelta  ×domW  =merged`);
for (const cat of CATS) {
  const sajuDelta  = tgMeans[cat] * TOTAL_TG_WEIGHT;
  const mergedContrib = sajuDelta * DOMAIN_WEIGHTS[cat].saju;
  console.log(`  ${cat.padEnd(10)} ${tgMeans[cat].toFixed(2).padStart(7)}  ×${TOTAL_TG_WEIGHT.toFixed(2)}  = ${sajuDelta.toFixed(2).padStart(9)}  ×${DOMAIN_WEIGHTS[cat].saju}  = ${mergedContrib.toFixed(2).padStart(6)}`);
}

// ── [3] BRANCH_REL_CAT_W 구조적 비대칭 ──────────────────────────────────────
console.log("\n══════════════════════════════════════════════════════════════════════════");
console.log("  [3] BRANCH_REL_CAT_W 구조적 비대칭 — 음수 이벤트 빈도와 결합");
console.log("══════════════════════════════════════════════════════════════════════════");
console.log("\n  지지관계 카테고리별 가중치 (BRANCH_REL_CAT_W):");
console.log(`  love:${BRANCH_REL_CAT_W.love}  relations:${BRANCH_REL_CAT_W.relations}(neg:0.9)  health:${BRANCH_REL_CAT_W.health}  wealth:${BRANCH_REL_CAT_W.wealth}  study:${BRANCH_REL_CAT_W.study}  career:${BRANCH_REL_CAT_W.career}`);
console.log(`
  음수 관계(충,해,형,삼형,원진,귀문) 기준 실효 카테고리 가중치:
    health   : 1.10 × penalty  → 가장 큰 패널티 흡수
    love     : 1.20 × penalty  → 연애는 더 크게 흔들림
    relations: 0.90 × penalty  → 대인관계는 오히려 완충
    career   : 0.80 × penalty  → 직업은 가장 낮은 패널티
    study    : 0.90 × penalty
    wealth   : 1.00 × penalty

  양수 관계(삼합,육합,방합,반합,복음) 기준:
    health   : 1.10 × bonus    → 좋은 날 건강도 잘 오름
    career   : 0.80 × bonus    → 좋은 날에도 직업은 덜 오름

  결론: health는 나쁜 날 더 많이 떨어지고 (1.10×penalty),
        career는 나쁜 날 덜 떨어진다 (0.80×penalty).
        음수 이벤트가 양수보다 빈번할 경우 → career 구조적 유리.`);

// ── [4] 2026 Astro 상수 패널티 ─────────────────────────────────────────────
console.log("\n══════════════════════════════════════════════════════════════════════════");
console.log("  [4] 2026 Astro 상수 패널티 (토성 장기 트랜짓)");
console.log("══════════════════════════════════════════════════════════════════════════");
const ASTRO_2026_HEALTH = -6;
const ASTRO_2026_CAREER = -3;
for (const cat of CATS) {
  const rawPenalty = cat === "health" ? ASTRO_2026_HEALTH : cat === "career" ? ASTRO_2026_CAREER : 0;
  const w = DOMAIN_WEIGHTS[cat].astro;
  const mergedEffect = rawPenalty * w;
  if (rawPenalty !== 0)
    console.log(`  ${cat.padEnd(10)}: astro raw ${rawPenalty} × domW ${w} = ${mergedEffect.toFixed(2)} pts/day (merged)`);
}
console.log(`  health astro 패널티: ${ASTRO_2026_HEALTH} × ${DOMAIN_WEIGHTS.health.astro} = ${(ASTRO_2026_HEALTH*DOMAIN_WEIGHTS.health.astro).toFixed(2)}`);
console.log(`  career astro 패널티: ${ASTRO_2026_CAREER} × ${DOMAIN_WEIGHTS.career.astro} = ${(ASTRO_2026_CAREER*DOMAIN_WEIGHTS.career.astro).toFixed(2)}`);
console.log(`  net health-career 불리: ${(ASTRO_2026_HEALTH*DOMAIN_WEIGHTS.health.astro - ASTRO_2026_CAREER*DOMAIN_WEIGHTS.career.astro).toFixed(2)} pts/day`);

// ── [5] 오행극(五行剋) health 전용 패널티 ────────────────────────────────────
console.log("\n══════════════════════════════════════════════════════════════════════════");
console.log("  [5] 오행극(五行剋) health 전용 패널티 기대값");
console.log("══════════════════════════════════════════════════════════════════════════");
console.log(`
  Rule: 일진 천간의 오행이 일간(日干) 오행을 克하면 health -6 (천간)
        일진 지지의 오행이 일간 오행을 克하면 health -3 (지지)

  10천간 중 일간을 克하는 천간 비율: 2/10 = 20% (예: 甲木이면 庚辛金이 克)
  12지지 중 일간을 克하는 지지 비율: 2/12 = 16.7% (예: 甲木이면 申酉金)

  기대 daily health penalty from 오행극:
    stem:   -6 × 0.200 = -1.20 pts/day
    branch: -3 × 0.167 = -0.50 pts/day
    합계:   -1.70 pts/day (health only)

  merged 영향:  -1.70 × 0.55(domW) = -0.935 pts/day
  (career에는 오행극 패널티 없음 → 추가 career 상대적 유리)`);

// ── [6] 실제 31일 사주 엔진 출력값 분석 ─────────────────────────────────────
console.log("\n══════════════════════════════════════════════════════════════════════════");
console.log("  [6] 실제 31일 엔진 평균 출력 — 3개 프로필 × 3개 엔진");
console.log("══════════════════════════════════════════════════════════════════════════");

type ProfileLabel = "A (Stress)" | "B (Neutral)" | "C (Positive)";
function collectEngineScores(
  label: ProfileLabel,
  saju: SajuEngineProfile,
  ziwei: ZiweiProfile,
  astro: AstroProfile,
) {
  const se = buildSajuEngineFromProfile(saju);
  const ze = buildZiweiEngineFromProfile(ziwei);
  const ae = buildAstroEngineFromProfile(astro);
  const birth = new Date(1998,0,22);

  const results = [];
  for (let d=1; d<=31; d++) {
    const dt = new Date(2026,4,d);
    const sr = se.calculate(dt);
    const zr = ze.calculate(dt);
    const ar = ae.calculate(dt, birth);

    // saju delta above BASE
    const sajuDeltas: Record<Cat,number> = {} as Record<Cat,number>;
    const ziweiDeltas: Record<Cat,number> = {} as Record<Cat,number>;
    const astroDeltas: Record<Cat,number> = {} as Record<Cat,number>;
    for (const cat of CATS) {
      sajuDeltas[cat]  = (sr.scores[cat] ?? BASE) - BASE;
      ziweiDeltas[cat] = zr.scores[cat] ?? 0;  // ziwei already outputs as delta
      astroDeltas[cat] = ar.scores[cat] ?? 0;  // astro also outputs as delta
    }

    // merged daily delta (matching aggregator logic)
    const sf = (v:number) => v>85?85+(v-85)*0.5:v<15?15-(15-v)*0.5:v;
    const mergedDeltas: Record<Cat,number> = {} as Record<Cat,number>;
    for (const cat of CATS) {
      const s = sr.scores[cat] ?? BASE;
      const z = zr.scores[cat] ?? 0;
      const a = ar.scores[cat] ?? 0;
      const w = DOMAIN_WEIGHTS[cat];
      const zC = Math.max(-30,Math.min(30,z));
      const aC = Math.max(-25,Math.min(25,a));
      const sSoft = sf(Math.max(0,Math.min(100,s)));
      const zSoft = sf(Math.max(0,Math.min(100,BASE+zC)));
      const aSoft = sf(Math.max(0,Math.min(100,BASE+aC)));
      const delta = (sSoft-BASE)*w.saju + (zSoft-BASE)*w.ziwei + (aSoft-BASE)*w.astro;
      const clamped = Math.max(-12,delta);
      mergedDeltas[cat] = clamped * (DAILY_SENSITIVITY[cat]??1.0);
    }
    results.push({ sajuDeltas, ziweiDeltas, astroDeltas, mergedDeltas });
  }
  return results;
}

const recA = collectEngineScores("A (Stress)",   PROFILE_A_SAJU, PROFILE_A_ZIWEI, PROFILE_A_ASTRO);
const recB = collectEngineScores("B (Neutral)",  PROFILE_B_SAJU, PROFILE_B_ZIWEI, PROFILE_B_ASTRO);
const recC = collectEngineScores("C (Positive)", PROFILE_C_SAJU, PROFILE_C_ZIWEI, PROFILE_C_ASTRO);

for (const [label, recs] of [["A (Stress)",recA],["B (Neutral)",recB],["C (Positive)",recC]] as [string,typeof recA][]) {
  console.log(`\n  Profile ${label}:`);
  console.log(`  ${"Cat".padEnd(10)}  saju_δ   ziwei_δ  astro_δ  merged_δ  final_score`);
  for (const cat of CATS) {
    const sD  = mean(recs.map(r=>r.sajuDeltas[cat]));
    const zD  = mean(recs.map(r=>r.ziweiDeltas[cat]));
    const aD  = mean(recs.map(r=>r.astroDeltas[cat]));
    const mD  = mean(recs.map(r=>r.mergedDeltas[cat]));
    // approx final = BASE + mergedDelta (before compression)
    const finalApprox = BASE + mD;
    const flag = cat==="health"&&mD<-5?"◀LOW":cat==="career"&&mD>5?"◀HIGH":"";
    console.log(`  ${cat.padEnd(10)}  ${sD.toFixed(1).padStart(7)}  ${zD.toFixed(1).padStart(7)}  ${aD.toFixed(1).padStart(7)}  ${mD.toFixed(1).padStart(8)}  ${finalApprox.toFixed(1).padStart(11)}  ${flag}`);
  }
}

// ── [7] profile-independent vs profile-specific 분리 ────────────────────────
console.log("\n══════════════════════════════════════════════════════════════════════════");
console.log("  [7] Profile-independent 구조 편향 vs Profile-specific 편향");
console.log("══════════════════════════════════════════════════════════════════════════");

// Global mean across 3 profiles
for (const cat of CATS) {
  const allMDs = [
    ...recA.map(r=>r.mergedDeltas[cat]),
    ...recB.map(r=>r.mergedDeltas[cat]),
    ...recC.map(r=>r.mergedDeltas[cat]),
  ];
  const m = mean(allMDs);
  const minP = Math.min(
    mean(recA.map(r=>r.mergedDeltas[cat])),
    mean(recB.map(r=>r.mergedDeltas[cat])),
    mean(recC.map(r=>r.mergedDeltas[cat])),
  );
  const maxP = Math.max(
    mean(recA.map(r=>r.mergedDeltas[cat])),
    mean(recB.map(r=>r.mergedDeltas[cat])),
    mean(recC.map(r=>r.mergedDeltas[cat])),
  );
  const spread = maxP - minP;
  const type = spread < 2.0 ? "profile-independent" : "profile-dependent";
  console.log(`  ${cat.padEnd(10)}  global_mean=${m.toFixed(2).padStart(6)}  spread=${spread.toFixed(2).padStart(5)}  → ${type}`);
}

// ── [8] 카테고리별 종합 structural baseline ─────────────────────────────────
console.log("\n══════════════════════════════════════════════════════════════════════════");
console.log("  [8] 카테고리별 Structural Baseline 최종 테이블 (현재 엔진 기준)");
console.log("══════════════════════════════════════════════════════════════════════════");

// Components of structural bias:
// 1. TG mean × total_weight × saju_domain_weight
// 2. Ohaeng clash health penalty: ~-1.70 × 0.55 = -0.935
// 3. Astro 2026 constant: health × 0.20 = -1.2, career × 0.20 = -0.6
// 4. Branch rel asymmetry: harder to quantify exactly, show qualitatively
// 5. Compression reduces all category spreads by 0.75

console.log(`
  Base expected score before any events: ${BASE} (all categories)

  ┌──────────────┬──────────────┬───────────────┬───────────────┬──────────────┬──────────────┐
  │ 요인          │ health       │ career        │ wealth        │ love         │ relations    │
  ├──────────────┼──────────────┼───────────────┼───────────────┼──────────────┼──────────────┤`);

// TG structural
const tgContrib: Record<Cat,number> = {} as Record<Cat,number>;
for (const cat of CATS) {
  tgContrib[cat] = tgMeans[cat] * TOTAL_TG_WEIGHT * DOMAIN_WEIGHTS[cat].saju;
}
console.log(`  │ TG mean      │ ${(BASE+tgContrib.health).toFixed(1).padStart(7)} (+${tgContrib.health.toFixed(1).padEnd(4)})│ ${(BASE+tgContrib.career).toFixed(1).padStart(8)} (+${tgContrib.career.toFixed(1).padEnd(4)}) │ ${(BASE+tgContrib.wealth).toFixed(1).padStart(8)} (+${tgContrib.wealth.toFixed(1).padEnd(4)}) │ ${(BASE+tgContrib.love).toFixed(1).padStart(7)} (+${tgContrib.love.toFixed(1).padEnd(4)})│ ${(BASE+tgContrib.relations).toFixed(1).padStart(7)} (+${tgContrib.relations.toFixed(1).padEnd(4)})│`);

// Ohaeng clash
const ohaengH = -1.70 * DOMAIN_WEIGHTS.health.saju;
console.log(`  │ 오행극       │ ${ohaengH.toFixed(2).padStart(7)} (only)│ 0.00 (none)   │ 0.00          │ 0.00         │ 0.00         │`);

// 2026 Astro
console.log(`  │ 2026 Astro   │ ${(ASTRO_2026_HEALTH*DOMAIN_WEIGHTS.health.astro).toFixed(2).padStart(7)}       │ ${(ASTRO_2026_CAREER*DOMAIN_WEIGHTS.career.astro).toFixed(2).padStart(8)}       │ 0.00          │ 0.00         │ 0.00         │`);

// Branch rel asymmetry (qualitative)
console.log(`  │ 지지관계 ×W  │ ×1.10 (최대)  │ ×0.80 (최소)  │ ×1.00         │ ×1.20        │ ×0.90(neg)   │`);
console.log(`  └──────────────┴──────────────┴───────────────┴───────────────┴──────────────┴──────────────┘`);

// Net structural delta
console.log(`\n  카테고리별 총 structural delta (TG+오행극+astro2026, before branch rel):`);
const structDelta: Record<Cat,number> = {} as Record<Cat,number>;
for (const cat of CATS) {
  const tg = tgContrib[cat];
  const clash = cat==="health" ? ohaengH : 0;
  const astro26 = cat==="health" ? ASTRO_2026_HEALTH*DOMAIN_WEIGHTS.health.astro :
                  cat==="career" ? ASTRO_2026_CAREER*DOMAIN_WEIGHTS.career.astro : 0;
  structDelta[cat] = tg + clash + astro26;
}
const rankedByCat = [...CATS].sort((a,b)=>structDelta[b]-structDelta[a]);
for (const cat of rankedByCat) {
  const bar = structDelta[cat]>0 ? "▲".repeat(Math.min(10,Math.round(structDelta[cat]))) : "▼".repeat(Math.min(10,Math.round(Math.abs(structDelta[cat]))));
  console.log(`  ${cat.padEnd(10)}  ${(BASE+structDelta[cat]).toFixed(1).padStart(6)} (delta: ${structDelta[cat]>=0?"+":""}${structDelta[cat].toFixed(2)})  ${bar}`);
}

console.log(`\n  career vs health 구조적 격차: ${(structDelta.career-structDelta.health).toFixed(2)} pts`);
console.log(`  (compression 0.75 후: ~${((structDelta.career-structDelta.health)*0.75).toFixed(2)} pts — 압축 적용)`);

// ── [9] 십신별 health/career 편향 상세 ──────────────────────────────────────
console.log("\n══════════════════════════════════════════════════════════════════════════");
console.log("  [9] 십신별 health 억압 / career 상승 원인 ranking");
console.log("══════════════════════════════════════════════════════════════════════════");

console.log("\n  health를 구조적으로 낮추는 십신 (health 낮고 career 높은 조합):");
const tgByHealthCareerGap = TEN_GOD_NAMES
  .map(tg => ({ tg, health: TEN_GOD_INFLUENCE[tg].health, career: TEN_GOD_INFLUENCE[tg].career, gap: TEN_GOD_INFLUENCE[tg].career - TEN_GOD_INFLUENCE[tg].health }))
  .sort((a,b) => b.gap - a.gap);
for (const {tg, health, career, gap} of tgByHealthCareerGap) {
  const verdict = gap > 5 ? "⚠ career편향" : gap < -5 ? "✓ health편향" : "  균형";
  console.log(`    ${tg.padEnd(6)}  health:${pad(health,3)}  career:${pad(career,3)}  gap:${(gap>=0?"+":"")}${gap}  ${verdict}`);
}

console.log("\n  health 음수 십신이 발동하는 조건:");
console.log("    偏官: health:-8  (발생 조건: 일간과 동음양 克관계 — 비교적 흔함)");
console.log("    劫財: health:-2  (발생 조건: 일간과 비견 동류 — 매우 흔함)");
console.log("    傷官: health:-2  (발생 조건: 일간이 생하는 同방향 — 흔함)");
console.log("    → 음수 십신 3개 모두 career에도 부정적 (劫財:-3, 偏官:-5)");
console.log("      단, 傷官은 career:+3 → career에는 유리하지만 health:-2");

// ── [10] 카테고리별 structural mean 기대값 테이블 ────────────────────────────
console.log("\n══════════════════════════════════════════════════════════════════════════");
console.log("  [10] 카테고리별 structural baseline 기대값 (최종 요약)");
console.log("══════════════════════════════════════════════════════════════════════════");

console.log(`
  ──────────────────────────────────────────────────────────────────────────
   카테고리    TG평균  구조델타  BASE 기대값  profile간 격차   실효 최하 빈도
  ──────────────────────────────────────────────────────────────────────────`);
for (const cat of rankedByCat) {
  const pIndep = (structDelta[cat]).toFixed(2);
  const base60 = (BASE + structDelta[cat]).toFixed(1);
  // From validation results
  const botFreqs: Record<string,string> = {
    health:"61~90%", career:"0%", wealth:"0%", love:"10~29%", relations:"0~3%", study:"0~13%"
  };
  const topFreqs: Record<string,string> = {
    health:"0%", career:"39~81%", wealth:"10~23%", love:"3~13%", relations:"0~3%", study:"3~35%"
  };
  console.log(`   ${cat.padEnd(10)}  ${tgMeans[cat].toFixed(1).padStart(6)}  ${(pIndep>=0?"+":"")+pIndep.padEnd(9)} → ${base60.padStart(6)}  bot:${(botFreqs[cat]??"-").padEnd(10)} top:${topFreqs[cat]??"-"}`);
}

// ── [11] 편향 원인 ranking & 최소 수정 후보 ────────────────────────────────
console.log("\n══════════════════════════════════════════════════════════════════════════");
console.log("  [11] 편향 원인 Ranking & 최소 수정 후보 (코드 수정 금지 — 후보만 제시)");
console.log("══════════════════════════════════════════════════════════════════════════");

const hcGap = structDelta.career - structDelta.health;
const tgGap = (tgMeans.career - tgMeans.health) * TOTAL_TG_WEIGHT * 0.50;
const branchGap = 0.3 * 5; // approximate: 5 avg negative rel pts × (1.1-0.8) = 1.5
const astroGap  = Math.abs(ASTRO_2026_CAREER*DOMAIN_WEIGHTS.career.astro - ASTRO_2026_HEALTH*DOMAIN_WEIGHTS.health.astro);

console.log(`
  health vs career 구조적 격차 원인 분해 (합산 기준):
  ┌────┬─────────────────────────────────────┬────────────┬─────────────────────────┐
  │ #  │ 원인                                │ 크기(pts)  │ profile-independent?    │
  ├────┼─────────────────────────────────────┼────────────┼─────────────────────────┤
  │ 1  │ TEN_GOD_INFLUENCE career>health 평균│ ${tgGap.toFixed(2).padEnd(10)} │ YES — 10개 TG 전체 편향  │
  │ 2  │ 오행극 health 전용 패널티          │ ${Math.abs(ohaengH).toFixed(2).padEnd(10)} │ YES — health only        │
  │ 3  │ 2026 astro health>career 패널티    │ ${astroGap.toFixed(2).padEnd(10)} │ YES — 2026년 한시적      │
  │ 4  │ 지지관계 비대칭(×1.1 vs ×0.8)     │ ~1.5 est   │ YES — 음수 이벤트 빈번 시│
  │ 5  │ 대운 疾厄(Profile A) direct -5     │ 5.00 A전용 │ NO  — Profile A만        │
  │ 6  │ 대운 官祿(Profile B) direct +3     │ 3.00 B전용 │ NO  — Profile B만        │
  └────┴─────────────────────────────────────┴────────────┴─────────────────────────┘

  최소 수정 후보 (위험도 순서):

  ① [위험 낮음] TEN_GOD_INFLUENCE health 값 +2~+3 상향 조정
      대상: 比肩(0→2), 劫財(-2→0), 傷官(-2→0)
      효과: TG mean health 1.8 → ~2.4  (career와 격차 4.0→3.4로 감소)
      위험: health만 영향, 다른 카테고리 무변화. 가장 안전.
      예상 개선: health 기대값 +0.5~0.8 pts/day, bottom 빈도 ~5~10% 감소

  ② [위험 낮음] BRANCH_REL_CAT_W health 패널티 가중치 1.1 → 0.95
      효과: 음수 이벤트에서 health 흡수 완화
      위험: 지지관계 전체 영향 — 양수 이벤트 health 개선도 약화
      예상 개선: health 기대값 +0.3~0.5 pts/day

  ③ [위험 중간] TEN_GOD_INFLUENCE career 값 -2~-3 하향 조정
      대상: 正財(8→6), 正官(10→8), 正印(10→8)
      효과: TG mean career 4.0 → ~3.1  (대칭적 교정)
      위험: career 전반적 하락 — career 유관 프로필에 체감
      예상 개선: career top 빈도 ~10~15% 감소

  ④ [위험 중간] 오행극 패널티 완화 stem:-6→-4, branch:-3→-2
      효과: health 전용 패널티 완화
      위험: health만 영향, 사주 오행 극 개념 완화 → 해석 정합성 문제

  ⑤ [위험 높음] 2026 astro health 패널티 제거 또는 완화 (-6→-3)
      효과: 2026 한시적 개선
      위험: 실제 Saturn 트랜짓 패널티를 제거하면 astro 엔진 신뢰도 저하

  ⑥ [위험 높음] DOMAIN_WEIGHTS health.saju 0.55 → 0.50 (career와 동일화)
      효과: health의 saju 엔진 의존도 낮아짐
      위험: health는 사주가 가장 연관성 높은 도메인 — 체계 훼손`);

// ── [12] 위험도별 추천 수정 방향 ────────────────────────────────────────────
console.log("\n══════════════════════════════════════════════════════════════════════════");
console.log("  [12] 추천 수정 방향 (우선순위 + 예상 효과)");
console.log("══════════════════════════════════════════════════════════════════════════");
console.log(`
  현재 구조: health 기대값은 career보다 ${hcGap.toFixed(1)}pts 낮음 (before compression)
  balance gate: health bottom < 65% — 현재 FAIL (61~90%)
  balance gate: career top    < 65% — 현재 FAIL (68~81%)

  최소 교정 목표:
    health vs career 구조 격차 ${hcGap.toFixed(1)} pts → 목표 ≤ 2.0 pts
    (compression 0.75 적용 후 최종 격차 ≤ 1.5 pts)

  추천 방향 (병행 적용 가능한 3개):

  [STEP 1] TEN_GOD_INFLUENCE health 하한 완화  ← 가장 안전, 단독 효과 중간
    비목: 比肩 health 0→2, 劫財 health -2→0, 傷官 health -2→0
    변경 후 health TG mean: 1.8 → (0+0+10+0+2+4-8+4+3+7)/10 = 22/10 = 2.2
    career gap: 4.0 - 2.2 = 1.8 (현재 2.2 → 1.8 → before domW)

  [STEP 2] 오행극 패널티 완화 (optional)  ← 단독으로는 효과 작음
    stem: -6 → -4 (즉 기대값 개선 +0.4 × 0.55 × 0.2 = +0.044/day)
    사실상 미미하나 extreme health 하락 빈도 감소에 기여

  [STEP 3] career TG 상한 완화 (선택적)  ← career gate FAIL 해결용
    正財/正官/正印 career 값 -2씩 → career mean 4.0 → 3.4
    career vs health 격차가 더 빠르게 감소

  [BEST SINGLE FIX]: TEN_GOD_INFLUENCE health 3개 TG 소폭 상향
    → profile-independent 효과, 다른 카테고리 무변화, 위험 최소
    → state atom 문제는 별도 처리 필요 (이 수정만으로 bottom gate 통과 불확실)

  NOTE:
    state atom 포화 문제(-2.22 avg delta) + TG 구조 편향(-1.98 pts)이 중복으로 작용.
    TEN_GOD_INFLUENCE 수정은 엔진 레벨, atom 정규화는 atom 레벨 — 두 수정은 독립적.
    한쪽만으로는 balance gate 통과 어려움. 병행 적용 권장.
`);
