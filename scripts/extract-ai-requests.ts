/**
 * 30일치 AiDailyRequest 추출 스크립트
 * 실행: npx tsx scripts/extract-ai-requests.ts
 */
import { FortuneAggregator } from "../src/engines/aggregator";
import { calculateSajuProfile } from "../src/utils/sajuCalculator";
import { buildZiweiProfile } from "../src/utils/ziweiCalculator";
import { buildAstroProfile } from "../src/utils/astroCalculator";
import { normalizeBirthDateTimeByRegion } from "../src/utils/sajuTime";
import { buildAiDailyRequest } from "../src/ai/buildAiDailyRequest";

// ── 샘플 사용자 (1990-03-15 오전 10시, 서울, 남성) ────────────────────────────
const USER = {
  birth_year:   1990,
  birth_month:  3,
  birth_day:    15,
  birth_hour:   10,
  birth_minute: 0,
  birth_region: "seoul",
  gender:       "M" as const,
};

// ── 대상 기간 (2026-05 ~ 2026-06, 30일) ──────────────────────────────────────
const YEAR  = 2026;
const MONTH = 5;

async function main() {
  const normalized = normalizeBirthDateTimeByRegion({
    year:     USER.birth_year,
    month:    USER.birth_month,
    day:      USER.birth_day,
    hour:     USER.birth_hour,
    minute:   USER.birth_minute,
    regionId: USER.birth_region,
  });

  const sajuProfile = calculateSajuProfile(
    normalized.year, normalized.month, normalized.day,
    normalized.hour, USER.gender, undefined, normalized.minute,
  );

  const ziweiProfile = buildZiweiProfile(
    normalized.year, normalized.month, normalized.day,
    normalized.hour, YEAR, USER.gender === "M",
  );

  const astroProfile = await buildAstroProfile(
    normalized.year, normalized.month, normalized.day,
    normalized.hour, undefined, undefined, normalized.minute,
  );

  const birthDate = new Date(USER.birth_year, USER.birth_month - 1, USER.birth_day);
  const aggregator = new FortuneAggregator(sajuProfile, ziweiProfile, astroProfile, undefined, birthDate, true);

  // 월간 운세 계산 (5월 31일 + 6월 1일로 30일 확보)
  const may  = aggregator.getMonthlyFortune(YEAR, MONTH);
  const june = aggregator.getMonthlyFortune(YEAR, MONTH + 1);

  const all30 = [...may.daily_fortunes, ...june.daily_fortunes].slice(0, 30);

  // ── 출력 ────────────────────────────────────────────────────────────────────
  console.log(`\n${"═".repeat(70)}`);
  console.log(`  AiDailyRequest 샘플 — 30일 (${YEAR}-${MONTH < 10 ? "0" + MONTH : MONTH})`);
  console.log(`  사용자: ${USER.birth_year}-${String(USER.birth_month).padStart(2,"0")}-${String(USER.birth_day).padStart(2,"0")} ${USER.birth_hour}시 서울 남성`);
  console.log(`${"═".repeat(70)}\n`);

  for (const fortune of all30) {
    const req = buildAiDailyRequest(fortune);

    // 간략 요약 출력
    const driverKeys = req.categoryHighlights.flatMap(c => c.drivers);
    const uniqueDriverCount = new Set(driverKeys).size;
    const catDriverCounts = req.categoryHighlights.map(c => `${c.label}:${c.drivers.length}`).join(" ");

    console.log(`── ${req.date} ──────────────────────────────────`);
    console.log(`  flowType      : ${req.flowType.label} (${req.flowType.key})`);
    console.log(`  events        : ${Object.keys(req.events).length}개 (${Object.entries(req.events).map(([k, v]) => `${k}=${v.label}`).join(", ")})`);
    console.log(`  topStates     : ${req.topStates.map(s => `${s.label}(${s.strength})`).join(", ")}`);
    console.log(`  catHighlights : ${catDriverCounts}  (고유 driver ${uniqueDriverCount}개)`);
    console.log(`  backgroundEvt : [${req.backgroundEvents.join(", ")}]`);
    console.log(`  timeFlow      : 오전${req.timeFlow[0].score} 오후${req.timeFlow[1].score} 저녁${req.timeFlow[2].score}`);

    // 중복 확인: backgroundEvents 중 drivers에 있는 것
    const eventLabels = new Set(Object.values(req.events).map(e => e.label));
    const overlap = req.backgroundEvents.filter(bg => eventLabels.has(bg));
    if (overlap.length > 0) {
      console.log(`  ⚠ background/driver 중복: ${overlap.join(", ")}`);
    }
    console.log();
  }

  // ── 전체 통계 ──────────────────────────────────────────────────────────────
  console.log(`${"═".repeat(70)}`);
  console.log("전체 통계");
  console.log(`${"═".repeat(70)}`);

  let totalDriverRefs = 0;
  let totalUniqueEvents = 0;
  let totalBackgroundOverlap = 0;
  let daysWithBackground = 0;

  for (const fortune of all30) {
    const req = buildAiDailyRequest(fortune);
    const driverKeys = req.categoryHighlights.flatMap(c => c.drivers);
    totalDriverRefs    += driverKeys.length;
    totalUniqueEvents  += Object.keys(req.events).length;

    const eventLabels = new Set(Object.values(req.events).map(e => e.label));
    const overlap = req.backgroundEvents.filter(bg => eventLabels.has(bg));
    totalBackgroundOverlap += overlap.length;

    if (req.backgroundEvents.length > 0) daysWithBackground++;
  }

  console.log(`  총 driver 참조 수 : ${totalDriverRefs} (평균 ${(totalDriverRefs / 30).toFixed(1)}/일)`);
  console.log(`  총 events 수      : ${totalUniqueEvents} (평균 ${(totalUniqueEvents / 30).toFixed(1)}/일)`);
  console.log(`  background 있는 날: ${daysWithBackground}/30일`);
  console.log(`  background↔driver 중복 발생: ${totalBackgroundOverlap}건`);
  console.log();

  // ── 대표 3일 전체 JSON ─────────────────────────────────────────────────────
  console.log(`${"═".repeat(70)}`);
  console.log("대표 3일 전체 JSON");
  console.log(`${"═".repeat(70)}`);

  for (const fortune of all30.slice(0, 3)) {
    const req = buildAiDailyRequest(fortune);
    console.log(JSON.stringify(req, null, 2));
    console.log();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
