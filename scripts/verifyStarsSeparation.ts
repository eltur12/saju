/**
 * 특별성 분리 검증 — LEGACY(구동작) vs DEFAULT(신동작) 비교
 * Usage: npx tsx scripts/verifyStarsSeparation.ts
 *
 * 검증 항목:
 *   1. overall avg / inter-user std
 *   2. 카테고리 avg / std
 *   3. topEvents 변화 (saju.star.* 항목 소멸 확인)
 *   4. AI Request 샘플 (profileSpecialStars 포함 확인)
 *   5. profileSpecialStars 생성 확인
 */
import { calculateSajuProfile }   from "../src/utils/sajuCalculator";
import { buildZiweiProfile }       from "../src/utils/ziweiCalculator";
import { buildAstroProfile }       from "../src/utils/astroCalculator";
import { FortuneAggregator }       from "../src/engines/aggregator";
import { DEFAULT_ZIWEI_FLAGS }     from "../src/engines/ziweiEngine";
import {
  DEFAULT_SAJU_FLAGS,
  LEGACY_SAJU_FLAGS,
  type SajuExperimentFlags,
} from "../src/engines/sajuEngine";
import { buildAiDailyRequest }     from "../src/ai/buildAiDailyRequest";
import type { DailyFortune }       from "../src/engines/aggregator";
import type { ScoreMap }           from "../src/engines/sajuEngine";

// ── 프로필 ────────────────────────────────────────────────────────────────────
const PROFILES = [
  {
    label: "A (천덕귀인·좋은원국)",
    birth: { year:1988, month:6,  day:6,  hour:10, minute:0 },
    gender: "M" as const,
  },
  {
    label: "B (겁살·나쁜원국)",
    birth: { year:1979, month:2,  day:11, hour:1,  minute:0 },
    gender: "M" as const,
  },
  {
    label: "C (중립원국)",
    birth: { year:1992, month:10, day:20, hour:14, minute:0 },
    gender: "F" as const,
  },
];

const START  = new Date(2026, 2, 1);
const N_DAYS = 92;
const DOM: (keyof ScoreMap)[] = ["wealth","love","health","career","relations","study"];

function r1(v: number) { return Math.round(v * 10) / 10; }
function avg(a: number[]) { return a.reduce((s,x)=>s+x,0)/a.length; }
function stdev(a: number[]) {
  const m = avg(a);
  return Math.sqrt(a.reduce((s,x)=>s+(x-m)**2,0)/a.length);
}
function pad(s: string|number, w: number) { return String(s).padStart(w); }
function padR(s: string|number, w: number) { return String(s).padEnd(w); }

// ── 빌드 ─────────────────────────────────────────────────────────────────────
interface ProfileData {
  label: string;
  sajuProfile:  ReturnType<typeof calculateSajuProfile>;
  ziweiProfile: ReturnType<typeof buildZiweiProfile>;
  astroProfile: Awaited<ReturnType<typeof buildAstroProfile>>;
  birthDate:    Date;
}

async function buildPD(p: typeof PROFILES[0]): Promise<ProfileData> {
  const { birth, gender } = p;
  return {
    label:        p.label,
    sajuProfile:  calculateSajuProfile(birth.year, birth.month, birth.day, birth.hour, gender, undefined, birth.minute),
    ziweiProfile: buildZiweiProfile(birth.year, birth.month, birth.day, birth.hour, 2026, gender === "M"),
    astroProfile: await buildAstroProfile(birth.year, birth.month, birth.day, birth.hour, undefined, undefined, birth.minute),
    birthDate:    new Date(birth.year, birth.month - 1, birth.day),
  };
}

function runDays(pd: ProfileData, flags: SajuExperimentFlags): DailyFortune[] {
  const agg = new FortuneAggregator(
    pd.sajuProfile, pd.ziweiProfile, pd.astroProfile,
    undefined, pd.birthDate, true,
  );
  const days: DailyFortune[] = [];
  for (let i = 0; i < N_DAYS; i++) {
    const d = new Date(START);
    d.setDate(START.getDate() + i);
    days.push(agg.getDailyFortune(d, DEFAULT_ZIWEI_FLAGS, flags));
  }
  return days;
}

interface Stats {
  overall: { avg: number; std: number; min: number; max: number };
  cats: Record<string, { avg: number; std: number }>;
  topEventCounts: Record<string, number>;
}

