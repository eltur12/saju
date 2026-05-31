/**
 * 원국 지지 충돌 패널티 검증
 * Usage: npx tsx scripts/verifyNatalPenalty.ts
 *
 * 비교: DEFAULT (현재) vs NO_NATAL_CONFLICT (패널티 제거)
 * 동일 10개 프로필 × 최근 10일 (2026-05-22 ~ 2026-05-31)
 * 추가: 패널티 값 자체 리포트 + "오늘의 변화" vs "고정 기준선" 평가
 */
import { calculateSajuProfile }   from "../src/utils/sajuCalculator";
import { buildZiweiProfile }       from "../src/utils/ziweiCalculator";
import { buildAstroProfile }       from "../src/utils/astroCalculator";
import { FortuneAggregator }       from "../src/engines/aggregator";
import { DEFAULT_ZIWEI_FLAGS }     from "../src/engines/ziweiEngine";
import {
  DEFAULT_SAJU_FLAGS,
  type SajuExperimentFlags,
} from "../src/engines/sajuEngine";
import type { DailyFortune }       from "../src/engines/aggregator";
import type { ScoreMap }           from "../src/engines/sajuEngine";

// ── 동일 10개 프로필 ──────────────────────────────────────────────────────────
const PROFILES = [
  { id:1,  label:"P01 (1962 M 寅月)", birth:{year:1962,month:2, day:14,hour:6, minute:0}, gender:"M" as const },
  { id:2,  label:"P02 (1970 F 辰月)", birth:{year:1970,month:4, day:3, hour:14,minute:0}, gender:"F" as const },
  { id:3,  label:"P03 (1975 M 午月)", birth:{year:1975,month:6, day:20,hour:10,minute:0}, gender:"M" as const },
  { id:4,  label:"P04 (1983 F 子月)", birth:{year:1983,month:12,day:5, hour:22,minute:0}, gender:"F" as const },
  { id:5,  label:"P05 (1988 M 酉月)", birth:{year:1988,month:9, day:9, hour:8, minute:0}, gender:"M" as const },
  { id:6,  label:"P06 (1993 F 卯月)", birth:{year:1993,month:3, day:15,hour:4, minute:0}, gender:"F" as const },
  { id:7,  label:"P07 (1997 M 未月)", birth:{year:1997,month:7, day:7, hour:12,minute:0}, gender:"M" as const },
  { id:8,  label:"P08 (2001 F 戌月)", birth:{year:2001,month:10,day:31,hour:18,minute:0}, gender:"F" as const },
  { id:9,  label:"P09 (1971 F 酉月)", birth:{year:1971,month:9, day:1, hour:20,minute:0}, gender:"F" as const },
  { id:10, label:"P10 (2005 M 申月)", birth:{year:2005,month:8, day:18,hour:16,minute:0}, gender:"M" as const },
];

const START  = new Date(2026, 4, 22);
const N_DAYS = 10;
const DOM: (keyof ScoreMap)[] = ["wealth","love","health","career","relations","study"];
const NO_NATAL_FLAGS: SajuExperimentFlags = { ...DEFAULT_SAJU_FLAGS, SKIP_NATAL_PENALTY: true };

// ── 유틸 ─────────────────────────────────────────────────────────────────────
function r1(v: number) { return Math.round(v * 10) / 10; }
function r2(v: number) { return Math.round(v * 100) / 100; }
function avg(a: number[]) { return a.reduce((s,x)=>s+x,0)/a.length; }
function stdev(a: number[]) {
  const m = avg(a); return Math.sqrt(a.reduce((s,x)=>s+(x-m)**2,0)/a.length);
}
function pad(s: string|number, w: number)  { return String(s).padStart(w); }
function padR(s: string|number, w: number) { return String(s).padEnd(w); }
function sign(v: number) { return v > 0 ? "+" : ""; }

