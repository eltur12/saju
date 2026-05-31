/**
 * category display norm 검증
 * raw vs display (overall + 6 카테고리) 비교 + AI payload 일관성 확인
 * Usage: npx tsx scripts/testCategoryNorm.ts
 */
import { calculateSajuProfile }           from "../src/utils/sajuCalculator";
import { buildZiweiProfile }              from "../src/utils/ziweiCalculator";
import { buildAstroProfile }              from "../src/utils/astroCalculator";
import { normalizeBirthDateTimeByRegion } from "../src/utils/sajuTime";
import { FortuneAggregator }              from "../src/engines/aggregator";
import { buildAiDailyRequest }            from "../src/ai/buildAiDailyRequest";
import type { MonthContext }              from "../src/ai/buildAiDailyRequest";

const NORM_TARGET  = 67;
const NORM_MAX_OFF = 6;
const DISPLAY_ADD  = 5;
const CAT_KEYS = ["wealth", "love", "health", "career", "relations", "study"] as const;
type CatKey = typeof CAT_KEYS[number];

function applyNorm(rawScores: number[], off: number): number[] {
  return rawScores.map(r => Math.round(Math.max(0, Math.min(100, r + off + DISPLAY_ADD))));
}
function normOffset(rawOveralls: number[]): number {
  const avg = rawOveralls.reduce((s, x) => s + x, 0) / rawOveralls.length;
  return Math.max(-NORM_MAX_OFF, Math.min(NORM_MAX_OFF, NORM_TARGET - avg));
}
function pad(v: string | number, w: number) { return String(v).padStart(w); }

// ── 프로필 (1998M 부산, 1990M 서울) ──────────────────────────────────────────
const PROFILES = [
  { name: "P1 (1998M 부산)", birth: { year: 1998, month: 1, day: 22, hour: 12, minute: 10 }, gender: "M" as const, region: "busan" },
  { name: "P2 (1990M 서울)", birth: { year: 1990, month: 1, day: 1,  hour: 0,  minute: 0  }, gender: "M" as const, region: "seoul" },
];

const TEST_YEAR = 2026, TEST_MONTH = 5;
const line = "══════════════════════════════════════════════════════════════════";
const dash = "──────────────────────────────────────────────────────────────────";