function calcStats(days: DailyFortune[]): Stats {
  const overall = days.map(d => d.scores.overall);
  const cats: Record<string, { avg: number; std: number }> = {};
  for (const c of DOM) {
    const vals = days.map(d => d.scores[c]);
    cats[c] = { avg: r1(avg(vals)), std: r1(stdev(vals)) };
  }

  // topEvents 집계 — AI Request 필터 기준 (saju.star.* 제외 후)
  const eventCounts: Record<string, number> = {};
  for (const d of days) {
    const req = buildAiDailyRequest(d);
    const allEvents = [
      ...req.majorEvents,
      ...req.minorEvents,
      ...req.backgroundEvents,
    ];
    for (const e of allEvents) {
      // key가 없으면 label을 임시 key로 사용
      const key = (e as unknown as { key?: string }).key ?? `label:${e.label}`;
      eventCounts[key] = (eventCounts[key] ?? 0) + 1;
    }
    // persisted.topEvents에서 saju.star.* 잔존 여부도 별도 집계
    const rawTopEvents = d.persisted?.topEvents ?? [];
    for (const e of rawTopEvents) {
      if (e.key.startsWith("saju.star.")) {
        const rawKey = `raw:${e.key}`;
        eventCounts[rawKey] = (eventCounts[rawKey] ?? 0) + 1;
      }
    }
  }

  return {
    overall: {
      avg: r1(avg(overall)), std: r1(stdev(overall)),
      min: Math.min(...overall), max: Math.max(...overall),
    },
    cats,
    topEventCounts: eventCounts,
  };
}

