/**
 * Run: npx tsx diagnose_event_trace.ts
 *
 * 각 topEvent별로 다음 4가지를 추적:
 *  1. impact       — PersistedEventChip.impact
 *  2. source       — PersistedEventChip.source ("saju"|"ziwei"|"astro")
 *  3. 영향 state   — topStates[].sourceEvents 역방향 조회
 *  4. 영향 category — categoryHighlights[cat].topEvents 역방향 조회
 *
 * 추가: atomDebug 레벨에서 event → atom 기여량 상세 표시
 */
import { FortuneAggregator, type DailyFortune } from "./src/engines/aggregator.js";
import type { SajuEngineProfile } from "./src/engines/sajuEngine.js";
import { type ZiweiProfile, SAMPLE_ZIWEI_PROFILE } from "./src/engines/ziweiEngine.js";
import { type AstroProfile, SAMPLE_ASTRO_PROFILE } from "./src/engines/astroEngine.js";
import { STATE_TO_CAT, type StateAtomKey } from "./src/engines/stateAtomLayer.js";

// ── ev.key ↔ raw source 매핑 헬퍼 ─────────────────────────────────────────────
const TEN_GOD_KEY: Record<string, string> = {
  "食神":"siksin","正印":"jeongin","傷官":"sanggwan","正官":"jeonggwan",
  "偏官":"pyeonggwan","偏財":"pyeongjae","正財":"jeongjae",
  "比肩":"bigyeon","劫財":"geobjae","偏印":"pyeongin",
};
const BRANCH_KEY: Record<string, string> = {
  "충":"clash","육합":"sixHarmony","삼합":"trine","방합":"directionalHarmony",
  "반합":"halfTrine","형":"penalty","삼형":"triplePenalty",
  "해":"harm","원진":"hostility","귀문":"spiritDoor","복음":"selfPenalty",
};
const STAR_KEY: Record<string, string> = {
  "도화살":"doHwa","역마살":"yeokMa","백호살":"baekHo","화개살":"hwaGae",
  "겁살":"geobSal","천덕귀인":"cheonDeok","월덕귀인":"wolDeok",
};
const ASPECT_SLUG: Record<string, string> = {
  "△":"trine","□":"square","☌":"conjunction","☍":"opposition",
  "⚹":"sextile","⚻":"quincunx","∠":"semisquare",
};
const PLANET_SLUG: Record<string, string> = {
  "Sun":"sun","Moon":"moon","Mercury":"mercury","Venus":"venus","Mars":"mars",
  "Jupiter":"jupiter","Saturn":"saturn","Uranus":"uranus","Neptune":"neptune",
  "Pluto":"pluto","NorthNode":"northNode","Chiron":"chiron",
};
const PLANET_ORDER = Object.keys(PLANET_SLUG).sort((a, b) => b.length - a.length);

function evKeyMatchesRaw(evKey: string, raw: string): boolean {
  const tg = TEN_GOD_KEY[raw];
  if (tg && evKey === `saju.tenGod.${tg}`) return true;
  const br = BRANCH_KEY[raw];
  if (br && evKey === `saju.branch.${br}`) return true;
  const sk = STAR_KEY[raw];
  if (sk && evKey === `saju.star.${sk}`) return true;
  if (raw === "오행극" && evKey === "saju.ohaeng.clash") return true;
  for (const planet of PLANET_ORDER) {
    if (!raw.startsWith(planet)) continue;
    const sym = raw.slice(planet.length);
    const asp = ASPECT_SLUG[sym];
    if (asp && evKey === `astro.aspect.${PLANET_SLUG[planet]}.${asp}`) return true;
  }
  return false;
}

function stripPrefix(src: string): string {
  if (src.startsWith("십신:"))   return src.slice(3);
  if (src.startsWith("지지:"))   return src.slice(3);
  if (src.startsWith("월지지:")) return src.slice(4);
  if (src.startsWith("살:"))     return src.slice(2);
  if (src.startsWith("행성:"))   return src.slice(3);
  return src;
}

function atomCategories(atomKey: StateAtomKey): string {
  const cats = STATE_TO_CAT[atomKey];
  if (!cats) return "-";
  return Object.entries(cats)
    .map(([cat, coeff]) => `${cat}(${coeff > 0 ? "+" : ""}${coeff})`)
    .join(", ");
}

// ── Setup ─────────────────────────────────────────────────────────────────────