function runDays(
  sp: ReturnType<typeof calculateSajuProfile>,
  zp: ReturnType<typeof buildZiweiProfile>,
  ap: Awaited<ReturnType<typeof buildAstroProfile>>,
  bd: Date,
  flags: SajuExperimentFlags,
): DailyFortune[] {
  const agg = new FortuneAggregator(sp, zp, ap, undefined, bd, true);
  const days: DailyFortune[] = [];
  for (let i = 0; i < N_DAYS; i++) {
    const d = new Date(START); d.setDate(START.getDate() + i);
    days.push(agg.getDailyFortune(d, DEFAULT_ZIWEI_FLAGS, flags));
  }
  return days;
}

function toStats(days: DailyFortune[]) {
  const ov = days.map(d => d.scores.overall);
  const cats: Record<string,number> = {};
  const catStds: Record<string,number> = {};
  for (const c of DOM) {
    const vals = days.map(d => d.scores[c]);
    cats[c]    = r1(avg(vals));
    catStds[c] = r1(stdev(vals));
  }
  return {
    avg: r1(avg(ov)), std: r1(stdev(ov)),
    min: Math.min(...ov), max: Math.max(...ov),
    cats, catStds,
  };
}

// ── 패널티 추출: DEFAULT - NO_NATAL 차이로 역산 ───────────────────────────────
// 10일 평균으로 안정화 (매일 동일 값이므로 평균 = 상수)
function extractPenaltyFromDiff(
  defDays: DailyFortune[],
  noDays:  DailyFortune[],
): number {
  // overall 기준 (모든 cat 동일 패널티이므로 overall ≈ cat avg shift)
  const defOv = avg(defDays.map(d => d.scores.overall));
  const noOv  = avg(noDays.map(d => d.scores.overall));
  return r1(defOv - noOv);
}

// "오늘의 변화" 기여도 측정: 일별 점수 표준편차
// 패널티는 상수 → 표준편차에 기여 없어야 함
// 검증: DEFAULT std ≈ NO_NATAL std 이면 패널티는 고정값
function isDailySignal(defStd: number, noStd: number): boolean {
  return Math.abs(defStd - noStd) > 0.3;
}

