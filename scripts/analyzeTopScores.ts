/**
 * 상단 점수 집중도 + 배지 기준 A vs B 비교
 * Usage: npx tsx scripts/analyzeTopScores.ts
 *
 * n67p5_detail.csv (display 컬럼) 를 읽어 분석
 */
import * as fs from "node:fs";
import * as path from "node:path";

const CSV = path.join("scripts", "output", "n67p5_detail.csv");

type Row = { profile: string; raw: number; norm67: number; display: number };

function loadRows(): Row[] {
  const lines = fs.readFileSync(CSV, "utf8").split("\n");
  const rows: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].trim().split(",");
    if (cols.length < 5) continue;
    rows.push({
      profile: cols[1],
      raw:     Number(cols[2]),
      norm67:  Number(cols[3]),
      display: Number(cols[4]),
    });
  }
  return rows;
}

// 배지 기준 A: 85/75/61/60이하
function badgeA(s: number) {
  if (s >= 85) return "아주좋음";
  if (s >= 75) return "좋음";
  if (s >= 61) return "보통";
  return "주의";
}
// 배지 기준 B: 80/70/61/60이하
function badgeB(s: number) {
  if (s >= 80) return "아주좋음";
  if (s >= 70) return "좋음";
  if (s >= 61) return "보통";
  return "주의";
}

function pctStr(n: number, t: number) { return `${Math.round(n / t * 100)}%`; }
function pad(s: string | number, w: number) { return String(s).padStart(w); }

