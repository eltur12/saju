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

const result: DailyFortune[] = [];
for (let d = 1; d <= 30; d++) {
  result.push(agg.getDailyFortune(new Date(2026, 4, d)));
}

console.log(JSON.stringify(result.map(f => buildAiDailyRequest(f)), null, 2));
