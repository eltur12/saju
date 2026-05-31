/**
 * 변동성(std/range) 분포 분석
 * Usage: npx tsx scripts/analyzeVariability.ts
 *
 * n67p5_profile_summary.csv + n67p5_detail.csv 사용
 */
import * as fs from "node:fs";
import * as path from "node:path";

const DIR   = path.join("scripts", "output");
const PFILE = path.join(DIR, "n67p5_profile_summary.csv");
const DFILE = path.join(DIR, "n67p5_detail.csv");

// ── 프로필 요약 로드 ────────────────────────────────────────────────────────
interface ProfRow {
  label:  string;
  avg:    number;
  std:    number;
  min:    number;
  max:    number;
  range:  number;
  b85p:   number; // %
  b7584:  number;
  b6174:  number;
  b60m:   number;
}

function loadProfiles(): ProfRow[] {
  const lines = fs.readFileSync(PFILE, "utf8").split("\n");
  const rows: ProfRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].trim().split(",");
    if (c.length < 14) continue;
    rows.push({
      label:  c[0],
      avg:    Number(c[3]),
      std:    Number(c[4]),
      min:    Number(c[5]),
      max:    Number(c[6]),
      range:  Number(c[7]),
      b85p:   parseInt(c[10]),
      b7584:  parseInt(c[11]),
      b6174:  parseInt(c[12]),
      b60m:   parseInt(c[13]),
    });
  }
  return rows;
}

// ── 일별 상세 로드 (가상 실험용) ───────────────────────────────────────────
interface DayRow { profile: string; display: number; }

function loadDays(): DayRow[] {
  const lines = fs.readFileSync(DFILE, "utf8").split("\n");
  const rows: DayRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].trim().split(",");
    if (c.length < 5) continue;
    rows.push({ profile: c[1], display: Number(c[4]) });
  }
  return rows;
}

// ── 유틸 ────────────────────────────────────────────────────────────────────
function r1(v: number) { return Math.round(v * 10) / 10; }
function r2(v: number) { return Math.round(v * 100) / 100; }
function avg(a: number[]) { return a.reduce((s,x)=>s+x,0)/a.length; }
function std(a: number[]) {
  const m = avg(a);
  return Math.sqrt(a.reduce((s,x)=>s+(x-m)**2,0)/a.length);
}
function corr(x: number[], y: number[]) {
  const mx = avg(x), my = avg(y);
  const num = x.reduce((s,xi,i) => s + (xi-mx)*(y[i]-my), 0);
  const den = Math.sqrt(x.reduce((s,xi)=>s+(xi-mx)**2,0) * y.reduce((s,yi)=>s+(yi-my)**2,0));
  return den === 0 ? 0 : r2(num / den);
}
function pad(s: string|number, w: number) { return String(s).padStart(w); }
function bar(n: number, scale = 1) { return "█".repeat(Math.max(0, Math.round(n * scale))); }

// ── 배지 기준 ────────────────────────────────────────────────────────────────
function badge(s: number) {
  if (s >= 85) return "아주좋음";
  if (s >= 75) return "좋음";
  if (s >= 61) return "보통";
  return "주의";
}

