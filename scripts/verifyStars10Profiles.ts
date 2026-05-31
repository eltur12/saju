/**
 * 특별성 분리 확장 검증 — 10개 프로필 × 최근 10일
 * Usage: npx tsx scripts/verifyStars10Profiles.ts
 *
 * 조건: 성별/출생년도/사주구조/특별성 다양화
 * 기간: 2026-05-22 ~ 2026-05-31 (10일)
 * 비교: LEGACY (특별성 포함) vs DEFAULT (특별성 분리)
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
import type { DailyFortune }       from "../src/engines/aggregator";
import type { ScoreMap }           from "../src/engines/sajuEngine";

// ── 10개 프로필 ───────────────────────────────────────────────────────────────
// 성별·출생년도·사주구조·특별성 다양화를 위해 임의 선정
const PROFILES = [
  // [1] 1960년대 남성 — 子年생, 대운 전환기
  { id: 1,  label: "P01 (1962 M 寅月)",   birth: { year:1962, month:2,  day:14, hour:6,  minute:0 }, gender:"M" as const },
  // [2] 1970년대 여성 — 戌년생, 화개살 가능성
  { id: 2,  label: "P02 (1970 F 辰月)",   birth: { year:1970, month:4,  day:3,  hour:14, minute:0 }, gender:"F" as const },
  // [3] 1975 남성 — 卯年, 도화살 가능성
  { id: 3,  label: "P03 (1975 M 午月)",   birth: { year:1975, month:6,  day:20, hour:10, minute:0 }, gender:"M" as const },
  // [4] 1983 여성 — 亥年, 역마살 가능성
  { id: 4,  label: "P04 (1983 F 子月)",   birth: { year:1983, month:12, day:5,  hour:22, minute:0 }, gender:"F" as const },
  // [5] 1988 남성 — 辰年 (기존 A와 다른 월)
  { id: 5,  label: "P05 (1988 M 酉月)",   birth: { year:1988, month:9,  day:9,  hour:8,  minute:0 }, gender:"M" as const },
  // [6] 1993 여성 — 酉年, 도화살+역마살 가능성
  { id: 6,  label: "P06 (1993 F 卯月)",   birth: { year:1993, month:3,  day:15, hour:4,  minute:0 }, gender:"F" as const },
  // [7] 1997 남성 — 丑年, 화개살 가능성
  { id: 7,  label: "P07 (1997 M 未月)",   birth: { year:1997, month:7,  day:7,  hour:12, minute:0 }, gender:"M" as const },
  // [8] 2001 여성 — 巳年, 겁살 가능성
  { id: 8,  label: "P08 (2001 F 戌月)",   birth: { year:2001, month:10, day:31, hour:18, minute:0 }, gender:"F" as const },
  // [9] 1971 여성 — 亥年, 역마+겁살 가능성
  { id: 9,  label: "P09 (1971 F 酉月)",   birth: { year:1971, month:9,  day:1,  hour:20, minute:0 }, gender:"F" as const },
  // [10] 2005 남성 — 酉年, 도화살 가능성
  { id: 10, label: "P10 (2005 M 申月)",   birth: { year:2005, month:8,  day:18, hour:16, minute:0 }, gender:"M" as const },
];

const START  = new Date(2026, 4, 22);  // 2026-05-22
const N_DAYS = 10;
const DOM: (keyof ScoreMap)[] = ["wealth","love","health","career","relations","study"];

// ── 유틸 ─────────────────────────────────────────────────────────────────────
function r1(v: number) { return Math.round(v * 10) / 10; }
function r2(v: number) { return Math.round(v * 100) / 100; }
function avg(a: number[]) { return a.reduce((s,x)=>s+x,0)/a.length; }
function stdev(a: number[]) {
  const m = avg(a);
  return Math.sqrt(a.reduce((s,x)=>s+(x-m)**2,0)/a.length);
}
function pad(s: string|number, w: number)  { return String(s).padStart(w); }
function padR(s: string|number, w: number) { return String(s).padEnd(w); }
function sign(v: number) { return v >= 0 ? "+" : ""; }

// ── 빌드 & 실행 ───────────────────────────────────────────────────────────────
interface ProfileResult {
  id: number;
  label: string;
  stars: Array<{ key: string; label: string; polarity: string }>;
  legacy: { avg: number; std: number; min: number; max: number; cats: Record<string,number> };
  def:    { avg: number; std: number; min: number; max: number; cats: Record<string,number> };
}

function runDays(
  sajuProfile: ReturnType<typeof calculateSajuProfile>,
  ziweiProfile: ReturnType<typeof buildZiweiProfile>,
  astroProfile: Awaited<ReturnType<typeof buildAstroProfile>>,
  birthDate: Date,
  flags: SajuExperimentFlags,
): DailyFortune[] {
  const agg = new FortuneAggregator(sajuProfile, ziweiProfile, astroProfile, undefined, birthDate, true);
  const days: DailyFortune[] = [];
  for (let i = 0; i < N_DAYS; i++) {
    const d = new Date(START);
    d.setDate(START.getDate() + i);
    days.push(agg.getDailyFortune(d, DEFAULT_ZIWEI_FLAGS, flags));
  }
  return days;
}

function toStats(days: DailyFortune[]) {
  const overall = days.map(d => d.scores.overall);
  const cats: Record<string,number> = {};
  for (const c of DOM) {
    cats[c] = r1(avg(days.map(d => d.scores[c])));
  }
  return {
    avg: r1(avg(overall)),
    std: r1(stdev(overall)),
    min: Math.min(...overall),
    max: Math.max(...overall),
    cats,
  };
}

async function main() {
  console.log("=== 특별성 분리 확장 검증: 10개 프로필 × 최근 10일 ===");
  console.log("기간: 2026-05-22 ~ 2026-05-31\n");

  console.log("프로필 빌드 중...");
  const results: ProfileResult[] = [];

  for (const p of PROFILES) {
    const { birth, gender } = p;
    const sajuProfile  = calculateSajuProfile(birth.year, birth.month, birth.day, birth.hour, gender, undefined, birth.minute);
    const ziweiProfile = buildZiweiProfile(birth.year, birth.month, birth.day, birth.hour, 2026, gender === "M");
    const astroProfile = await buildAstroProfile(birth.year, birth.month, birth.day, birth.hour, undefined, undefined, birth.minute);
    const birthDate    = new Date(birth.year, birth.month - 1, birth.day);

    const legacyDays = runDays(sajuProfile, ziweiProfile, astroProfile, birthDate, LEGACY_SAJU_FLAGS);
    const defDays    = runDays(sajuProfile, ziweiProfile, astroProfile, birthDate, DEFAULT_SAJU_FLAGS);

    const stars = defDays[0].profileSpecialStars ?? [];

    results.push({
      id: p.id,
      label: p.label,
      stars,
      legacy: toStats(legacyDays),
      def:    toStats(defDays),
    });
    process.stdout.write(`  ${p.label} → 특별성: [${stars.map(s=>s.label).join(",")||"없음"}]\n`);
  }

  console.log("\n완료\n");

  // ── 프로필별 상세 결과 ───────────────────────────────────────────────────────
  console.log("══════════════════════════════════════════════════════════════════════════");
  console.log("프로필별 상세 결과");
  console.log("══════════════════════════════════════════════════════════════════════════\n");

  console.log(`${"프로필".padEnd(22)} ${"특별성".padEnd(22)} ${"LEGACY avg±std min max".padEnd(22)} ${"DEFAULT avg±std min max".padEnd(22)} ${"avg변화"}`);
  console.log("─".repeat(102));

  for (const r of results) {
    const starStr = r.stars.length
      ? r.stars.map(s => `${s.label}(${s.polarity[0]})`).join(" ")
      : "없음";
    const legStr = `${r.legacy.avg}±${r.legacy.std} [${r.legacy.min}-${r.legacy.max}]`;
    const defStr = `${r.def.avg}±${r.def.std} [${r.def.min}-${r.def.max}]`;
    const delta  = r1(r.def.avg - r.legacy.avg);
    const arrow  = delta > 0 ? "▲" : delta < 0 ? "▼" : "─";
    console.log(`${padR(r.label,22)} ${padR(starStr,22)} ${padR(legStr,24)} ${padR(defStr,24)} ${sign(delta)}${delta} ${arrow}`);
  }

  // ── 전체 요약 1: inter-user std ──────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════════════════");
  console.log("요약 1: 10명 inter-user std 비교");
  console.log("══════════════════════════════════════════════════════════════════════════\n");

  const legacyAvgs  = results.map(r => r.legacy.avg);
  const defaultAvgs = results.map(r => r.def.avg);
  const legInterStd = r2(stdev(legacyAvgs));
  const defInterStd = r2(stdev(defaultAvgs));
  const reduction   = r1(((legInterStd - defInterStd) / legInterStd) * 100);

  console.log(`10명 평균 점수 (LEGACY): ${r1(avg(legacyAvgs))}   범위: ${Math.min(...legacyAvgs)} ~ ${Math.max(...legacyAvgs)}`);
  console.log(`10명 평균 점수 (DEFAULT): ${r1(avg(defaultAvgs))}   범위: ${Math.min(...defaultAvgs)} ~ ${Math.max(...defaultAvgs)}`);
  console.log();
  console.log(`LEGACY  inter-user std: ${legInterStd}`);
  console.log(`DEFAULT inter-user std: ${defInterStd}`);
  console.log(`변화: ${defInterStd - legInterStd >= 0 ? "+" : ""}${r2(defInterStd - legInterStd)}  (${reduction}% ${reduction < 0 ? "감소" : "증가"})`);

  // ── 요약 2: 변화 TOP 3 ────────────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════════════════");
  console.log("요약 2: 가장 큰 변화 프로필 TOP 3");
  console.log("══════════════════════════════════════════════════════════════════════════\n");

  const sortedByChange = [...results]
    .sort((a, b) => Math.abs(r1(b.def.avg - b.legacy.avg)) - Math.abs(r1(a.def.avg - a.legacy.avg)));

  for (const r of sortedByChange.slice(0, 3)) {
    const delta = r1(r.def.avg - r.legacy.avg);
    console.log(`  ${r.label}`);
    console.log(`    avg 변화: ${sign(delta)}${delta}  (LEGACY ${r.legacy.avg} → DEFAULT ${r.def.avg})`);
    console.log(`    특별성: ${r.stars.length ? r.stars.map(s=>`${s.label}[${s.polarity}]`).join(", ") : "없음"}`);

    if (r.stars.length === 0) {
      console.log("    원인: 특별성 없음에도 변화 발생 → 다른 정적 요소(원국패널티 등) 영향");
    } else {
      const negStars = r.stars.filter(s => s.polarity === "negative");
      const posStars = r.stars.filter(s => s.polarity === "positive");
      const mixStars = r.stars.filter(s => s.polarity === "mixed");
      if (negStars.length > 0 && delta > 0) {
        console.log(`    원인: 부정 특별성(${negStars.map(s=>s.label).join(", ")}) 제거 → 매일 가산되던 패널티 해소`);
      } else if (posStars.length > 0 && delta < 0) {
        console.log(`    원인: 긍정 특별성(${posStars.map(s=>s.label).join(", ")}) 제거 → 매일 가산되던 보너스 해소`);
      } else if (negStars.length > 0 && posStars.length > 0) {
        console.log(`    원인: 부정+긍정 특별성 중첩 → 합산 방향에 따라 변화`);
      } else if (mixStars.length > 0) {
        console.log(`    원인: 복합 특별성(${mixStars.map(s=>s.label).join(", ")}) 제거 → 도메인별 편향 해소`);
      }
    }
    // 카테고리별 최대 변화
    const catChanges = DOM.map(c => ({
      cat: c,
      delta: r1(r.def.cats[c] - r.legacy.cats[c]),
    })).sort((a,b) => Math.abs(b.delta) - Math.abs(a.delta));
    const top2 = catChanges.slice(0, 2);
    console.log(`    카테고리 최대변화: ${top2.map(x => `${x.cat} ${sign(x.delta)}${x.delta}`).join(", ")}`);
    console.log();
  }

  // ── 요약 3: 변화 거의 없는 TOP 3 ─────────────────────────────────────────────
  console.log("══════════════════════════════════════════════════════════════════════════");
  console.log("요약 3: 변화 거의 없는 프로필 TOP 3");
  console.log("══════════════════════════════════════════════════════════════════════════\n");

  const sortedByStability = [...results]
    .sort((a, b) => Math.abs(r1(a.def.avg - a.legacy.avg)) - Math.abs(r1(b.def.avg - b.legacy.avg)));

  for (const r of sortedByStability.slice(0, 3)) {
    const delta = r1(r.def.avg - r.legacy.avg);
    console.log(`  ${r.label}`);
    console.log(`    avg 변화: ${sign(delta)}${delta}  (LEGACY ${r.legacy.avg} → DEFAULT ${r.def.avg})`);
    console.log(`    특별성: ${r.stars.length ? r.stars.map(s=>`${s.label}[${s.polarity}]`).join(", ") : "없음"}`);
    if (r.stars.length === 0) {
      console.log("    원인: 특별성 없음 → 제거할 직접 점수 없음");
    } else {
      const negScore = r.stars.filter(s=>s.polarity==="negative").length;
      const posScore = r.stars.filter(s=>s.polarity==="positive").length;
      if (negScore > 0 && posScore > 0) {
        console.log("    원인: 부정+긍정 특별성이 상호 상쇄 → 합산 순효과 작음");
      } else if (r.stars.every(s => s.polarity === "mixed")) {
        console.log("    원인: mixed 특별성은 카테고리별로 상쇄 → overall 변화 작음");
      } else {
        console.log("    원인: 특별성 기여가 spread compression 후 소폭만 반영됨");
      }
    }
    console.log();
  }

  // ── 요약 4: 카테고리 평균 변화 ───────────────────────────────────────────────
  console.log("══════════════════════════════════════════════════════════════════════════");
  console.log("요약 4: 카테고리 평균 변화 (10명 평균, LEGACY → DEFAULT)");
  console.log("══════════════════════════════════════════════════════════════════════════\n");

  console.log(`${"카테고리".padEnd(12)} ${"LEGACY avg".padStart(10)} ${"DEFAULT avg".padStart(11)} ${"변화".padStart(7)}  분포`);
  console.log("─".repeat(52));

  for (const cat of DOM) {
    const legCatAvg = r1(avg(results.map(r => r.legacy.cats[cat])));
    const defCatAvg = r1(avg(results.map(r => r.def.cats[cat])));
    const delta = r1(defCatAvg - legCatAvg);
    const bar = delta > 0
      ? "▲".repeat(Math.min(Math.round(Math.abs(delta)), 6))
      : delta < 0 ? "▼".repeat(Math.min(Math.round(Math.abs(delta)), 6))
      : "─";
    console.log(`${padR(cat,12)} ${pad(legCatAvg,10)} ${pad(defCatAvg,11)} ${pad(`${sign(delta)}${delta}`,7)}  ${bar}`);
  }

  // 카테고리별 inter-user std 변화
  console.log("\n카테고리별 inter-user std 변화 (10명 기준):");
  console.log(`${"카테고리".padEnd(12)} ${"LEGACY std".padStart(10)} ${"DEFAULT std".padStart(11)} ${"변화".padStart(7)}`);
  console.log("─".repeat(42));
  for (const cat of DOM) {
    const legStd = r2(stdev(results.map(r => r.legacy.cats[cat])));
    const defStd = r2(stdev(results.map(r => r.def.cats[cat])));
    const delta  = r2(defStd - legStd);
    console.log(`${padR(cat,12)} ${pad(legStd,10)} ${pad(defStd,11)} ${pad(`${sign(delta)}${delta}`,7)}`);
  }

  // ── 요약 5: 결론 ─────────────────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════════════════");
  console.log("요약 5: 결론");
  console.log("══════════════════════════════════════════════════════════════════════════\n");

  // 특별성 보유 여부별 분류
  const withStars    = results.filter(r => r.stars.length > 0);
  const withoutStars = results.filter(r => r.stars.length === 0);
  const withNeg      = results.filter(r => r.stars.some(s => s.polarity === "negative"));
  const withPos      = results.filter(r => r.stars.some(s => s.polarity === "positive"));

  const avgDeltaWithStars    = withStars.length
    ? r1(avg(withStars.map(r => Math.abs(r1(r.def.avg - r.legacy.avg))))) : 0;
  const avgDeltaWithoutStars = withoutStars.length
    ? r1(avg(withoutStars.map(r => Math.abs(r1(r.def.avg - r.legacy.avg))))) : 0;

  console.log(`특별성 보유 프로필 수: ${withStars.length}명  /  없음: ${withoutStars.length}명`);
  console.log(`  부정 특별성 보유: ${withNeg.length}명 → avg 변화량 평균 ${avgDeltaWithStars}점`);
  console.log(`  긍정 특별성 보유: ${withPos.length}명`);
  console.log(`  특별성 없음: ${withoutStars.length}명 → avg 변화량 평균 ${avgDeltaWithoutStars}점`);
  console.log();

  console.log(`A/B/C 결과(inter-std 24.4% 감소)가 일반적 현상인지 판단:`);
  console.log(`  10명 inter-std: ${legInterStd} → ${defInterStd}  (${reduction}% 변화)`);

  if (Math.abs(Number(reduction)) >= 15) {
    console.log("  ✅ A/B/C와 유사한 규모의 inter-std 감소 → 일반적 현상으로 판단 가능");
    console.log("  ✅ 특별성 분리 효과는 특정 프로필에 편중되지 않음");
  } else if (Math.abs(Number(reduction)) >= 5) {
    console.log("  ⚠  A/B/C보다 효과 작음 → 부분적으로 일반적, 프로필 구성에 따라 차이");
  } else {
    console.log("  ❌ A/B/C 결과가 특정 프로필 조합에 의한 효과일 가능성 있음");
  }

  // 특별성 없는 프로필도 변화 있으면 note
  if (withoutStars.length > 0 && avgDeltaWithoutStars > 0.5) {
    console.log(`\n  ⚠  특별성 없는 프로필도 avg 변화 ${avgDeltaWithoutStars}점 관찰됨`);
    console.log("     원인: 특별성 분리가 spread compression에 영향 → 전체 점수 분포 미세 변화");
  }

  // 개별 대표 특별성 요약
  console.log("\n특별성별 avg 변화 요약 (해당 특별성 보유자만):");
  const starGroups = ["겁살","백호살","화개살","도화살","역마살","천덕귀인","월덕귀인"];
  for (const star of starGroups) {
    const owners = results.filter(r => r.stars.some(s => s.label === star));
    if (owners.length > 0) {
      const avgChange = r1(avg(owners.map(r => r1(r.def.avg - r.legacy.avg))));
      console.log(`  ${padR(star,10)} 보유: ${owners.length}명  avg변화 ${sign(avgChange)}${avgChange}점  (${owners.map(r=>r.id).join(",")}번 프로필)`);
    }
  }

  console.log("\n✅ 분석 완료");
}

main().catch(console.error);
