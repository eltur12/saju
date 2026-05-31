/**
 * NORM_67+5 최종 구조 대량 검증
 * Usage: npx tsx scripts/verifyNorm67Plus5.ts
 *
 * 구조: displayScore = clamp(rawScore + NORM_67_offset + 5, 0, 100)
 * 배지: 85+ / 75~84 / 61~74 / 60이하
 * 대상: 100개 프로필 × 180일 = 18,000건
 * 출력: 채팅에는 요약만, 상세는 scripts/output/ 에 파일로 저장
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { calculateSajuProfile } from "../src/utils/sajuCalculator";
import { buildZiweiProfile }    from "../src/utils/ziweiCalculator";
import { buildAstroProfile }    from "../src/utils/astroCalculator";
import { FortuneAggregator }    from "../src/engines/aggregator";
import { DEFAULT_ZIWEI_FLAGS }  from "../src/engines/ziweiEngine";
import { DEFAULT_SAJU_FLAGS }   from "../src/engines/sajuEngine";
import type { DailyFortune }    from "../src/engines/aggregator";

// ── 설정 ─────────────────────────────────────────────────────────────────────
const TARGET_AVG  = 67;
const MAX_OFFSET  = 6;
const DISPLAY_ADD = 5;

// 배지 기준 (최종 후보: +5 이동)
function badge(s: number): string {
  if (s >= 85) return "아주좋음";
  if (s >= 75) return "좋음";
  if (s >= 61) return "보통";
  return "주의";
}

// ── 100개 프로필 ──────────────────────────────────────────────────────────────
const PROFILES = [
  // 1940~1959 — 노년층
  { id:  1, label:"P001 (1942M 寅月)", birth:{year:1942,month: 2,day:10,hour: 6}, gender:"M" as const },
  { id:  2, label:"P002 (1945F 午月)", birth:{year:1945,month: 6,day:18,hour:14}, gender:"F" as const },
  { id:  3, label:"P003 (1948M 酉月)", birth:{year:1948,month: 9,day: 5,hour:22}, gender:"M" as const },
  { id:  4, label:"P004 (1951F 子月)", birth:{year:1951,month:12,day:25,hour: 3}, gender:"F" as const },
  { id:  5, label:"P005 (1954M 卯月)", birth:{year:1954,month: 3,day:14,hour:10}, gender:"M" as const },
  { id:  6, label:"P006 (1957F 未月)", birth:{year:1957,month: 7,day:29,hour:18}, gender:"F" as const },
  { id:  7, label:"P007 (1958M 辰月)", birth:{year:1958,month: 4,day: 7,hour: 0}, gender:"M" as const },
  { id:  8, label:"P008 (1959F 戌月)", birth:{year:1959,month:10,day:21,hour: 8}, gender:"F" as const },

  // 1960~1969 — 60대
  { id:  9, label:"P009 (1960M 丑月)", birth:{year:1960,month: 1,day:30,hour:16}, gender:"M" as const },
  { id: 10, label:"P010 (1961F 申月)", birth:{year:1961,month: 8,day:12,hour: 2}, gender:"F" as const },
  { id: 11, label:"P011 (1962M 亥月)", birth:{year:1962,month:11,day: 3,hour:20}, gender:"M" as const },
  { id: 12, label:"P012 (1963F 巳月)", birth:{year:1963,month: 5,day:24,hour:12}, gender:"F" as const },
  { id: 13, label:"P013 (1964M 寅月)", birth:{year:1964,month: 2,day:16,hour: 4}, gender:"M" as const },
  { id: 14, label:"P014 (1965F 卯月)", birth:{year:1965,month: 4,day: 9,hour:23}, gender:"F" as const },
  { id: 15, label:"P015 (1966M 午月)", birth:{year:1966,month: 6,day:27,hour:15}, gender:"M" as const },
  { id: 16, label:"P016 (1967F 酉月)", birth:{year:1967,month: 9,day: 1,hour: 7}, gender:"F" as const },
  { id: 17, label:"P017 (1968M 戌月)", birth:{year:1968,month:10,day:19,hour:19}, gender:"M" as const },
  { id: 18, label:"P018 (1969F 子月)", birth:{year:1969,month:12,day: 8,hour:11}, gender:"F" as const },

  // 1970~1979 — 50대
  { id: 19, label:"P019 (1970M 丑月)", birth:{year:1970,month: 1,day:22,hour: 5}, gender:"M" as const },
  { id: 20, label:"P020 (1971F 卯月)", birth:{year:1971,month: 3,day:15,hour:21}, gender:"F" as const },
  { id: 21, label:"P021 (1972M 巳月)", birth:{year:1972,month: 5,day: 6,hour:13}, gender:"M" as const },
  { id: 22, label:"P022 (1973F 未月)", birth:{year:1973,month: 7,day:31,hour: 9}, gender:"F" as const },
  { id: 23, label:"P023 (1974M 申月)", birth:{year:1974,month: 8,day:23,hour: 1}, gender:"M" as const },
  { id: 24, label:"P024 (1975F 亥月)", birth:{year:1975,month:11,day:10,hour:17}, gender:"F" as const },
  { id: 25, label:"P025 (1976M 寅月)", birth:{year:1976,month: 2,day: 4,hour: 3}, gender:"M" as const },
  { id: 26, label:"P026 (1977F 辰月)", birth:{year:1977,month: 4,day:28,hour:22}, gender:"F" as const },
  { id: 27, label:"P027 (1978M 酉月)", birth:{year:1978,month: 9,day:16,hour:14}, gender:"M" as const },
  { id: 28, label:"P028 (1979F 子月)", birth:{year:1979,month:12,day:19,hour: 6}, gender:"F" as const },

  // 1980~1989 — 40대
  { id: 29, label:"P029 (1980M 丑月)", birth:{year:1980,month: 1,day: 7,hour:20}, gender:"M" as const },
  { id: 30, label:"P030 (1981F 卯月)", birth:{year:1981,month: 3,day:30,hour:12}, gender:"F" as const },
  { id: 31, label:"P031 (1982M 午月)", birth:{year:1982,month: 6,day:13,hour: 8}, gender:"M" as const },
  { id: 32, label:"P032 (1983F 未月)", birth:{year:1983,month: 7,day:26,hour: 0}, gender:"F" as const },
  { id: 33, label:"P033 (1984M 申月)", birth:{year:1984,month: 8,day:11,hour:16}, gender:"M" as const },
  { id: 34, label:"P034 (1985F 戌月)", birth:{year:1985,month:10,day: 4,hour: 4}, gender:"F" as const },
  { id: 35, label:"P035 (1986M 亥月)", birth:{year:1986,month:11,day:24,hour:18}, gender:"M" as const },
  { id: 36, label:"P036 (1987F 丑月)", birth:{year:1987,month: 1,day:17,hour:10}, gender:"F" as const },
  { id: 37, label:"P037 (1988M 寅月)", birth:{year:1988,month: 2,day:22,hour: 2}, gender:"M" as const },
  { id: 38, label:"P038 (1989F 巳月)", birth:{year:1989,month: 5,day:15,hour:22}, gender:"F" as const },

  // 1990~1999 — 30대
  { id: 39, label:"P039 (1990M 卯月)", birth:{year:1990,month: 4,day: 9,hour:14}, gender:"M" as const },
  { id: 40, label:"P040 (1991F 午月)", birth:{year:1991,month: 6,day: 1,hour: 6}, gender:"F" as const },
  { id: 41, label:"P041 (1992M 辰月)", birth:{year:1992,month: 4,day:20,hour:20}, gender:"M" as const },
  { id: 42, label:"P042 (1993F 酉月)", birth:{year:1993,month: 9,day:28,hour:12}, gender:"F" as const },
  { id: 43, label:"P043 (1994M 子月)", birth:{year:1994,month:12,day:16,hour: 4}, gender:"M" as const },
  { id: 44, label:"P044 (1995F 戌月)", birth:{year:1995,month:10,day: 7,hour:23}, gender:"F" as const },
  { id: 45, label:"P045 (1996M 丑月)", birth:{year:1996,month: 1,day:25,hour:15}, gender:"M" as const },
  { id: 46, label:"P046 (1997F 未月)", birth:{year:1997,month: 7,day:19,hour: 7}, gender:"F" as const },
  { id: 47, label:"P047 (1998M 申月)", birth:{year:1998,month: 8,day:30,hour: 3}, gender:"M" as const },
  { id: 48, label:"P048 (1999F 亥月)", birth:{year:1999,month:11,day:13,hour:19}, gender:"F" as const },

  // 2000~2005 — 20대 초반
  { id: 49, label:"P049 (2000M 寅月)", birth:{year:2000,month: 2,day: 6,hour:11}, gender:"M" as const },
  { id: 50, label:"P050 (2001F 巳月)", birth:{year:2001,month: 5,day:21,hour: 5}, gender:"F" as const },
  { id: 51, label:"P051 (2002M 卯月)", birth:{year:2002,month: 3,day:12,hour:21}, gender:"M" as const },
  { id: 52, label:"P052 (2003F 午月)", birth:{year:2003,month: 6,day:25,hour:13}, gender:"F" as const },
  { id: 53, label:"P053 (2004M 酉月)", birth:{year:2004,month: 9,day:18,hour: 9}, gender:"M" as const },
  { id: 54, label:"P054 (2005F 丑月)", birth:{year:2005,month: 1,day: 3,hour: 1}, gender:"F" as const },

  // 다양한 시간대 — 자/오/묘/유 시 집중
  { id: 55, label:"P055 (1972M 子時)", birth:{year:1972,month: 3,day:15,hour: 0}, gender:"M" as const },
  { id: 56, label:"P056 (1975F 午時)", birth:{year:1975,month: 8,day:20,hour:12}, gender:"F" as const },
  { id: 57, label:"P057 (1978M 卯時)", birth:{year:1978,month:11,day: 7,hour: 6}, gender:"M" as const },
  { id: 58, label:"P058 (1981F 酉時)", birth:{year:1981,month: 2,day:27,hour:18}, gender:"F" as const },
  { id: 59, label:"P059 (1984M 寅時)", birth:{year:1984,month: 5,day:14,hour: 4}, gender:"M" as const },
  { id: 60, label:"P060 (1987F 申時)", birth:{year:1987,month: 8,day: 3,hour:16}, gender:"F" as const },
  { id: 61, label:"P061 (1990M 辰時)", birth:{year:1990,month:10,day:22,hour: 8}, gender:"M" as const },
  { id: 62, label:"P062 (1993F 戌時)", birth:{year:1993,month: 4,day:11,hour:20}, gender:"F" as const },
  { id: 63, label:"P063 (1996M 丑時)", birth:{year:1996,month: 6,day:30,hour: 2}, gender:"M" as const },
  { id: 64, label:"P064 (1999F 未時)", birth:{year:1999,month: 9,day:17,hour:14}, gender:"F" as const },
  { id: 65, label:"P065 (2002M 亥時)", birth:{year:2002,month:12,day: 6,hour:22}, gender:"M" as const },
  { id: 66, label:"P066 (2005F 巳時)", birth:{year:2005,month: 7,day:23,hour:10}, gender:"F" as const },

  // 특수 생일 — 절기 경계 / 연말연시 / 윤달 인근
  { id: 67, label:"P067 (1966M 立春前)", birth:{year:1966,month: 2,day: 3,hour:12}, gender:"M" as const },
  { id: 68, label:"P068 (1970F 冬至)", birth:{year:1970,month:12,day:22,hour: 0}, gender:"F" as const },
  { id: 69, label:"P069 (1975M 夏至)", birth:{year:1975,month: 6,day:21,hour: 6}, gender:"M" as const },
  { id: 70, label:"P070 (1980F 元旦)", birth:{year:1980,month: 1,day: 1,hour: 0}, gender:"F" as const },
  { id: 71, label:"P071 (1985M 大晦日)", birth:{year:1985,month:12,day:31,hour:23}, gender:"M" as const },
  { id: 72, label:"P072 (1990F 立秋)", birth:{year:1990,month: 8,day: 7,hour:18}, gender:"F" as const },

  // 다양한 세대 × 시간 조합 보완
  { id: 73, label:"P073 (1955M 戌月3시)", birth:{year:1955,month:10,day:13,hour: 3}, gender:"M" as const },
  { id: 74, label:"P074 (1963F 子月21시)", birth:{year:1963,month:12,day: 4,hour:21}, gender:"F" as const },
  { id: 75, label:"P075 (1971M 辰月9시)", birth:{year:1971,month: 4,day:19,hour: 9}, gender:"M" as const },
  { id: 76, label:"P076 (1977F 未月15시)", birth:{year:1977,month: 7,day: 8,hour:15}, gender:"F" as const },
  { id: 77, label:"P077 (1983M 亥月7시)", birth:{year:1983,month:11,day:27,hour: 7}, gender:"M" as const },
  { id: 78, label:"P078 (1989F 寅月23시)", birth:{year:1989,month: 2,day: 5,hour:23}, gender:"F" as const },
  { id: 79, label:"P079 (1995M 巳月11시)", birth:{year:1995,month: 5,day:12,hour:11}, gender:"M" as const },
  { id: 80, label:"P080 (2001F 申月17시)", birth:{year:2001,month: 8,day:24,hour:17}, gender:"F" as const },

  // 추가 다양성 — 극단 시간 (0시/1시/23시)
  { id: 81, label:"P081 (1960M 午月0시)", birth:{year:1960,month: 6,day:15,hour: 0}, gender:"M" as const },
  { id: 82, label:"P082 (1968F 酉月1시)", birth:{year:1968,month: 9,day:22,hour: 1}, gender:"F" as const },
  { id: 83, label:"P083 (1976M 丑月23시)", birth:{year:1976,month: 1,day:18,hour:23}, gender:"M" as const },
  { id: 84, label:"P084 (1984F 辰月13시)", birth:{year:1984,month: 4,day: 3,hour:13}, gender:"F" as const },
  { id: 85, label:"P085 (1992M 未月5시)", birth:{year:1992,month: 7,day:16,hour: 5}, gender:"M" as const },
  { id: 86, label:"P086 (2000F 戌月19시)", birth:{year:2000,month:10,day:29,hour:19}, gender:"F" as const },

  // 1940년대 추가
  { id: 87, label:"P087 (1943M 卯月)", birth:{year:1943,month: 3,day:28,hour:10}, gender:"M" as const },
  { id: 88, label:"P088 (1947F 子月)", birth:{year:1947,month:12,day:11,hour: 4}, gender:"F" as const },
  { id: 89, label:"P089 (1952M 申月)", birth:{year:1952,month: 8,day: 6,hour:20}, gender:"M" as const },
  { id: 90, label:"P090 (1956F 巳月)", birth:{year:1956,month: 5,day:30,hour:16}, gender:"F" as const },

  // 2000년대 보완
  { id: 91, label:"P091 (2003M 寅月)", birth:{year:2003,month: 2,day:19,hour: 8}, gender:"M" as const },
  { id: 92, label:"P092 (2004F 午月)", birth:{year:2004,month: 6,day:11,hour:22}, gender:"F" as const },

  // 혼합 중간 세대 — 엣지 케이스
  { id: 93, label:"P093 (1969M 卯月4시)", birth:{year:1969,month: 3,day:25,hour: 4}, gender:"M" as const },
  { id: 94, label:"P094 (1974F 戌月2시)", birth:{year:1974,month:10,day:14,hour: 2}, gender:"F" as const },
  { id: 95, label:"P095 (1979M 未月20시)", birth:{year:1979,month: 7,day: 5,hour:20}, gender:"M" as const },
  { id: 96, label:"P096 (1986F 辰月6시)", birth:{year:1986,month: 4,day:16,hour: 6}, gender:"F" as const },
  { id: 97, label:"P097 (1993M 子月18시)", birth:{year:1993,month:12,day:30,hour:18}, gender:"M" as const },
  { id: 98, label:"P098 (1998F 亥月12시)", birth:{year:1998,month:11,day:21,hour:12}, gender:"F" as const },
  { id: 99, label:"P099 (1961M 午月8시)", birth:{year:1961,month: 6,day: 8,hour: 8}, gender:"M" as const },
  { id:100, label:"P100 (2002F 丑月16시)", birth:{year:2002,month: 1,day:14,hour:16}, gender:"F" as const },
];
const N = PROFILES.length; // 100

const END   = new Date(2026, 4, 31);
const START = new Date(END);
START.setDate(END.getDate() - 179);
const N_DAYS = 180;

// ── 유틸 ─────────────────────────────────────────────────────────────────────
function r1(v: number)  { return Math.round(v * 10) / 10; }
function avgFn(a: number[]) { return a.reduce((s,x)=>s+x,0)/a.length; }
function stdevFn(a: number[]) {
  const m = avgFn(a);
  return Math.sqrt(a.reduce((s,x)=>s+(x-m)**2,0)/a.length);
}
function pct(sorted: number[], p: number): number {
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return r1(sorted[lo] + (sorted[hi]-sorted[lo])*(idx-lo));
}
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function pad(s: string|number, w: number) { return String(s).padStart(w); }
function dateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

async function buildProfile(p: typeof PROFILES[0]) {
  const b = p.birth;
  return {
    label:        p.label,
    sajuProfile:  calculateSajuProfile(b.year, b.month, b.day, b.hour, p.gender),
    ziweiProfile: buildZiweiProfile(b.year, b.month, b.day, b.hour, 2026, p.gender==="M"),
    astroProfile: await buildAstroProfile(b.year, b.month, b.day, b.hour),
    birthDate:    new Date(b.year, b.month-1, b.day),
  };
}

interface ProfileResult {
  label: string;
  rawAvg: number;
  offset: number;
  displayScores: number[];
  avg: number; std: number;
  min: number; max: number; range: number;
  p5: number; p95: number;
  b85p: number; b7584: number; b6174: number; b60m: number;
}

async function main() {
  const OUT = path.join("scripts", "output");
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

  console.log("=== NORM_67+5 최종 구조 대량 검증 ===");
  console.log(`대상: ${N}개 프로필 × ${N_DAYS}일 = ${N*N_DAYS}건`);
  console.log(`구조: displayScore = clamp(raw + NORM_67_offset + 5, 0, 100)`);
  console.log(`배지: 85+ / 75~84 / 61~74 / 60이하\n`);

  // ── 1. 프로필 빌드 ─────────────────────────────────────────────────────────
  console.log(`프로필 빌드 중 (${N}명)...`);
  const pds = await Promise.all(PROFILES.map(buildProfile));
  console.log("완료. raw 점수 수집 중...\n");

  // ── 2. raw 점수 수집 ───────────────────────────────────────────────────────
  const dates: string[] = [];
  for (let i=0; i<N_DAYS; i++) {
    const d = new Date(START); d.setDate(START.getDate()+i); dates.push(dateStr(d));
  }

  const rawSeries: number[][] = [];
  for (let pi=0; pi<N; pi++) {
    const pd = pds[pi];
    const agg = new FortuneAggregator(
      pd.sajuProfile, pd.ziweiProfile, pd.astroProfile,
      undefined, pd.birthDate, true,
    );
    const raw: number[] = [];
    for (let i=0; i<N_DAYS; i++) {
      const d = new Date(START); d.setDate(START.getDate()+i);
      const f: DailyFortune = agg.getDailyFortune(d, DEFAULT_ZIWEI_FLAGS, DEFAULT_SAJU_FLAGS);
      raw.push(f.scores.overall);
    }
    rawSeries.push(raw);
    if ((pi+1) % 20 === 0) console.log(`  ${pi+1}/${N} 완료`);
  }
  console.log("raw 수집 완료\n");

  // ── 3. NORM_67+5 계산 ─────────────────────────────────────────────────────
  const profileResults: ProfileResult[] = rawSeries.map((raw, pi) => {
    const rawAvg = avgFn(raw);
    const offset = r1(clamp(TARGET_AVG - rawAvg, -MAX_OFFSET, MAX_OFFSET));
    const display = raw.map(v => Math.round(clamp(v + offset + DISPLAY_ADD, 0, 100)));
    const ss = [...display].sort((a,b)=>a-b);
    const n  = display.length;
    return {
      label:         PROFILES[pi].label,
      rawAvg:        r1(rawAvg),
      offset,
      displayScores: display,
      avg:   r1(avgFn(display)),
      std:   r1(stdevFn(display)),
      min:   ss[0], max: ss[n-1], range: ss[n-1]-ss[0],
      p5:    pct(ss, 5), p95: pct(ss, 95),
      b85p:  Math.round(display.filter(v=>v>=85).length/n*100),
      b7584: Math.round(display.filter(v=>v>=75&&v<85).length/n*100),
      b6174: Math.round(display.filter(v=>v>=61&&v<75).length/n*100),
      b60m:  Math.round(display.filter(v=>v<=60).length/n*100),
    };
  });

  const allDisplay = profileResults.flatMap(r => r.displayScores);
  const allSorted  = [...allDisplay].sort((a,b)=>a-b);
  const T = allDisplay.length;

  // ── 4. CSV 저장 ────────────────────────────────────────────────────────────
  const detailRows: string[] = [["date","profile","raw","norm67","display"].join(",")];
  for (let pi=0; pi<N; pi++) {
    const { offset } = profileResults[pi];
    for (let di=0; di<N_DAYS; di++) {
      const raw   = rawSeries[pi][di];
      const norm  = Math.round(clamp(raw + offset, 0, 100));
      const disp  = profileResults[pi].displayScores[di];
      detailRows.push([dates[di], PROFILES[pi].label, raw, norm, disp].join(","));
    }
  }
  fs.writeFileSync(path.join(OUT,"n67p5_detail.csv"), detailRows.join("\n"), "utf8");

  const profRows: string[] = [
    ["profile","rawAvg","offset","displayAvg","std","min","max","range","p5","p95","b85p","b7584","b6174","b60m"].join(",")
  ];
  for (const r of profileResults) {
    profRows.push([
      r.label, r.rawAvg, r.offset, r.avg, r.std,
      r.min, r.max, r.range, r.p5, r.p95,
      r.b85p+"%", r.b7584+"%", r.b6174+"%", r.b60m+"%",
    ].join(","));
  }
  fs.writeFileSync(path.join(OUT,"n67p5_profile_summary.csv"), profRows.join("\n"), "utf8");

  // ── 5. MD 리포트 ──────────────────────────────────────────────────────────
  const md: string[] = [];
  md.push("# NORM_67+5 대량 검증 리포트\n");
  md.push(`대상: ${N}개 프로필 × ${N_DAYS}일 = ${T}건  `);
  md.push(`구조: displayScore = clamp(raw + NORM_67_offset + 5, 0, 100)  `);
  md.push(`배지: 85+ 아주좋음 / 75~84 좋음 / 61~74 보통 / 60이하 주의\n`);

  // 전체 분포
  md.push("## 1. 전체 분포\n");
  md.push("| 지표 | 값 |");
  md.push("|------|-----|");
  const distKeys: [string, number][] = [
    ["avg", r1(avgFn(allDisplay))], ["std", r1(stdevFn(allDisplay))],
    ["min", allSorted[0]], ["p1", pct(allSorted,1)], ["p5", pct(allSorted,5)],
    ["p25", pct(allSorted,25)], ["p50", pct(allSorted,50)], ["p75", pct(allSorted,75)],
    ["p95", pct(allSorted,95)], ["p99", pct(allSorted,99)], ["max", allSorted[T-1]],
  ];
  for (const [k,v] of distKeys) md.push(`| ${k} | ${v} |`);
  md.push("");

  // 배지 분포
  md.push("## 2. 배지 분포\n");
  md.push("| 배지 | 건수 | 비율 |");
  md.push("|------|------|------|");
  const b85cnt   = allDisplay.filter(v=>v>=85).length;
  const b7584cnt = allDisplay.filter(v=>v>=75&&v<85).length;
  const b6174cnt = allDisplay.filter(v=>v>=61&&v<75).length;
  const b60cnt   = allDisplay.filter(v=>v<=60).length;
  md.push(`| 85+ 아주좋음 | ${b85cnt} | ${Math.round(b85cnt/T*100)}% |`);
  md.push(`| 75~84 좋음 | ${b7584cnt} | ${Math.round(b7584cnt/T*100)}% |`);
  md.push(`| 61~74 보통 | ${b6174cnt} | ${Math.round(b6174cnt/T*100)}% |`);
  md.push(`| 60이하 주의 | ${b60cnt} | ${Math.round(b60cnt/T*100)}% |`);
  md.push("");

  // 프로필 평균 분포
  md.push("## 3. 프로필 평균 분포\n");
  const profAvgs = profileResults.map(r=>r.avg);
  const profAvgsSorted = [...profAvgs].sort((a,b)=>a-b);
  md.push(`| 지표 | 값 |`);
  md.push(`|------|-----|`);
  md.push(`| profile avg min | ${profAvgsSorted[0]} |`);
  md.push(`| profile avg max | ${profAvgsSorted[profAvgsSorted.length-1]} |`);
  md.push(`| inter-user std | ${r1(stdevFn(profAvgs))} |`);
  md.push(`| 65~69 범위 | ${profAvgs.filter(v=>v>=65&&v<=69).length}개 |`);
  md.push(`| 68~72 범위 | ${profAvgs.filter(v=>v>=68&&v<=72).length}개 |`);
  md.push(`| 70~74 범위 | ${profAvgs.filter(v=>v>=70&&v<=74).length}개 |`);
  md.push(`| avg < 64 | ${profAvgs.filter(v=>v<64).length}개 |`);
  md.push(`| avg > 74 | ${profAvgs.filter(v=>v>74).length}개 |`);
  md.push("");

  // 프로필별 상세 테이블
  md.push("## 4. 프로필별 상세\n");
  md.push("| 프로필 | rawAvg | offset | displayAvg | std | range | 85+ | 75~84 | 61~74 | 60이하 |");
  md.push("|--------|--------|--------|------------|-----|-------|-----|-------|-------|--------|");
  for (const r of profileResults) {
    const sign = r.offset >= 0 ? "+" : "";
    md.push(`| ${r.label} | ${r.rawAvg} | ${sign}${r.offset} | ${r.avg} | ${r.std} | ${r.range} | ${r.b85p}% | ${r.b7584}% | ${r.b6174}% | ${r.b60m}% |`);
  }
  md.push("");

  // 극단값 상세
  md.push("## 5. 극단값\n");
  const top20 = allSorted.slice(-20).reverse();
  const bot20 = allSorted.slice(0, 20);
  md.push(`95이상: ${allDisplay.filter(v=>v>=95).length}건  `);
  md.push(`90이상: ${allDisplay.filter(v=>v>=90).length}건  `);
  md.push(`50이하: ${allDisplay.filter(v=>v<=50).length}건  `);
  md.push(`40대: ${allDisplay.filter(v=>v>=40&&v<50).length}건\n`);
  md.push(`상위 20개: ${top20.join(", ")}  `);
  md.push(`하위 20개: ${bot20.join(", ")}\n`);

  fs.writeFileSync(path.join(OUT,"n67p5_report.md"), md.join("\n"), "utf8");

  // ── 6. 채팅 요약 출력 ─────────────────────────────────────────────────────
  const line = "══════════════════════════════════════════════════════════════";
  const dash = "──────────────────────────────────────────────────────────────";

  console.log(line);
  console.log("요약 1: 전체 분포");
  console.log(line + "\n");
  const gKeys: [string, number][] = [
    ["avg", r1(avgFn(allDisplay))], ["std", r1(stdevFn(allDisplay))],
    ["min", allSorted[0]],
    ["p1",  pct(allSorted,1)],  ["p5",  pct(allSorted,5)],
    ["p25", pct(allSorted,25)], ["p50", pct(allSorted,50)],
    ["p75", pct(allSorted,75)], ["p95", pct(allSorted,95)],
    ["p99", pct(allSorted,99)], ["max", allSorted[T-1]],
  ];
  for (const [k,v] of gKeys) console.log(`  ${k.padEnd(6)} ${pad(v,7)}`);
  const span = pct(allSorted,95) - pct(allSorted,5);
  console.log(`\n  p5~p95 범위: ${span}점`);

  console.log("\n" + line);
  console.log("요약 2: 배지 분포");
  console.log(line + "\n");
  const badgePct = [
    ["85+ 아주좋음",  Math.round(b85cnt/T*100),   b85cnt],
    ["75~84 좋음",    Math.round(b7584cnt/T*100),  b7584cnt],
    ["61~74 보통",    Math.round(b6174cnt/T*100),  b6174cnt],
    ["60이하 주의",   Math.round(b60cnt/T*100),    b60cnt],
  ] as [string, number, number][];
  for (const [label, pct_, cnt] of badgePct) {
    const bar = "█".repeat(Math.round(pct_/2));
    console.log(`  ${label.padEnd(14)} ${pad(pct_+"%", 5)}  (${cnt}건)  ${bar}`);
  }

  console.log("\n" + line);
  console.log("요약 3: 프로필 평균 분포");
  console.log(line + "\n");
  const interStd = r1(stdevFn(profAvgs));
  console.log(`  inter-user std: ${interStd}`);
  console.log(`  profile avg 범위: [${profAvgsSorted[0]} ~ ${profAvgsSorted[profAvgsSorted.length-1]}]`);
  console.log(`  65~69: ${profAvgs.filter(v=>v>=65&&v<=69).length}명`);
  console.log(`  68~72: ${profAvgs.filter(v=>v>=68&&v<=72).length}명`);
  console.log(`  70~74: ${profAvgs.filter(v=>v>=70&&v<=74).length}명`);
  console.log(`  avg < 64: ${profAvgs.filter(v=>v<64).length}명`);
  console.log(`  avg > 74: ${profAvgs.filter(v=>v>74).length}명`);

  console.log("\n" + line);
  console.log("요약 4: 프로필별 변동성");
  console.log(line + "\n");
  const ranges = profileResults.map(r=>r.range);
  const stds   = profileResults.map(r=>r.std);
  console.log(`  range 평균: ${r1(avgFn(ranges))}  min: ${Math.min(...ranges)}  max: ${Math.max(...ranges)}`);
  console.log(`  std 평균:   ${r1(avgFn(stds))}  min: ${Math.min(...stds)}  max: ${Math.max(...stds)}`);
  console.log(`  range < 25: ${ranges.filter(v=>v<25).length}명`);
  console.log(`  std < 5:    ${stds.filter(v=>v<5).length}명`);

  console.log("\n" + line);
  console.log("요약 5: 극단값");
  console.log(line + "\n");
  console.log(`  95이상:  ${allDisplay.filter(v=>v>=95).length}건`);
  console.log(`  90이상:  ${allDisplay.filter(v=>v>=90).length}건`);
  console.log(`  85이상:  ${allDisplay.filter(v=>v>=85).length}건`);
  console.log(`  50이하:  ${allDisplay.filter(v=>v<=50).length}건`);
  console.log(`  40대:    ${allDisplay.filter(v=>v>=40&&v<50).length}건`);
  const top20console = allSorted.slice(-20).reverse();
  const bot20console = allSorted.slice(0, 20);
  console.log(`\n  상위 20개: ${top20console.join(" ")}`);
  console.log(`  하위 20개: ${bot20console.join(" ")}`);

  console.log("\n" + line);
  console.log("요약 6: 이상 프로필 탐지");
  console.log(line + "\n");
  const anomalyChecks: [string, (r: ProfileResult)=>boolean][] = [
    ["avg < 64",          r => r.avg < 64],
    ["avg > 74",          r => r.avg > 74],
    ["range < 25",        r => r.range < 25],
    ["std < 5",           r => r.std < 5],
    ["85+ 비율 > 20%",    r => r.b85p > 20],
    ["주의 비율 > 30%",   r => r.b60m > 30],
    ["주의 비율 < 3%",    r => r.b60m < 3],
  ];
  let hasAnomaly = false;
  for (const [label, fn] of anomalyChecks) {
    const flagged = profileResults.filter(fn);
    const flag = flagged.length > 0 ? `⚠ ${flagged.length}명` : "✅";
    console.log(`  ${label.padEnd(22)} ${flag}`);
    if (flagged.length > 0) {
      hasAnomaly = true;
      console.log(`    → ${flagged.map(r=>r.label).join(", ")}`);
    }
  }
  if (!hasAnomaly) console.log("  이상 프로필 없음");

  console.log("\n" + line);
  console.log("요약 7: 판단 기준 체크");
  console.log(line + "\n");
  const globalAvg = r1(avgFn(allDisplay));
  const globalStd = r1(stdevFn(allDisplay));
  const b85pct    = Math.round(b85cnt/T*100);
  const b7584pct  = Math.round(b7584cnt/T*100);
  const b6174pct  = Math.round(b6174cnt/T*100);
  const b60pct    = Math.round(b60cnt/T*100);
  const p5v = pct(allSorted,5), p95v = pct(allSorted,95);
  const span2 = p95v - p5v;

  const checks: [string, boolean][] = [
    [`전체 avg 70~72 근처 (현재: ${globalAvg})`,        globalAvg >= 70 && globalAvg <= 72],
    [`전체 std 8~11 (현재: ${globalStd})`,              globalStd >= 8 && globalStd <= 11],
    [`p5~p95 범위 28이상 (현재: ${span2})`,             span2 >= 28],
    [`85+ 아주좋음 5~15% (현재: ${b85pct}%)`,           b85pct >= 5 && b85pct <= 15],
    [`75~84 좋음 15~30% (현재: ${b7584pct}%)`,          b7584pct >= 15 && b7584pct <= 30],
    [`61~74 보통 45~65% (현재: ${b6174pct}%)`,          b6174pct >= 45 && b6174pct <= 65],
    [`60이하 주의 8~20% (현재: ${b60pct}%)`,            b60pct >= 8 && b60pct <= 20],
    [`inter-user std ≤ 2 (현재: ${interStd})`,          interStd <= 2],
    [`range 평균 ≥ 28 (현재: ${r1(avgFn(ranges))})`,   r1(avgFn(ranges)) >= 28],
    [`std 평균 ≥ 7 (현재: ${r1(avgFn(stds))})`,        r1(avgFn(stds)) >= 7],
    [`avg < 64 프로필 없음 (현재: ${profAvgs.filter(v=>v<64).length}명)`, profAvgs.filter(v=>v<64).length === 0],
    [`avg > 74 프로필 ≤ 5 (현재: ${profAvgs.filter(v=>v>74).length}명)`, profAvgs.filter(v=>v>74).length <= 5],
    [`90이상 존재 (현재: ${allDisplay.filter(v=>v>=90).length}건)`,       allDisplay.filter(v=>v>=90).length > 0],
  ];

  let passCount = 0;
  for (const [label, ok] of checks) {
    console.log(`  ${ok ? "✅" : "❌"}  ${label}`);
    if (ok) passCount++;
  }
  console.log(`\n  총점: ${passCount}/${checks.length}`);

  console.log("\n상세 파일 저장:");
  console.log(`  scripts/output/n67p5_detail.csv  (${T+1}행)`);
  console.log(`  scripts/output/n67p5_profile_summary.csv  (${N+1}행)`);
  console.log(`  scripts/output/n67p5_report.md`);
  console.log("\n✅ 완료");
}

main().catch(console.error);
