/**
 * AI Request Validation Script
 * Generates 5 DailyFortune samples and validates buildAiDailyRequest() output.
 * Run: npx tsx validate_ai_request.ts
 */

import { FortuneAggregator, type DailyFortune } from "./src/engines/aggregator.js";
import type { SajuEngineProfile } from "./src/engines/sajuEngine.js";
import { type ZiweiProfile, SAMPLE_ZIWEI_PROFILE } from "./src/engines/ziweiEngine.js";
import { type AstroProfile, SAMPLE_ASTRO_PROFILE } from "./src/engines/astroEngine.js";
import { buildAiDailyRequest } from "./src/ai/buildAiDailyRequest.js";
import type { AiDailyRequest } from "./src/ai/types.js";

// ── Profile B: 甲日 / 官祿大限 ────────────────────────────────────────────────
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

// ── Build month ───────────────────────────────────────────────────────────────
const agg = new FortuneAggregator(SAJU, ZIWEI, ASTRO, undefined, new Date(1998, 0, 22));
agg.prewarmBaseline(new Date(2026, 4, 1));

const allDays: DailyFortune[] = [];
for (let d = 1; d <= 31; d++) {
  allDays.push(agg.getDailyFortune(new Date(2026, 4, d)));
}

// ── Select 5 diverse days ─────────────────────────────────────────────────────
function timeFlowRange(fortune: DailyFortune): number {
  const segs = fortune.timeSegments ?? [];
  if (segs.length === 0) return 0;
  return Math.max(...segs.map(s => s.score)) - Math.min(...segs.map(s => s.score));
}

const used = new Set<string>();
function pick(sortFn: (a: DailyFortune, b: DailyFortune) => number): DailyFortune {
  const result = [...allDays].filter(d => !used.has(d.date)).sort(sortFn)[0];
  used.add(result.date);
  return result;
}

const selected: Array<{ reason: string; fortune: DailyFortune }> = [
  { reason: "overall 가장 높은 날",              fortune: pick((a, b) => b.scores.overall - a.scores.overall) },
  { reason: "overall 가장 낮은 날",              fortune: pick((a, b) => a.scores.overall - b.scores.overall) },
  { reason: "애정(love) 점수 가장 높은 날",      fortune: pick((a, b) => b.scores.love - a.scores.love) },
  { reason: "직업(career) 점수 가장 높은 날",    fortune: pick((a, b) => b.scores.career - a.scores.career) },
  { reason: "timeFlow 변동(range)이 가장 큰 날", fortune: pick((a, b) => timeFlowRange(b) - timeFlowRange(a)) },
];

// ── Validation ────────────────────────────────────────────────────────────────
function validate(req: AiDailyRequest, fortune: DailyFortune): string[] {
  const v: string[] = [];

  v.push(req.date?.match(/^\d{4}-\d{2}-\d{2}$/)
    ? `✅ date: ${req.date}`
    : `❌ date 이상: ${req.date}`);

  v.push(req.flowType?.key && req.flowType?.label
    ? `✅ flowType: key="${req.flowType.key}" / label="${req.flowType.label}"`
    : `❌ flowType 누락`);

  v.push(req.topEvents.length <= 5
    ? `✅ topEvents: ${req.topEvents.length}개 (≤5)`
    : `❌ topEvents: ${req.topEvents.length}개 (초과)`);

  const emptyEff = req.topEvents.filter(e => e.effects.length === 0);
  v.push(emptyEff.length === 0
    ? `✅ effects: 빈 이벤트 없음`
    : `⚠️  effects 빈 이벤트 ${emptyEff.length}개: [${emptyEff.map(e => e.label).join(", ")}]`);

  const badStr = req.topStates.filter(s => s.strength < 1 || s.strength > 5);
  v.push(badStr.length === 0
    ? `✅ topStates strength: ${req.topStates.length}개 모두 1~5`
    : `❌ strength 범위 이탈: ${badStr.map(s => s.strength).join(", ")}`);

  v.push(req.categoryHighlights.length > 0
    ? `✅ categoryHighlights: ${req.categoryHighlights.length}개`
    : `⚠️  categoryHighlights: 비어 있음`);

  const tfOk = req.timeFlow.length === 3
    && req.timeFlow[0].label === "오전"
    && req.timeFlow[1].label === "오후"
    && req.timeFlow[2].label === "저녁";
  v.push(tfOk
    ? `✅ timeFlow: 오전/오후/저녁 3개`
    : `❌ timeFlow 구조 이상`);

  const emptyDS = req.timeFlow.filter(t => t.dominantStates.length === 0);
  v.push(emptyDS.length === 0
    ? `✅ dominantStates: 모든 시간대 채워짐`
    : `⚠️  dominantStates 빈 시간대: ${emptyDS.map(t => t.label).join(", ")}`);

  // Source info (for context)
  const sc = fortune.scores;
  v.push(`   점수: overall=${sc.overall} love=${sc.love} career=${sc.career} study=${sc.study} wealth=${sc.wealth} health=${sc.health} relations=${sc.relations}`);
  const segs = fortune.timeSegments ?? [];
  v.push(`   timeSegments: [${segs.map(s => `${s.startHour}h→${s.score}`).join(", ")}]`);

  return v;
}

