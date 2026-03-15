/**
 * 할일 / 요약 생성기
 */
import type { ScoreMap } from "./sajuEngine";

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

const TODO_POOL: Record<string, string[]> = {
  wealth_high: ["투자 검토 및 분석","재무 계획 수립","수입원 다각화 검토","중요 금융 계약 검토","절약 계획 점검","재물 관련 미팅 배치"],
  wealth_low:  ["충동구매 자제","큰 금액 결정 보류","재정 지출 점검","투자 결정 연기","빌리거나 빌려주는 행위 자제"],
  love_high:   ["소중한 이와 시간 보내기","감사 표현·선물","새 인연 만남 시도","관계 심화 대화","이성 모임 참석"],
  love_low:    ["감정적 대화 자제","연애 관련 중요 결정 보류","오해 살 행동 조심","SNS 감정 표출 자제"],
  health_high: ["유산소·근력 운동","균형 잡힌 식단 유지","규칙적 수면","건강검진 예약","스트레칭·요가"],
  health_low:  ["과음·과식 자제","무리한 운동 금지","충분한 수면 확보","신체 피로 방치 금지","야간 과로 자제"],
  career_high: ["중요 미팅·발표 배치","도전적 과제 착수","리더십 발휘","창의적 기획·브레인스토밍","인맥 확장 모임 참석"],
  career_low:  ["새 사업·프로젝트 착수 보류","권위자와 충돌 자제","중요 계약 서명 연기","성급한 발언 주의"],
  overall_high:["이달의 목표 점검","감사 일기 쓰기","긍정적 자기 확언","새로운 도전 시도","소중한 사람에게 연락"],
  overall_low: ["내면 성찰·명상","혼자 집중하는 작업","현상 유지 전략","무리한 약속 자제","충분한 휴식"],
};

const TEN_GOD_TODOS: Record<string, { do: string; dont: string }> = {
  "傷官":{"do":"창작·기획 작업, 전문 기술 연습","dont":"권위자와 충돌, 성급한 발언"},
  "偏財":{"do":"투자 기회 탐색, 대인관계 확장","dont":"과도한 지출, 도박성 투자"},
  "正財":{"do":"장기 재무 계획, 안정적 저축","dont":"충동구매, 무리한 차용"},
  "食神":{"do":"취미·여가 즐기기, 창작 활동","dont":"폭식·폭음, 과소비"},
  "正官":{"do":"책임감 있는 업무 수행, 원칙 준수","dont":"규칙 위반, 독단적 행동"},
  "偏官":{"do":"현상 유지, 조용히 내실 다지기","dont":"새로운 시작, 위험한 도전"},
  "正印":{"do":"독서·학습, 멘토에게 조언 구하기","dont":"독단적 결정, 성급한 판단"},
  "偏印":{"do":"명상·내면 성찰, 직관 따르기","dont":"타인 험담, 과도한 교제"},
  "比肩":{"do":"혼자 독립적으로 작업","dont":"과한 경쟁 유발"},
  "劫財":{"do":"재정 점검, 불필요한 지출 차단","dont":"큰 금액 거래, 보증 서기"},
};

// 자연스러운 한국어로 factor 설명
const FACTOR_LABELS: Record<string, string> = {
  "傷官":"창의력이 넘치는",
  "偏財":"재물 기운이 흐르는",
  "正財":"안정적인 재물 흐름의",
  "食神":"풍요로운 기운의",
  "正官":"책임감이 빛나는",
  "偏官":"신중함이 필요한",
  "正印":"배움과 지혜의",
  "偏印":"내면의 직관이 깨어나는",
  "比肩":"독립적인 에너지의",
  "劫財":"재정 점검이 필요한",
  "化祿":"복록이 흐르는",
  "化權":"권위 에너지가 강한",
  "化科":"총명함이 빛나는",
  "化忌":"조심스러운 기운의",
};

// 따뜻하고 자연스러운 말투의 요약 템플릿
const SUMMARY_TEMPLATES: Record<string, string[]> = {
  "대길": [
    "{factor} 날이에요. 자신 있게 움직여 보세요!",
    "오늘은 에너지가 넘치는 {factor} 날이에요. 적극적으로 도전해 보세요.",
    "{factor} 날이에요. 좋은 기운이 가득하니 하고 싶은 일을 시작하기 딱 좋아요.",
  ],
  "길": [
    "{factor} 날이에요. 꾸준히 움직이면 좋은 결과로 이어질 거예요.",
    "좋은 흐름이 느껴지는 {factor} 날이에요. 계획대로 차근차근 진행해 보세요.",
    "{factor} 날이에요. 긍정적인 마음으로 하루를 보내면 좋을 것 같아요.",
  ],
  "보통": [
    "{factor} 날이에요. 무리하지 않고 편안하게 지내 보세요.",
    "평온한 {factor} 날이에요. 큰 기복 없이 안정적인 하루가 될 것 같아요.",
    "{factor} 날이에요. 자신을 잘 돌보며 차분하게 보내 보세요.",
  ],
  "주의": [
    "{factor} 날이에요. 오늘은 신중하게 행동하는 게 좋을 것 같아요.",
    "오늘은 에너지 소모에 주의가 필요한 {factor} 날이에요. 내실을 다져 보세요.",
    "{factor} 날이에요. 조급해하지 말고 차분히 하루를 보내 보세요.",
  ],
};