async function main() {
  for (const profile of PROFILES) {
    console.log(`\n${line}`);
    console.log(`▶ ${profile.name}  — ${TEST_YEAR}-${String(TEST_MONTH).padStart(2,"0")}`);
    console.log(line);

    const nb = normalizeBirthDateTimeByRegion({
      year: profile.birth.year, month: profile.birth.month, day: profile.birth.day,
      hour: profile.birth.hour, minute: profile.birth.minute, regionId: profile.region,
    });

    const saju  = calculateSajuProfile(nb.year, nb.month, nb.day, nb.hour, profile.gender, undefined, nb.minute);
    const ziwei = buildZiweiProfile(nb.year, nb.month, nb.day, nb.hour, TEST_YEAR, profile.gender === "M");
    const astro = await buildAstroProfile(nb.year, nb.month, nb.day, nb.hour, undefined, undefined, nb.minute);
    const birthDate = new Date(profile.birth.year, profile.birth.month - 1, profile.birth.day);

    const agg = new FortuneAggregator(saju, ziwei, astro, undefined, birthDate, true);
    const raw = agg.getMonthlyFortune(TEST_YEAR, TEST_MONTH);

    const rawOveralls = raw.daily_fortunes.map(f => f.scores.overall as number);
    const off = normOffset(rawOveralls);
    const rawAvg = rawOveralls.reduce((s, x) => s + x, 0) / rawOveralls.length;

    console.log(`\n  raw overall 평균: ${Math.round(rawAvg * 10) / 10}  |  normOffset: ${off >= 0 ? "+" : ""}${off}  |  DISPLAY_ADD: +${DISPLAY_ADD}`);
    console.log(`  = display 목표 평균: ~${Math.round(rawAvg * 10) / 10 + off + DISPLAY_ADD}`);

    // ── 항목 1: raw vs display 상세 (5일 샘플) ─────────────────────────────
    console.log(`\n  항목 1: raw vs display 샘플 (1일·5일·10일·17일·31일)`);
    const sampleDays = [1, 5, 10, 17, 31];
    const catLabels: Record<string, string> = {
      wealth: "재물", love: "애정", health: "건강", career: "직업", relations: "관계", study: "학업",
    };

    for (const day of sampleDays) {
      const f = raw.daily_fortunes[day - 1];
      if (!f) continue;
      const dispOverall = Math.round(Math.max(0, Math.min(100, (f.scores.overall as number) + off + DISPLAY_ADD)));
      console.log(`\n  ── ${f.date} ──`);
      console.log(`  ${"항목".padEnd(8)} ${"raw".padStart(5)} ${"display".padStart(8)}`);
      console.log(`  ${dash.slice(0, 26)}`);
      console.log(`  ${"overall".padEnd(8)} ${pad(f.scores.overall, 5)} ${pad(dispOverall, 8)}`);
      for (const cat of CAT_KEYS) {
        const rawCat  = f.scores[cat] as number;
        const dispCat = Math.round(Math.max(0, Math.min(100, rawCat + off + DISPLAY_ADD)));
        console.log(`  ${catLabels[cat].padEnd(8)} ${pad(rawCat, 5)} ${pad(dispCat, 8)}`);
      }
      // gap 확인: overall과 카테고리 평균 괴리
      const dispCatAvg = CAT_KEYS.reduce((s, cat) => s + Math.round(Math.max(0, Math.min(100, (f.scores[cat] as number) + off + DISPLAY_ADD))), 0) / CAT_KEYS.length;
      console.log(`  카테고리 평균: ${Math.round(dispCatAvg * 10) / 10}  |  overall: ${dispOverall}  |  괴리: ${Math.round((dispOverall - dispCatAvg) * 10) / 10}`);
    }

    // ── 항목 2: AI payload 확인 (3일 샘플) ────────────────────────────────
    console.log(`\n  항목 2: AI payload overall vs scores 일관성 (1일·15일·31일)`);

    // displayScores 배열 구성 (overall 기준)
    const displayOveralls = applyNorm(rawOveralls, off);
    const monthCtx: MonthContext = {
      displayScores: displayOveralls,
      flowType: "",
      palace:   raw.monthly_palace,
    };

    // fortune 객체를 display 기준으로 교체 (applyDisplayNorm 결과 시뮬레이션)
    const dispFortunes = raw.daily_fortunes.map((f, i) => ({
      ...f,
      scores: {
        ...f.scores,
        overall: displayOveralls[i],
        ...Object.fromEntries(CAT_KEYS.map(cat => [cat, Math.round(Math.max(0, Math.min(100, (f.scores[cat] as number) + off + DISPLAY_ADD)))])),
      },
    }));

    for (const day of [1, 15, 31]) {
      const f   = dispFortunes[day - 1];
      if (!f) continue;
      const req = buildAiDailyRequest(f, monthCtx);
      const scores = req.scores;
      console.log(`\n  ── ${f.date} ──`);
      console.log(`  overall: ${req.overall}`);
      console.log(`  scores: 재물${scores.wealth} 애정${scores.love} 건강${scores.health} 직업${scores.career} 관계${scores.relations} 학업${scores.study}`);
      const catAvg = CAT_KEYS.reduce((s, cat) => s + scores[cat as CatKey], 0) / CAT_KEYS.length;
      console.log(`  카테고리 평균: ${Math.round(catAvg * 10) / 10}  |  overall: ${req.overall}  |  괴리: ${Math.round((req.overall - catAvg) * 10) / 10}`);
      if (req.categoryHighlights.length > 0) {
        console.log(`  categoryHighlights:`);
        for (const ch of req.categoryHighlights) {
          console.log(`    ${ch.label}: ${ch.score}점  (events: ${ch.topEvents.slice(0, 2).join(", ")})`);
        }
      }
    }

    // ── 항목 3: 전월 괴리 통계 ──────────────────────────────────────────────
    console.log(`\n  항목 3: 전월 overall vs 카테고리 평균 괴리 통계`);
    const gaps: number[] = [];
    for (const f of dispFortunes) {
      const dispOver = f.scores.overall as number;
      const catAvg   = CAT_KEYS.reduce((s, cat) => s + (f.scores[cat] as number), 0) / CAT_KEYS.length;
      gaps.push(Math.abs(dispOver - catAvg));
    }
    const avgGap = gaps.reduce((s, x) => s + x, 0) / gaps.length;
    const maxGap = Math.max(...gaps);
    console.log(`  평균 괴리: ${Math.round(avgGap * 10) / 10}점  |  최대 괴리: ${Math.round(maxGap * 10) / 10}점`);
  }

  console.log(`\n✅ 완료`);
}

main().catch(console.error);