// ── Print ─────────────────────────────────────────────────────────────────────
console.log("=".repeat(80));
console.log("  AI Request Validation  —  5 Samples  (Profile B / May 2026)");
console.log("=".repeat(80));

const allRequests: Array<{ req: AiDailyRequest; fortune: DailyFortune; chips: string[] }> = [];

for (let i = 0; i < selected.length; i++) {
  const { reason, fortune } = selected[i];
  const req = buildAiDailyRequest(fortune);
  const chips = (fortune.persisted?.topEvents ?? []).map(c => c.key);
  allRequests.push({ req, fortune, chips });

  console.log(`\n${"─".repeat(80)}`);
  console.log(`샘플 ${i + 1}`);
  console.log(`선택 이유: ${reason}`);
  console.log(`\n검증 결과:`);
  validate(req, fortune).forEach(line => console.log(`  ${line}`));
  console.log(`\nAiDailyRequest JSON:`);
  console.log(JSON.stringify(req, null, 2));
}

// ── Global summary ────────────────────────────────────────────────────────────
console.log(`\n${"=".repeat(80)}`);
console.log("최종 요약");
console.log("=".repeat(80));

// Effects 누락 key 목록
const emptyEffectReport: string[] = [];
for (const { req, fortune, chips } of allRequests) {
  req.topEvents.forEach((e, idx) => {
    if (e.effects.length === 0) {
      const key = chips[idx] ?? "(idx out of range)";
      emptyEffectReport.push(`  ${fortune.date}: key="${key}" → label="${e.label}"`);
    }
  });
}
if (emptyEffectReport.length === 0) {
  console.log("\n✅ effects 누락 key: 없음 (전체 이벤트에 effects 존재)");
} else {
  console.log(`\n⚠️  effects 누락 key (${emptyEffectReport.length}건):`);
  emptyEffectReport.forEach(l => console.log(l));
}

// dominantStates 빈 배열
const dsEmpty: string[] = [];
for (const { req, fortune } of allRequests) {
  req.timeFlow.filter(t => t.dominantStates.length === 0)
    .forEach(t => dsEmpty.push(`${fortune.date}:${t.label}`));
}
if (dsEmpty.length === 0) {
  console.log("✅ dominantStates 빈 배열 발생: 없음");
} else {
  console.log(`⚠️  dominantStates 빈 배열: ${dsEmpty.join(", ")}`);
}

// categoryHighlights
const chEmpty = allRequests.filter(({ req }) => req.categoryHighlights.length === 0);
if (chEmpty.length === 0) {
  console.log("✅ categoryHighlights 이상 없음 — 모든 샘플에 항목 존재");
} else {
  console.log(`⚠️  categoryHighlights 비어 있음: ${chEmpty.map(r => r.fortune.date).join(", ")}`);
}

// Label quality check
const flowLabelMissing = allRequests.filter(({ req }) => req.categoryHighlights.some(c => c.label === c.label && c.label.startsWith("flow.")));
if (flowLabelMissing.length > 0) {
  console.log(`\n⚠️  categoryHighlights label에 flow.* 원형 키 잔존 (미번역)`);
  for (const { req, fortune } of flowLabelMissing) {
    const raw = req.categoryHighlights.filter(c => c.label.startsWith("flow."));
    console.log(`  ${fortune.date}: ${raw.map(c => c.label).join(", ")}`);
  }
}

console.log(`
─── 코드 수정 제안 (이번 작업에서는 수정 안 함) ───────────────────────────────────────

1. categoryHighlights label 불일치
   현재: safeResolveLabel("flow.\${cat}") → 카테고리키(wealth/love/...) 기반이 아닌 flow.* 키를 잘못 조합
   실제 필요: cat("wealth"/"love"/...) → 한국어 라벨 ("재물"/"애정"/...)
   제안: CATEGORY_KR_LABELS 매핑 테이블 사용, 또는 safeResolveLabel 대신 직접 매핑

2. topEvents key가 AiDailyRequest에 미포함
   effects가 빈 배열인 경우 어떤 canonical key인지 추적 불가
   제안: AiDailyRequest.topEvents에 optional key 필드 추가 또는 debug 모드 추가

3. dominantStates 빈 배열 보장
   timeSegments.topEvents가 비어 있고 topStates.sourceEvents도 없으면 빈 배열 반환
   제안: 전역 topStates에서 최소 1개를 fallback으로 반환하는 보장 로직 추가
`);