// ── 메인 ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("=== 원국 지지 충돌 패널티 검증 ===");
  console.log("비교: DEFAULT (현재) vs NO_NATAL_CONFLICT");
  console.log(`기간: 2026-05-22 ~ 2026-05-31 (${N_DAYS}일)\n`);

  console.log("프로필 빌드 및 실행 중...");

  interface Result {
    id: number; label: string;
    penalty: number;  // overall 기준 역산
    def: ReturnType<typeof toStats>;
    noNatal: ReturnType<typeof toStats>;
  }

  const results: Result[] = [];

  for (const p of PROFILES) {
    const { birth, gender } = p;
    const sp = calculateSajuProfile(birth.year, birth.month, birth.day, birth.hour, gender, undefined, birth.minute);
    const zp = buildZiweiProfile(birth.year, birth.month, birth.day, birth.hour, 2026, gender === "M");
    const ap = await buildAstroProfile(birth.year, birth.month, birth.day, birth.hour, undefined, undefined, birth.minute);
    const bd = new Date(birth.year, birth.month - 1, birth.day);

    const defDays    = runDays(sp, zp, ap, bd, DEFAULT_SAJU_FLAGS);
    const noNatDays  = runDays(sp, zp, ap, bd, NO_NATAL_FLAGS);
    const penalty    = extractPenaltyFromDiff(defDays, noNatDays);

    // factors.natal_fixed_penalty (원본 점수, 집계 전)
    const rawPenalty = defDays[0].reasonSources
      ? (defDays[0] as unknown as { balance_debug?: unknown })
      : null;
    // 간접 확인: same-day 비교로 추출
    const _ = rawPenalty;

    results.push({
      id: p.id, label: p.label,
      penalty,
      def:     toStats(defDays),
      noNatal: toStats(noNatDays),
    });
    process.stdout.write(`  ${p.label} → 패널티(역산) overall ${penalty >= 0 ? "+":""}${penalty}\n`);
  }

  console.log("\n완료\n");

  // ── 패널티 분포 테이블 ─────────────────────────────────────────────────────
  console.log("══════════════════════════════════════════════════════════════════════════");
  console.log("원국 패널티 분포 (역산값 — 클수록 충돌 많은 원국)");
  console.log("══════════════════════════════════════════════════════════════════════════\n");

  const sortedByPenalty = [...results].sort((a, b) => a.penalty - b.penalty);

  console.log(`${"프로필".padEnd(22)} ${"패널티(overall)".padStart(14)} ${"특성"}`);
  console.log("─".repeat(56));
  for (const r of sortedByPenalty) {
    const pv = r.penalty;
    const bar = pv < 0 ? "▼".repeat(Math.min(Math.round(Math.abs(pv)), 8)) : "▲".repeat(Math.min(Math.round(pv),8));
    const tag = pv < -3 ? "★ 강한 충돌" : pv < -1 ? "◇ 중간 충돌" : pv < 0 ? "· 약한 충돌" : "  패널티 없음";
    console.log(`${padR(r.label,22)} ${pad(`${pv>=0?"+":""}${pv}`,14)}  ${bar} ${tag}`);
  }

  // ── 프로필별 상세 결과 ────────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════════════════");
  console.log("프로필별 상세 결과");
  console.log("══════════════════════════════════════════════════════════════════════════\n");

  console.log(`${"프로필".padEnd(22)} ${"패널티".padStart(7)} ${"DEFAULT avg±std".padEnd(16)} ${"NO_NATAL avg±std".padEnd(16)} ${"avg변화".padStart(7)} ${"std변화".padStart(7)}`);
  console.log("─".repeat(82));

  for (const r of results) {
    const dAvg  = r1(r.noNatal.avg - r.def.avg);
    const dStd  = r1(r.noNatal.std - r.def.std);
    const arrow = dAvg > 0 ? "▲" : dAvg < 0 ? "▼" : "─";
    const defStr = `${r.def.avg}±${r.def.std}`;
    const noStr  = `${r.noNatal.avg}±${r.noNatal.std}`;
    console.log(`${padR(r.label,22)} ${pad(`${r.penalty>=0?"+":""}${r.penalty}`,7)} ${padR(defStr,16)} ${padR(noStr,16)} ${pad(`${sign(dAvg)}${dAvg}`,7)} ${pad(`${sign(dStd)}${dStd}`,7)} ${arrow}`);
  }

  // ── 요약 1: inter-user std ────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════════════════");
  console.log("요약 1: inter-user std 비교");
  console.log("══════════════════════════════════════════════════════════════════════════\n");

  const defAvgs    = results.map(r => r.def.avg);
  const noAvgs     = results.map(r => r.noNatal.avg);
  const defIStd    = r2(stdev(defAvgs));
  const noIStd     = r2(stdev(noAvgs));
  const iReduction = r1(((defIStd - noIStd) / defIStd) * 100);

  console.log(`10명 평균 (DEFAULT): ${r1(avg(defAvgs))}   범위: ${Math.min(...defAvgs)} ~ ${Math.max(...defAvgs)}`);
  console.log(`10명 평균 (NO_NATAL): ${r1(avg(noAvgs))}   범위: ${Math.min(...noAvgs)} ~ ${Math.max(...noAvgs)}`);
  console.log();
  console.log(`DEFAULT  inter-user std: ${defIStd}`);
  console.log(`NO_NATAL inter-user std: ${noIStd}`);
  console.log(`변화: ${r2(noIStd - defIStd) >= 0 ? "+" : ""}${r2(noIStd - defIStd)}  (${iReduction}% 감소)`);

  // ── 요약 2: 가장 큰 변화 TOP 3 ───────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════════════════");
  console.log("요약 2: 가장 큰 변화 프로필 TOP 3");
  console.log("══════════════════════════════════════════════════════════════════════════\n");

  const sortedByChange = [...results].sort((a,b) =>
    Math.abs(r1(b.noNatal.avg - b.def.avg)) - Math.abs(r1(a.noNatal.avg - a.def.avg))
  );

  for (const r of sortedByChange.slice(0, 3)) {
    const delta = r1(r.noNatal.avg - r.def.avg);
    console.log(`  ${r.label}`);
    console.log(`    avg 변화: ${sign(delta)}${delta}  (DEFAULT ${r.def.avg} → NO_NATAL ${r.noNatal.avg})`);
    console.log(`    원국 패널티: ${r.penalty >= 0 ? "+" : ""}${r.penalty} (역산)`);
    // 카테고리 최대 변화
    const catChanges = DOM.map(c => ({
      cat: c, delta: r1(r.noNatal.cats[c] - r.def.cats[c]),
    })).sort((a,b) => Math.abs(b.delta) - Math.abs(a.delta));
    console.log(`    카테고리 변화: ${catChanges.slice(0,3).map(x=>`${x.cat} ${sign(x.delta)}${x.delta}`).join(", ")}`);
    // std 변화 — 일별 신호 판단
    const stdChange = r1(r.noNatal.std - r.def.std);
    console.log(`    std 변화: ${sign(stdChange)}${stdChange} → ${Math.abs(stdChange) <= 0.3 ? "일별 변동성 불변 (패널티 = 고정값)" : "일별 변동성 변화 (패널티에 일별 요소 있음?)"}`);
    console.log();
  }

  // ── 요약 3: 변화 거의 없는 TOP 3 ─────────────────────────────────────────
  console.log("══════════════════════════════════════════════════════════════════════════");
  console.log("요약 3: 변화 거의 없는 프로필 TOP 3");
  console.log("══════════════════════════════════════════════════════════════════════════\n");

  const sortedByStable = [...results].sort((a,b) =>
    Math.abs(r1(a.noNatal.avg - a.def.avg)) - Math.abs(r1(b.noNatal.avg - b.def.avg))
  );

  for (const r of sortedByStable.slice(0, 3)) {
    const delta = r1(r.noNatal.avg - r.def.avg);
    console.log(`  ${r.label}`);
    console.log(`    avg 변화: ${sign(delta)}${delta}  (DEFAULT ${r.def.avg} → NO_NATAL ${r.noNatal.avg})`);
    console.log(`    원국 패널티: ${r.penalty >= 0 ? "+" : ""}${r.penalty} → ${Math.abs(r.penalty) <= 0.5 ? "패널티 거의 없음 (충돌 없는 원국)" : "패널티 있으나 효과 흡수됨"}`);
    console.log();
  }

  // ── 요약 4: 카테고리 avg/std 변화 ────────────────────────────────────────
  console.log("══════════════════════════════════════════════════════════════════════════");
  console.log("요약 4: 카테고리 avg/std 변화 (10명 평균)");
  console.log("══════════════════════════════════════════════════════════════════════════\n");

  console.log(`${"카테고리".padEnd(12)} ${"DEFAULT avg".padStart(11)} ${"NO_NATAL avg".padStart(12)} ${"avg변화".padStart(7)}  ${"inter-std 변화"}`);
  console.log("─".repeat(66));
  for (const cat of DOM) {
    const defCatAvg  = r1(avg(results.map(r => r.def.cats[cat])));
    const noCatAvg   = r1(avg(results.map(r => r.noNatal.cats[cat])));
    const defCatIStd = r2(stdev(results.map(r => r.def.cats[cat])));
    const noCatIStd  = r2(stdev(results.map(r => r.noNatal.cats[cat])));
    const dAvg = r1(noCatAvg - defCatAvg);
    const dStd = r2(noCatIStd - defCatIStd);
    console.log(`${padR(cat,12)} ${pad(defCatAvg,11)} ${pad(noCatAvg,12)} ${pad(`${sign(dAvg)}${dAvg}`,7)}  iStd ${defCatIStd} → ${noCatIStd} (${sign(dStd)}${dStd})`);
  }

  // ── "오늘의 변화" vs "고정 기준선" 평가 ───────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════════════════");
  console.log("핵심 평가: 원국 패널티는 '오늘의 변화' 신호인가 '평생 고정 기준선'인가?");
  console.log("══════════════════════════════════════════════════════════════════════════\n");

  // 각 프로필의 DEFAULT std vs NO_NATAL std 비교
  const stdDiffs = results.map(r => Math.abs(r1(r.noNatal.std - r.def.std)));
  const avgStdDiff = r1(avg(stdDiffs));
  const maxStdDiff = Math.max(...stdDiffs);

  console.log("일별 변동성(std) 변화 — 패널티가 상수라면 std는 변화 없어야 함:");
  console.log();
  console.log(`${"프로필".padEnd(22)} ${"DEFAULT std".padStart(11)} ${"NO_NATAL std".padStart(12)} ${"std변화".padStart(8)} ${"판단"}`);
  console.log("─".repeat(70));
  for (const r of results) {
    const dStd = r1(r.noNatal.std - r.def.std);
    const judgment = Math.abs(dStd) <= 0.2 ? "✅ 고정값" : Math.abs(dStd) <= 0.5 ? "△ 미미" : "⚠ 일별 요소 있음";
    console.log(`${padR(r.label,22)} ${pad(r.def.std,11)} ${pad(r.noNatal.std,12)} ${pad(`${sign(dStd)}${dStd}`,8)} ${judgment}`);
  }

  console.log(`\n10명 평균 std변화: ${avgStdDiff}  최대: ${maxStdDiff}`);
  console.log();

  const isFixed = avgStdDiff <= 0.3;
  if (isFixed) {
    console.log("판정: ✅ 원국 패널티는 '평생 고정 기준선'");
    console.log("  - 패널티 제거 시 avg만 이동, std는 거의 불변");
    console.log("  - 날마다 같은 양을 더하거나 빼는 상수 오프셋");
    console.log("  - 오늘의 운세 흐름(변동)에 전혀 기여하지 않음");
  } else {
    console.log("판정: ⚠ 일부 일별 요소 포함 가능성 있음 — 추가 확인 필요");
  }

  // ── 누적 inter-std 감소 요약 ──────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════════════════");
  console.log("누적 inter-std 감소 진행 (단계별)");
  console.log("══════════════════════════════════════════════════════════════════════════\n");

  console.log("  단계                       inter-user std   감소");
  console.log("  ─────────────────────────────────────────────────");
  console.log("  LEGACY (모든 정적 요소 포함)       6.13         기준");
  console.log(`  특별성 분리 후 (DEFAULT)           ${defIStd}         -${r2(6.13 - defIStd)} (${r1((6.13 - defIStd)/6.13*100)}%)`);
  console.log(`  원국패널티 추가 제거 (NO_NATAL)     ${noIStd}         -${r2(6.13 - noIStd)} (${r1((6.13 - noIStd)/6.13*100)}%)`);
  console.log();

  // ── 권고 ──────────────────────────────────────────────────────────────────
  console.log("══════════════════════════════════════════════════════════════════════════");
  console.log("권고: 유지 / 감쇠 / 제거 후 AI 배경 정보 이동");
  console.log("══════════════════════════════════════════════════════════════════════════\n");

  const effectSize = r2(defIStd - noIStd);

  console.log(`inter-user std 추가 감소: ${effectSize}점`);
  console.log(`패널티 성격: ${isFixed ? "평생 고정 상수 오프셋" : "일별 요소 혼재"}`);
  console.log();

  if (effectSize >= 1.0) {
    console.log("권고: ✅ 제거 후 AI 배경 정보 이동");
    console.log("  이유: inter-std 감소 효과가 크고, 패널티가 순수 상수 오프셋이므로");
    console.log("  점수에서 제거 → 원국 충돌 구조를 profileNatalConflict로 AI에 전달");
    console.log("  단, 원국의 '취약점'은 AI 해석에서 배경 정보로 활용 가능");
  } else if (effectSize >= 0.3) {
    console.log("권고: ⚠ 감쇠 (현재 30% → 15% 또는 10%)");
    console.log("  이유: 효과가 있지만 규모가 작아 완전 제거보다 감쇠로 시작하는 것이 안전");
    console.log("  점수 구조 변경 범위를 최소화하면서 편향 일부 해소 가능");
  } else {
    console.log("권고: 유지");
    console.log("  이유: inter-std 감소 효과가 미미하여 제거 시 이익 대비 구조 변경 비용이 큼");
    console.log("  현재 profileBaselineLayer로 equalizer 역할이 충분히 수행 중");
  }

  console.log("\n✅ 분석 완료");
}

main().catch(console.error);