function main() {
  if (!fs.existsSync(PFILE) || !fs.existsSync(DFILE)) {
    console.error("CSV 파일 없음. 먼저 npx tsx scripts/verifyNorm67Plus5.ts 실행 필요");
    process.exit(1);
  }

  const profs = loadProfiles();
  const days  = loadDays();
  const N = profs.length;

  const line = "══════════════════════════════════════════════════════════════";
  const dash = "──────────────────────────────────────────────────────────────";

  console.log(`\n=== 변동성(std/range) 분포 분석 ===`);
  console.log(`대상: ${N}개 프로필 × 180일\n`);

  // ── 1. std 분포 ──────────────────────────────────────────────────────────
  console.log(line);
  console.log("항목 1: std 분포");
  console.log(line + "\n");

  const stdBuckets: [string, (s:number)=>boolean][] = [
    ["std < 4",   s => s <  4],
    ["std 4~5",   s => s >= 4  && s < 5],
    ["std 5~6",   s => s >= 5  && s < 6],
    ["std 6~7",   s => s >= 6  && s < 7],
    ["std 7~8",   s => s >= 7  && s < 8],
    ["std 8~9",   s => s >= 8  && s < 9],
    ["std 9~10",  s => s >= 9  && s < 10],
    ["std 10~11", s => s >= 10 && s < 11],
    ["std 11+",   s => s >= 11],
  ];
  for (const [label, fn] of stdBuckets) {
    const cnt = profs.filter(p => fn(p.std)).length;
    const pct = Math.round(cnt / N * 100);
    console.log(`  ${label.padEnd(12)} : ${pad(cnt, 3)}명  (${pad(pct,3)}%)  ${bar(cnt, 2)}`);
  }
  const stds = profs.map(p => p.std);
  console.log(`\n  std 평균: ${r1(avg(stds))}  min: ${Math.min(...stds)}  max: ${Math.max(...stds)}`);
  console.log(`  std < 6:  ${profs.filter(p=>p.std<6).length}명  (${Math.round(profs.filter(p=>p.std<6).length/N*100)}%)`);
  console.log(`  std > 10: ${profs.filter(p=>p.std>10).length}명  (${Math.round(profs.filter(p=>p.std>10).length/N*100)}%)`);

  // ── 2. range 분포 ─────────────────────────────────────────────────────────
  console.log("\n" + line);
  console.log("항목 2: range 분포");
  console.log(line + "\n");

  const rangeBuckets: [string, (r:number)=>boolean][] = [
    ["range < 20",  r => r <  20],
    ["range 20~25", r => r >= 20 && r < 25],
    ["range 25~30", r => r >= 25 && r < 30],
    ["range 30~35", r => r >= 30 && r < 35],
    ["range 35~40", r => r >= 35 && r < 40],
    ["range 40~45", r => r >= 40 && r < 45],
    ["range 45+",   r => r >= 45],
  ];
  for (const [label, fn] of rangeBuckets) {
    const cnt = profs.filter(p => fn(p.range)).length;
    const pct = Math.round(cnt / N * 100);
    console.log(`  ${label.padEnd(14)} : ${pad(cnt, 3)}명  (${pad(pct,3)}%)  ${bar(cnt, 2)}`);
  }
  const ranges = profs.map(p => p.range);
  console.log(`\n  range 평균: ${r1(avg(ranges))}  min: ${Math.min(...ranges)}  max: ${Math.max(...ranges)}`);

  // ── 3. 저변동 프로필 (std < 6) ────────────────────────────────────────────
  console.log("\n" + line);
  console.log("항목 3: 저변동 프로필 (std < 6)");
  console.log(line + "\n");

  const lowVol = profs.filter(p => p.std < 6).sort((a,b) => a.std - b.std);
  console.log(`  총 ${lowVol.length}명\n`);
  console.log(`  ${"프로필".padEnd(32)} ${"avg".padStart(6)} ${"std".padStart(6)} ${"min".padStart(5)} ${"max".padStart(5)} ${"range".padStart(7)}`);
  console.log("  " + dash.slice(0, 62));
  for (const p of lowVol) {
    console.log(`  ${p.label.padEnd(32)} ${pad(p.avg,6)} ${pad(p.std,6)} ${pad(p.min,5)} ${pad(p.max,5)} ${pad(p.range,7)}`);
  }

  // ── 4. 고변동 프로필 (std > 10) ───────────────────────────────────────────
  console.log("\n" + line);
  console.log("항목 4: 고변동 프로필 (std > 10)");
  console.log(line + "\n");

  const highVol = profs.filter(p => p.std > 10).sort((a,b) => b.std - a.std);
  console.log(`  총 ${highVol.length}명\n`);
  console.log(`  ${"프로필".padEnd(32)} ${"avg".padStart(6)} ${"std".padStart(6)} ${"min".padStart(5)} ${"max".padStart(5)} ${"range".padStart(7)}`);
  console.log("  " + dash.slice(0, 62));
  for (const p of highVol) {
    console.log(`  ${p.label.padEnd(32)} ${pad(p.avg,6)} ${pad(p.std,6)} ${pad(p.min,5)} ${pad(p.max,5)} ${pad(p.range,7)}`);
  }

  // ── 5. 배지 체감 분석 ─────────────────────────────────────────────────────
  console.log("\n" + line);
  console.log("항목 5: std 그룹별 배지 체감");
  console.log(line + "\n");

  function groupBadgeAvg(group: ProfRow[]) {
    if (group.length === 0) return { b85: 0, b75: 0, b61: 0, b60: 0 };
    return {
      b85: r1(avg(group.map(p => p.b85p))),
      b75: r1(avg(group.map(p => p.b7584))),
      b61: r1(avg(group.map(p => p.b6174))),
      b60: r1(avg(group.map(p => p.b60m))),
    };
  }

  const grpLow  = profs.filter(p => p.std < 6);
  const grpMid  = profs.filter(p => p.std >= 6 && p.std <= 10);
  const grpHigh = profs.filter(p => p.std > 10);

  const bLow  = groupBadgeAvg(grpLow);
  const bMid  = groupBadgeAvg(grpMid);
  const bHigh = groupBadgeAvg(grpHigh);

  const groups = [
    { label: `std < 6  (${grpLow.length}명)`,        b: bLow  },
    { label: `std 6~10 (${grpMid.length}명)`,         b: bMid  },
    { label: `std > 10 (${grpHigh.length}명)`,        b: bHigh },
  ];

  console.log(`  ${"그룹".padEnd(20)} ${"아주좋음%".padStart(9)} ${"좋음%".padStart(7)} ${"보통%".padStart(7)} ${"주의%".padStart(7)}`);
  console.log("  " + dash.slice(0, 54));
  for (const g of groups) {
    console.log(`  ${g.label.padEnd(20)} ${pad(g.b.b85+"%",9)} ${pad(g.b.b75+"%",7)} ${pad(g.b.b61+"%",7)} ${pad(g.b.b60+"%",7)}`);
  }

  console.log(`\n  해석:`);
  console.log(`  · std<6 그룹: 아주좋음 ${bLow.b85}% / 주의 ${bLow.b60}% → 체감 "늘 보통"`);
  console.log(`  · std>10 그룹: 아주좋음 ${bHigh.b85}% / 주의 ${bHigh.b60}% → 체감 "기복 큼"`);

  // ── 6. 상관관계 ───────────────────────────────────────────────────────────
  console.log("\n" + line);
  console.log("항목 6: 상관관계");
  console.log(line + "\n");

  const stdArr   = profs.map(p => p.std);
  const rangeArr = profs.map(p => p.range);
  const b85Arr   = profs.map(p => p.b85p);
  const b60Arr   = profs.map(p => p.b60m);
  const avgArr   = profs.map(p => p.avg);

  const corrStdB85   = corr(stdArr, b85Arr);
  const corrStdB60   = corr(stdArr, b60Arr);
  const corrStdRange = corr(stdArr, rangeArr);
  const corrAvgB85   = corr(avgArr, b85Arr);
  const corrAvgB60   = corr(avgArr, b60Arr);

  console.log(`  corr(std, 아주좋음%)  = ${corrStdB85}  ${Math.abs(corrStdB85)>0.7?"★ 강한 양의 상관":"→ " + (Math.abs(corrStdB85)>0.4?"중간":"약함")}`);
  console.log(`  corr(std, 주의%)      = ${corrStdB60}  ${Math.abs(corrStdB60)>0.7?"★ 강한 양의 상관":"→ " + (Math.abs(corrStdB60)>0.4?"중간":"약함")}`);
  console.log(`  corr(std, range)      = ${corrStdRange}  ${Math.abs(corrStdRange)>0.7?"★ 강한 양의 상관":"→ " + (Math.abs(corrStdRange)>0.4?"중간":"약함")}`);
  console.log(`  corr(avg, 아주좋음%)  = ${corrAvgB85}  → 평균이 높으면 아주좋음 많은가?`);
  console.log(`  corr(avg, 주의%)      = ${corrAvgB60}  → 평균이 낮으면 주의 많은가?`);

  // ── 7. 가상 실험 (std < 6, deviation × 1.15) ─────────────────────────────
  console.log("\n" + line);
  console.log("항목 7: 가상 실험 — std < 6 프로필, deviation × 1.15");
  console.log(line + "\n");

  // 저변동 프로필의 일별 점수 로드
  const lowLabels = new Set(grpLow.map(p => p.label));
  const lowDays   = days.filter(d => lowLabels.has(d.profile));

  // 프로필별 평균 계산 → deviation 확대 적용
  const profAvgMap: Record<string, number> = {};
  for (const p of grpLow) profAvgMap[p.label] = p.avg;

  const simScores: number[] = [];
  for (const d of lowDays) {
    const profAvg = profAvgMap[d.profile] ?? 70;
    const dev     = d.display - profAvg;
    const simDisp = Math.round(Math.max(0, Math.min(100, profAvg + dev * 1.15)));
    simScores.push(simDisp);
  }

  // 가상 std / range 추정 (프로필별)
  const simByProf: Record<string, number[]> = {};
  for (let i = 0; i < lowDays.length; i++) {
    const p = lowDays[i].profile;
    (simByProf[p] ??= []).push(simScores[i]);
  }

  const simStds   = Object.values(simByProf).map(a => r1(std(a)));
  const simRanges = Object.values(simByProf).map(a => Math.max(...a) - Math.min(...a));
  const simB85    = simScores.filter(s => s >= 85).length;
  const simB60    = simScores.filter(s => s <= 60).length;
  const simT      = simScores.length;

  const origStds   = grpLow.map(p => p.std);
  const origRanges = grpLow.map(p => p.range);
  const origDays   = lowDays.map(d => d.display);
  const origB85    = origDays.filter(s => s >= 85).length;
  const origB60    = origDays.filter(s => s <= 60).length;
  const origT      = origDays.length;

  console.log(`  대상: std<6 그룹 ${grpLow.length}명 × 180일 = ${origT}건\n`);
  console.log(`  ${"지표".padEnd(20)} ${"현재(×1.00)".padStart(14)} ${"시뮬(×1.15)".padStart(14)} ${"변화".padStart(10)}`);
  console.log("  " + dash.slice(0, 60));

  const rows: [string, number, number][] = [
    ["std 평균",      r1(avg(origStds)),   r1(avg(simStds))],
    ["std 최소",      Math.min(...origStds),  Math.min(...simStds)],
    ["std 최대",      Math.max(...origStds),  Math.max(...simStds)],
    ["range 평균",    r1(avg(origRanges)), r1(avg(simRanges))],
    ["아주좋음 %",    Math.round(origB85/origT*100), Math.round(simB85/simT*100)],
    ["주의 %",        Math.round(origB60/origT*100), Math.round(simB60/simT*100)],
  ];
  for (const [label, orig, sim] of rows) {
    const diff = r1(sim - orig);
    const sign = diff > 0 ? "+" : "";
    console.log(`  ${label.padEnd(20)} ${pad(orig, 14)} ${pad(sim, 14)} ${pad(sign+diff, 10)}`);
  }

  // 프로필별 before/after
  console.log(`\n  프로필별 std 변화 (저변동 ${grpLow.length}명):`);
  console.log(`  ${"프로필".padEnd(32)} ${"현재 std".padStart(9)} ${"시뮬 std".padStart(9)} ${"range 현재".padStart(11)} ${"range 시뮬".padStart(11)}`);
  console.log("  " + dash.slice(0, 74));
  for (const p of grpLow) {
    const ss = simByProf[p.label] ?? [];
    const sr = ss.length > 0 ? Math.max(...ss) - Math.min(...ss) : 0;
    const ss_ = ss.length > 0 ? r1(std(ss)) : 0;
    console.log(`  ${p.label.padEnd(32)} ${pad(p.std, 9)} ${pad(ss_, 9)} ${pad(p.range, 11)} ${pad(sr, 11)}`);
  }

  // ── 판단 ─────────────────────────────────────────────────────────────────
  console.log("\n" + line);
  console.log("판단");
  console.log(line + "\n");

  const lowVolPct      = Math.round(grpLow.length / N * 100);
  const avgLowStd      = r1(avg(grpLow.map(p=>p.std)));
  const avgLowB85      = r1(avg(grpLow.map(p=>p.b85p)));
  const avgLowB60      = r1(avg(grpLow.map(p=>p.b60m)));
  const avgAllB85      = r1(avg(profs.map(p=>p.b85p)));
  const avgLowAvg      = r1(avg(grpLow.map(p=>p.avg)));
  const lowAvgProblem  = grpLow.filter(p=>p.avg < 64).length;

  console.log(`  1. 저평균 문제가 남아있는가?`);
  console.log(`     std<6 그룹 avg 평균: ${avgLowAvg}  (avg<64: ${lowAvgProblem}명)`);
  console.log(`     → ${lowAvgProblem === 0 ? "✅ 저평균 문제 없음. 평균은 정상(70 전후)." : `⚠️ ${lowAvgProblem}명이 avg<64`}\n`);

  console.log(`  2. 실제 문제는 변동성 부족인가?`);
  console.log(`     std<6 그룹 std 평균: ${avgLowStd} → 아주좋음 ${avgLowB85}% / 주의 ${avgLowB60}%`);
  console.log(`     전체 평균 아주좋음:  ${avgAllB85}%`);
  console.log(`     → ${avgLowB85 < avgAllB85 / 2 ? "✅ 변동성 부족이 원인. 평균은 정상이지만 배지 체감 단조로움." : "⚠️ 배지 분포 차이 크지 않음."}\n`);

  console.log(`  3. P1 같은 프로필이 전체의 몇 %인가?`);
  console.log(`     std<6: ${grpLow.length}명 / ${N}명 = ${lowVolPct}%`);
  console.log(`     std<7: ${profs.filter(p=>p.std<7).length}명 = ${Math.round(profs.filter(p=>p.std<7).length/N*100)}%\n`);

  console.log(`  4. 변동성 확대가 필요한가?`);
  const simB85Pct  = Math.round(simB85/simT*100);
  const origB85Pct = Math.round(origB85/origT*100);
  console.log(`     × 1.15 시뮬: 아주좋음 ${origB85Pct}% → ${simB85Pct}%  (주의 ${Math.round(origB60/origT*100)}% → ${Math.round(simB60/simT*100)}%)`);
  const worthIt = simB85Pct - origB85Pct >= 2;
  console.log(`     → ${worthIt ? "✅ 변동성 확대 시 아주좋음 체감이 의미 있게 개선됨." : "❌ 개선 효과 미미. 확대 불필요."}\n`);

  console.log(`  5. 변동성 확대 기준선 (권장)?`);
  console.log(`     std < 6: ${grpLow.length}명 (${lowVolPct}%) ← 가장 좁은 그룹`);
  console.log(`     std < 7: ${profs.filter(p=>p.std<7).length}명 (${Math.round(profs.filter(p=>p.std<7).length/N*100)}%) ← 확대 시 영향 범위 적당`);
  console.log(`     std < 5: ${profs.filter(p=>p.std<5).length}명 (${Math.round(profs.filter(p=>p.std<5).length/N*100)}%) ← 너무 좁음`);

  console.log("\n  ─── 최종 결론 ───────────────────────────────────────────────\n");
  console.log(`  corr(std, 아주좋음%) = ${corrStdB85} → std 가 높을수록 아주좋음 확실히 많아짐`);
  console.log(`  corr(avg, 아주좋음%) = ${corrAvgB85} → 평균은 아주좋음과 무관에 가까움`);
  console.log(`  corr(std, 주의%)     = ${corrStdB60} → std 가 높으면 주의도 함께 늘어남`);
  console.log(`\n  ∴ 핵심 원인 = 변동성 부족`);
  console.log(`  ∴ 평균이 낮아서 아주좋음이 없는 게 아니라, 변동폭이 좁아서 상단에 도달을 못함`);
  console.log(`  ∴ 변동성 확대 대상: std < 6 (${lowVolPct}%) 또는 std < 7 (${Math.round(profs.filter(p=>p.std<7).length/N*100)}%)`);
  console.log(`  ∴ 방식: 엔진 deviation 직접 확대보다, 소프트 압축 해제 또는 카테고리 가중치 조정 권장`);

  console.log("\n✅ 완료");
}

main();