function main() {
  if (!fs.existsSync(CSV)) {
    console.error(`파일 없음: ${CSV}\n먼저 npx tsx scripts/verifyNorm67Plus5.ts 실행 필요`);
    process.exit(1);
  }

  const rows = loadRows();
  const T    = rows.length;
  const display = rows.map(r => r.display);
  const norm67  = rows.map(r => r.norm67);

  console.log(`\n로드 완료: ${T}건 (${CSV})\n`);

  const line = "══════════════════════════════════════════════════════════════";
  const dash = "──────────────────────────────────────────────────────────────";

  // ── 1. 100점 빈도 ──────────────────────────────────────────────────────────
  console.log(line);
  console.log("항목 1: 상단 점수 빈도");
  console.log(line + "\n");

  const cnt100  = display.filter(v => v === 100).length;
  const cnt99   = display.filter(v => v === 99).length;
  const cnt98   = display.filter(v => v === 98).length;
  const cnt97   = display.filter(v => v === 97).length;
  const cnt95p  = display.filter(v => v >= 95).length;
  const cnt90p  = display.filter(v => v >= 90).length;

  console.log(`  100점:    ${pad(cnt100, 5)}건  (${pctStr(cnt100, T)})`);
  console.log(`   99점:    ${pad(cnt99,  5)}건  (${pctStr(cnt99,  T)})`);
  console.log(`   98점:    ${pad(cnt98,  5)}건  (${pctStr(cnt98,  T)})`);
  console.log(`   97점:    ${pad(cnt97,  5)}건  (${pctStr(cnt97,  T)})`);
  console.log(`  95이상:   ${pad(cnt95p, 5)}건  (${pctStr(cnt95p, T)})`);
  console.log(`  90이상:   ${pad(cnt90p, 5)}건  (${pctStr(cnt90p, T)})`);

  // ── 2. 상위 50개 점수 ─────────────────────────────────────────────────────
  console.log("\n" + line);
  console.log("항목 2: 상위 50개 점수");
  console.log(line + "\n");

  const sorted = [...display].sort((a, b) => b - a);
  const top50  = sorted.slice(0, 50);

  // 줄 당 10개씩
  for (let i = 0; i < 50; i += 10) {
    console.log("  " + top50.slice(i, i + 10).map(v => pad(v, 4)).join(" "));
  }

  // ── 3. 100점 발생 프로필 ──────────────────────────────────────────────────
  console.log("\n" + line);
  console.log("항목 3: 상단 점수 프로필 집중도");
  console.log(line + "\n");

  const profWith100 = [...new Set(rows.filter(r => r.display === 100).map(r => r.profile))].sort();
  const profWith99p = [...new Set(rows.filter(r => r.display >= 99).map(r => r.profile))].sort();
  const profWith95p = [...new Set(rows.filter(r => r.display >= 95).map(r => r.profile))].sort();

  console.log(`  100점 발생 프로필: ${profWith100.length}명`);
  if (profWith100.length > 0 && profWith100.length <= 15) {
    profWith100.forEach(p => console.log(`    · ${p}`));
  } else if (profWith100.length > 15) {
    profWith100.slice(0, 10).forEach(p => console.log(`    · ${p}`));
    console.log(`    ... 외 ${profWith100.length - 10}명`);
  }

  console.log(`\n  99점 이상 발생 프로필: ${profWith99p.length}명`);
  console.log(`  95점 이상 발생 프로필: ${profWith95p.length}명`);

  // 각 프로필별 100점 건수 (상위 10개)
  const cnt100ByProf: Record<string, number> = {};
  for (const r of rows) {
    if (r.display === 100) cnt100ByProf[r.profile] = (cnt100ByProf[r.profile] ?? 0) + 1;
  }
  const top100Profs = Object.entries(cnt100ByProf).sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (top100Profs.length > 0) {
    console.log(`\n  프로필별 100점 건수 (상위 10개):`);
    top100Profs.forEach(([p, n]) => console.log(`    ${p.padEnd(30)} ${n}건`));
  }

  // ── 4. 클램프 영향 ────────────────────────────────────────────────────────
  console.log("\n" + line);
  console.log("항목 4: 클램프 영향 (100점 상한 눌림)");
  console.log(line + "\n");

  // norm67 기준으로 100점 클램프 여부 확인 (norm67 > 95이면 +5해서 100점이 됨)
  const wouldExceed100 = rows.filter(r => r.norm67 + 5 > 100);
  const clamped100     = rows.filter(r => r.display === 100 && r.norm67 + 5 > 100);

  // norm67만 있을 때 실제 norm67+5 분포
  const rawDisplay = rows.map(r => Math.min(100, r.norm67 + 5)); // clamp 없이도 같음
  const naturalMax = rows.map(r => r.norm67 + 5).filter(v => v > 100).length;

  console.log(`  norm67+5 > 100이어서 클램프된 케이스: ${clamped100.length}건  (${pctStr(clamped100.length, T)})`);
  console.log(`  (즉, 이 케이스들은 100점보다 더 높아야 했지만 100에 눌림)`);

  // norm67+5가 100을 얼마나 초과했는지 분포
  const overAmounts = rows.map(r => r.norm67 + 5 - 100).filter(v => v > 0);
  if (overAmounts.length > 0) {
    const avgOver = overAmounts.reduce((s, x) => s + x, 0) / overAmounts.length;
    const maxOver = Math.max(...overAmounts);
    console.log(`\n  초과 케이스 평균 초과량: +${Math.round(avgOver * 10) / 10}점`);
    console.log(`  최대 초과량: +${maxOver}점`);
    const buckets: Record<string, number> = { "1점 초과": 0, "2점 초과": 0, "3~5점 초과": 0, "6점+초과": 0 };
    for (const v of overAmounts) {
      if (v <= 1) buckets["1점 초과"]++;
      else if (v <= 2) buckets["2점 초과"]++;
      else if (v <= 5) buckets["3~5점 초과"]++;
      else buckets["6점+초과"]++;
    }
    console.log("\n  초과량 분포:");
    for (const [k, n] of Object.entries(buckets)) {
      if (n > 0) console.log(`    ${k.padEnd(12)} ${n}건`);
    }
  } else {
    console.log(`\n  norm67+5 > 100인 케이스 없음`);
  }

  // 95~99 구간 (100점 직전)
  const near100 = display.filter(v => v >= 95 && v < 100).length;
  console.log(`\n  95~99 구간 (100점 직전): ${near100}건  (${pctStr(near100, T)})`);
  console.log(`  100점 + 95~99 합산:       ${cnt100 + near100}건  (${pctStr(cnt100 + near100, T)})`);

  // ── 5. 배지 기준 A vs B 비교 ──────────────────────────────────────────────
  console.log("\n" + line);
  console.log("항목 5: 배지 기준 A (85/75/61) vs B (80/70/61) 비교");
  console.log(line + "\n");

  const badgesA = display.map(badgeA);
  const badgesB = display.map(badgeB);

  const cntA = { "아주좋음": 0, "좋음": 0, "보통": 0, "주의": 0 };
  const cntB = { "아주좋음": 0, "좋음": 0, "보통": 0, "주의": 0 };
  for (const b of badgesA) cntA[b as keyof typeof cntA]++;
  for (const b of badgesB) cntB[b as keyof typeof cntB]++;

  const labels: [string, string][] = [
    ["아주좋음", "85+ / 80+"],
    ["좋음",     "75~84 / 70~79"],
    ["보통",     "61~74 / 61~69"],
    ["주의",     "60이하 / 60이하"],
  ];

  console.log(`${"배지".padEnd(10)} ${"기준".padEnd(20)} ${"A비율".padStart(8)} ${"B비율".padStart(8)} ${"차이".padStart(8)}`);
  console.log(dash);
  for (const [badge, criteria] of labels) {
    const pA = Math.round(cntA[badge as keyof typeof cntA] / T * 100);
    const pB = Math.round(cntB[badge as keyof typeof cntB] / T * 100);
    const diff = pA - pB;
    const diffStr = diff > 0 ? `+${diff}%` : diff < 0 ? `${diff}%` : "0%";
    console.log(`${badge.padEnd(10)} ${criteria.padEnd(20)} ${pad(pA+"%",8)} ${pad(pB+"%",8)} ${pad(diffStr,8)}`);
  }

  // 건수도 출력
  console.log("\n  건수 기준:");
  for (const [badge] of labels) {
    const nA = cntA[badge as keyof typeof cntA];
    const nB = cntB[badge as keyof typeof cntB];
    console.log(`    ${badge.padEnd(8)}  A: ${nA}건  B: ${nB}건  차이: ${nB - nA > 0 ? "+" : ""}${nB - nA}건`);
  }

  // 월별 아주좋음 기대 일수
  console.log(`\n  한 달(31일) 기준 아주좋음 기대 일수:`);
  const daysA = Math.round(31 * cntA["아주좋음"] / T * 10) / 10;
  const daysB = Math.round(31 * cntB["아주좋음"] / T * 10) / 10;
  console.log(`    A (85+): 약 ${daysA}일/월`);
  console.log(`    B (80+): 약 ${daysB}일/월`);

  // ── 6. 종합 추천 ──────────────────────────────────────────────────────────
  console.log("\n" + line);
  console.log("항목 6: 분석 결과 요약 (판단용 수치)");
  console.log(line + "\n");

  const clampRatio = clamped100.length / T * 100;
  const top95ratio = cnt95p / T * 100;

  console.log(`  100점 비율:           ${pctStr(cnt100, T)}  (${cnt100}건/${T}건)`);
  console.log(`  100점이 클램프된 비율: ${Math.round(clampRatio * 10) / 10}%`);
  console.log(`  95이상 누적 비율:     ${pctStr(cnt95p, T)}`);
  console.log(`  A기준 아주좋음:       ${pctStr(cntA["아주좋음"], T)}  (월 ${daysA}일)`);
  console.log(`  B기준 아주좋음:       ${pctStr(cntB["아주좋음"], T)}  (월 ${daysB}일)`);
  console.log(`  B - A 아주좋음 차이:  +${Math.round(cntB["아주좋음"] / T * 100) - Math.round(cntA["아주좋음"] / T * 100)}%p`);

  const isClampProblem   = clampRatio >= 0.5;
  const isTopHeavy       = top95ratio >= 2.0;
  const isAOverlyRare    = Math.round(cntA["아주좋음"] / T * 100) < 7;

  console.log(`\n  [자동 판단]`);
  console.log(`  100점 클램프 문제:    ${isClampProblem   ? "⚠️ 있음 (soft cap 고려 권장)" : "✅ 없음"}`);
  console.log(`  상단 과집중:          ${isTopHeavy       ? "⚠️ 있음 (95이상 2% 초과)" : "✅ 없음"}`);
  console.log(`  A기준 아주좋음 희소:  ${isAOverlyRare    ? "⚠️ 있음 (7% 미만)" : "✅ 적정"}`);

  console.log("\n✅ 완료");
}

main();