const SAJU: SajuEngineProfile = {
  day_stem: "甲", month_stem: "己", hour_branch: "子",
  day_branch: "寅", month_branch: "未", year_branch: "戌",
  special_stars: [], dayun_stem: "甲", dayun_branch: "寅",
};
const ZIWEI: ZiweiProfile = {
  ...SAMPLE_ZIWEI_PROFILE,
  year_sihua_palaces: { "化祿": "官祿", "化權": "財帛", "化科": "遷移", "化忌": "兄弟" },
  current_dahan: "官祿", dahan_stars: [],
};
const ASTRO: AstroProfile = {
  ...SAMPLE_ASTRO_PROFILE,
  planet_houses: { ...SAMPLE_ASTRO_PROFILE.planet_houses, "Saturn": 12 },
};

const agg = new FortuneAggregator(SAJU, ZIWEI, ASTRO, undefined, new Date(1998, 0, 22));
agg.prewarmBaseline(new Date(2026, 4, 1));

// 3일 샘플: 5/1, 5/10(tensionSpike), 5/13(overall최고)
const SAMPLE_DATES = [
  new Date(2026, 4, 1),
  new Date(2026, 4, 10),
  new Date(2026, 4, 13),
];

for (const date of SAMPLE_DATES) {
  analyzeDay(agg.getDailyFortune(date));
}

// ── Main analyzer ─────────────────────────────────────────────────────────────

function analyzeDay(fortune: DailyFortune) {
  const p = fortune.persisted!;
  const atomDebug = fortune.stateAtomDebug!;
  const catKeys = ["wealth", "love", "health", "career", "relations", "study"] as const;

  // event key → 영향받은 state key들 (PersistedState.sourceEvents 역조회)
  const eventToStates = new Map<string, string[]>();
  for (const st of p.topStates) {
    for (const evKey of st.sourceEvents) {
      if (!eventToStates.has(evKey)) { eventToStates.set(evKey, []); }
      eventToStates.get(evKey)!.push(st.key);
    }
  }

  // event key → 영향받은 category들 (categoryHighlights[cat].topEvents 역조회)
  const eventToCategories = new Map<string, string[]>();
  for (const cat of catKeys) {
    const topEvents = p.categoryHighlights[cat]?.topEvents ?? [];
    for (const evKey of topEvents) {
      if (!eventToCategories.has(evKey)) { eventToCategories.set(evKey, []); }
      eventToCategories.get(evKey)!.push(cat);
    }
  }

  console.log(`\n${"═".repeat(70)}`);
  console.log(` ${fortune.date}  overall=${fortune.scores.overall}  flowType=${p.summary.flowType}`);
  console.log(`${"═".repeat(70)}`);

  for (const ev of p.topEvents) {
    const affectedStates = eventToStates.get(ev.key) ?? [];
    const affectedCats   = eventToCategories.get(ev.key) ?? [];

    console.log(`\n  ▶ ${ev.key}`);
    console.log(`    1. impact     : ${ev.impact}   polarity=${ev.polarity}`);
    console.log(`    2. source     : ${ev.source}`);
    console.log(`    3. states     : ${affectedStates.length > 0 ? affectedStates.join(", ") : "(없음)"}`);
    console.log(`    4. categories : ${affectedCats.length > 0 ? affectedCats.join(", ") : "(없음)"}`);

    // atomDebug 레벨: 어느 atom에 얼마나 기여했는지
    const atomContribs: Array<{ atom: string; contrib: number; catChain: string }> = [];
    for (const [atomKey, entry] of Object.entries(atomDebug.atoms)) {
      if (entry.value === 0 || entry.sources.length === 0) continue;
      const perSrc = entry.value / entry.sources.length;
      const matchCount = entry.sources.filter(src => {
        const raw = stripPrefix(src);
        return evKeyMatchesRaw(ev.key, raw);
      }).length;
      if (matchCount === 0) continue;
      const contrib = perSrc * matchCount;
      atomContribs.push({
        atom: atomKey,
        contrib: +contrib.toFixed(3),
        catChain: atomCategories(atomKey as StateAtomKey),
      });
    }
    if (atomContribs.length > 0) {
      console.log(`    └─ atom 기여:`);
      for (const ac of atomContribs.sort((a, b) => Math.abs(b.contrib) - Math.abs(a.contrib))) {
        const sign = ac.contrib >= 0 ? "+" : "";
        console.log(`         ${ac.atom.padEnd(20)} ${sign}${ac.contrib}  → ${ac.catChain}`);
      }
    }
  }

  // category별 최종 topEvents 요약
  console.log(`\n  ── categoryHighlights.topEvents`);
  for (const cat of catKeys) {
    const evKeys = p.categoryHighlights[cat]?.topEvents ?? [];
    console.log(`    ${cat.padEnd(10)}: ${evKeys.join(", ") || "(없음)"}`);
  }
}