async function main() {
  console.log("=== 특별성 분리 검증: LEGACY vs DEFAULT ===");
  console.log(`기간: 2026-03-01 ~ ${N_DAYS}일\n`);

  console.log("프로필 빌드 중...");
  const profileData = await Promise.all(PROFILES.map(buildPD));
  console.log("완료\n");

  // 두 모드 실행
  const legacyStats: Stats[] = [];
  const defaultStats: Stats[] = [];

  for (const pd of profileData) {
    legacyStats.push(calcStats(runDays(pd, LEGACY_SAJU_FLAGS)));
    defaultStats.push(calcStats(runDays(pd, DEFAULT_SAJU_FLAGS)));
  }

  // ── 검증 1: overall avg / inter-user std ─────────────────────────────────
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log("검증 1: overall avg / inter-user std");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  const legacyInterStd  = r1(stdev(legacyStats.map(s => s.overall.avg)));
  const defaultInterStd = r1(stdev(defaultStats.map(s => s.overall.avg)));
  const reduction = r1(((legacyInterStd - defaultInterStd) / legacyInterStd) * 100);

  console.log(`${"".padEnd(20)} ${"A".padStart(12)} ${"B".padStart(12)} ${"C".padStart(12)}  inter-std`);
  console.log("─".repeat(66));

  const legAvgs    = legacyStats.map(s => s.overall.avg);
  const defAvgs    = defaultStats.map(s => s.overall.avg);
  const legStds    = legacyStats.map(s => s.overall.std);
  const defStds    = defaultStats.map(s => s.overall.std);

  const fmtCell = (a: number, s: number) => `${a}±${s}`.padStart(12);
  console.log(`${"LEGACY (특별성 포함)".padEnd(20)} ${legAvgs.map((a,i) => fmtCell(a,legStds[i])).join(" ")}  ${legacyInterStd}`);
  console.log(`${"DEFAULT (특별성 분리)".padEnd(20)} ${defAvgs.map((a,i) => fmtCell(a,defStds[i])).join(" ")}  ${defaultInterStd}`);
  console.log(`${"변화".padEnd(20)} ${defAvgs.map((a,i)=>{const d=r1(a-legAvgs[i]);return `${d>=0?"+":""}${d}`.padStart(12);}).join(" ")}  ${r1(defaultInterStd-legacyInterStd)} (${reduction}% 감소)`);

  // ── 검증 2: 카테고리 avg/std ──────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log("검증 2: 카테고리 avg / std 변화 (LEGACY → DEFAULT)");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  for (const [pi, pd] of profileData.entries()) {
    console.log(`  ${pd.label}`);
    console.log(`  ${"카테고리".padEnd(12)} ${"LEGACY avg±std".padEnd(14)} ${"DEFAULT avg±std".padEnd(14)} 변화`);
    console.log("  " + "─".repeat(52));
    for (const cat of DOM) {
      const L = legacyStats[pi].cats[cat];
      const D = defaultStats[pi].cats[cat];
      const dAvg = r1(D.avg - L.avg);
      const dStd = r1(D.std - L.std);
      const sign = (v: number) => v > 0 ? "+" : "";
      console.log(`  ${padR(cat,12)} ${`${L.avg}±${L.std}`.padEnd(14)} ${`${D.avg}±${D.std}`.padEnd(14)} avg${sign(dAvg)}${dAvg} std${sign(dStd)}${dStd}`);
    }
    console.log();
  }

  // ── 검증 3: topEvents 변화 ────────────────────────────────────────────────
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log("검증 3: saju.star.* topEvents 변화 (소멸 확인)");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  const starKeys = [
    "saju.star.geobSal", "saju.star.baekHo",    "saju.star.hwaGae",
    "saju.star.doHwa",   "saju.star.yeokMa",     "saju.star.cheonDeok",
    "saju.star.wolDeok",
  ];

  for (const [pi, pd] of profileData.entries()) {
    console.log(`  ${pd.label}`);
    let anyFound = false;
    for (const key of starKeys) {
      const legCnt = legacyStats[pi].topEventCounts[key] ?? 0;
      const defCnt = defaultStats[pi].topEventCounts[key] ?? 0;
      const rawKey = `raw:${key}`;
      const rawCnt = defaultStats[pi].topEventCounts[rawKey] ?? 0;
      if (legCnt > 0 || defCnt > 0 || rawCnt > 0) {
        anyFound = true;
        const aiStatus = defCnt === 0 ? "✅ AI이벤트 소멸" : "⚠ AI이벤트 잔존";
        const rawStatus = rawCnt > 0 ? `(persisted.topEvents 잔존 ${rawCnt}건, stateAtom경로)` : "(persisted 소멸)";
        console.log(`    ${padR(key, 26)} LEGACY=${pad(legCnt,3)}  DEFAULT=${pad(defCnt,3)}  ${aiStatus} ${rawStatus}`);
      }
    }
    if (!anyFound) console.log("    (특별성 이벤트 없음)");
    console.log();
  }

  // ── 검증 4: AI Request 샘플 (profileSpecialStars 확인) ───────────────────
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log("검증 4: profileSpecialStars 생성 확인 + AI Request 샘플");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  for (const [pi, pd] of profileData.entries()) {
    const sampleDay = runDays(pd, DEFAULT_SAJU_FLAGS)[0];

    console.log(`  ${pd.label} — 2026-03-01`);

    // profileSpecialStars
    const pss = sampleDay.profileSpecialStars;
    if (pss && pss.length > 0) {
      console.log(`  profileSpecialStars: ${JSON.stringify(pss, null, 2).replace(/\n/g, "\n  ")}`);
    } else {
      console.log("  profileSpecialStars: [] (특별성 없음)");
    }

    // AI Request 요약
    const req = buildAiDailyRequest(sampleDay);
    console.log(`  AI Request.profileSpecialStars: ${JSON.stringify(req.profileSpecialStars ?? null)}`);
    console.log(`  AI Request.overall: ${req.overall}`);
    console.log(`  AI Request.majorEvents: ${JSON.stringify(req.majorEvents.map(e=>e.label))}`);
    console.log();
  }

  // ── 검증 5: 총 정리 ───────────────────────────────────────────────────────
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log("검증 5: 종합 결과");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  console.log(`inter-user std: ${legacyInterStd} → ${defaultInterStd}  (${reduction}% 감소)`);

  // AI Request events 기준 소멸 확인 (saju.star.* 필터 적용됨)
  const allStarGoneAI = profileData.every((_, pi) =>
    starKeys.every(k => (defaultStats[pi].topEventCounts[k] ?? 0) === 0)
  );
  // persisted.topEvents에는 stateAtom 경로(살:)로 여전히 존재 — 정상
  console.log(`saju.star.* AI Request 이벤트 소멸: ${allStarGoneAI ? "✅ 확인" : "⚠ 일부 잔존"}`);
  console.log("  (persisted.topEvents에는 stateAtom 0.3× 경로로 존재 — 설계 의도)")

  const allHavePss = profileData.every((_, pi) => {
    const day = runDays(profileData[pi], DEFAULT_SAJU_FLAGS)[0];
    return day.profileSpecialStars !== undefined;
  });
  console.log(`profileSpecialStars 필드 생성: ${allHavePss ? "✅ 확인" : "❌ 누락"}`);

  console.log("\n✅ 검증 완료");
}

main().catch(console.error);
