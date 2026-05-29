/**
 * Run: npx tsx validate_ai_request_json.ts
 */
import { FortuneAggregator, type DailyFortune } from "./src/engines/aggregator.js";
import type { SajuEngineProfile } from "./src/engines/sajuEngine.js";
import { type ZiweiProfile, SAMPLE_ZIWEI_PROFILE } from "./src/engines/ziweiEngine.js";
import { type AstroProfile, SAMPLE_ASTRO_PROFILE } from "./src/engines/astroEngine.js";
import { buildAiDailyRequest } from "./src/ai/buildAiDailyRequest.js";

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

const allDays: DailyFortune[] = [];
for (let d = 1; d <= 31; d++) {
  allDays.push(agg.getDailyFortune(new Date(2026, 4, d)));
}

function timeFlowRange(f: DailyFortune) {
  const s = f.timeSegments ?? [];
  return s.length ? Math.max(...s.map(x => x.score)) - Math.min(...s.map(x => x.score)) : 0;
}

const used = new Set<string>();
function pick(fn: (a: DailyFortune, b: DailyFortune) => number): DailyFortune {
  const r = [...allDays].filter(d => !used.has(d.date)).sort(fn)[0];
  used.add(r.date);
  return r;
}

const samples = [
  { reason: "overall 가장 높은 날",              fortune: pick((a, b) => b.scores.overall - a.scores.overall) },
  { reason: "overall 가장 낮은 날",              fortune: pick((a, b) => a.scores.overall - b.scores.overall) },
  { reason: "애정(love) 점수 가장 높은 날",      fortune: pick((a, b) => b.scores.love - a.scores.love) },
  { reason: "직업(career) 점수 가장 높은 날",    fortune: pick((a, b) => b.scores.career - a.scores.career) },
  { reason: "timeFlow 변동이 가장 큰 날",        fortune: pick((a, b) => timeFlowRange(b) - timeFlowRange(a)) },
];

const output = samples.map(({ reason, fortune }) => ({
  reason,
  scores: fortune.scores,
  request: buildAiDailyRequest(fortune),
}));

console.log(JSON.stringify(output, null, 2));