function sample<T>(arr: T[], n: number, rng: () => number): T[] {
  const copy = [...arr];
  const result: T[] = [];
  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = Math.floor(rng() * copy.length);
    result.push(copy.splice(idx, 1)[0]);
  }
  return result;
}

export function generateTodos(scores: ScoreMap, sajuFactors: Record<string, unknown>, _badge: string): { do_list: string[]; dont_list: string[] } {
  const w = scores.wealth ?? 65;
  const l = scores.love ?? 65;
  const h = scores.health ?? 65;
  const c = scores.career ?? 65;
  const o = scores.overall ?? 65;

  let doPool: string[] = [];
  let dontPool: string[] = [];

  doPool   = doPool.concat(TODO_POOL[w >= 65 ? "wealth_high" : "wealth_low"]);
  doPool   = doPool.concat(TODO_POOL[l >= 65 ? "love_high"   : "love_low"]);
  doPool   = doPool.concat(TODO_POOL[h >= 65 ? "health_high" : "health_low"]);
  doPool   = doPool.concat(TODO_POOL[c >= 65 ? "career_high" : "career_low"]);
  doPool   = doPool.concat(TODO_POOL[o >= 65 ? "overall_high": "overall_low"]);

  // dontPool uses OPPOSITE direction: when score is LOW → avoid the high-risk actions;
  // when score is HIGH → include cautionary reminders to not squander the good luck
  dontPool = dontPool.concat(TODO_POOL[w >= 65 ? "wealth_low"  : "wealth_high"]);
  dontPool = dontPool.concat(TODO_POOL[l >= 65 ? "love_low"    : "love_high"]);
  dontPool = dontPool.concat(TODO_POOL[h >= 65 ? "health_low"  : "health_high"]);
  dontPool = dontPool.concat(TODO_POOL[c >= 65 ? "career_low"  : "career_high"]);

  // ten_god_of_day 우선 (날짜마다 달라짐)
  const tenGod = (sajuFactors.ten_god_of_day as string) || (sajuFactors.ten_god_of_month as string);
  if (tenGod && TEN_GOD_TODOS[tenGod]) {
    doPool.unshift(TEN_GOD_TODOS[tenGod].do);
    dontPool.unshift(TEN_GOD_TODOS[tenGod].dont);
  }

  doPool   = [...new Map(doPool.map(x => [x, x])).values()];
  dontPool = [...new Map(dontPool.map(x => [x, x])).values()];

  const seedVal = Math.abs(Object.values(scores).reduce((a, b) => a + b, 0)) % 1000;
  const rng = seededRandom(seedVal);

  return {
    do_list:   sample(doPool.slice(0, 10),   Math.min(3, doPool.length),   rng),
    dont_list: sample(dontPool.slice(0, 10), Math.min(3, dontPool.length), rng),
  };
}

export function generateSummary(scores: ScoreMap, sajuFactors: Record<string, unknown>, _ziweiFactors: Record<string, unknown>): string {
  const overall = scores.overall ?? 65;
  const badge = overall >= 80 ? "대길" : overall >= 65 ? "길" : overall >= 52 ? "보통" : "주의";

  // ten_god_of_day 우선 참조 (날짜마다 달라짐)
  const tenGod = (sajuFactors.ten_god_of_day as string) || (sajuFactors.ten_god_of_month as string) || "";

  let factor = "";
  if (FACTOR_LABELS[tenGod]) {
    factor = FACTOR_LABELS[tenGod];
  } else if ((sajuFactors.active_stars as string[])?.length > 0) {
    factor = `특별한 기운이 감도는`;
  } else {
    factor = `오늘의 에너지(${overall}점)가 흐르는`;
  }

  const templates = SUMMARY_TEMPLATES[badge] ?? SUMMARY_TEMPLATES["보통"];
  // overall 점수를 시드에 포함해 같은 factor+badge도 점수에 따라 다른 문장 선택
  const seedVal = Math.abs(Math.round(overall) + (tenGod + badge).split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % templates.length;
  return templates[seedVal].replace("{factor}", factor);
}
