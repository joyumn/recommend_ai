/**
 * 운동센터 갈래. 근처 운동센터를 찾을 때 "헬스장만" 같은 기준을 준다.
 *
 * 식당과 결정적으로 다른 점이 하나 있다.
 * 카카오 장소 검색에는 음식점(FD6)처럼 **운동시설을 가리키는 업종 코드가 없다.**
 * 그래서 좌표만으로 훑는 category.json을 쓸 수 없고, 언제나 검색어로 찾은 뒤
 * 받아온 category_name으로 한 번 더 걸러야 한다. 아래 표들이 그 일을 한다.
 */

import { findExercise } from "./exercise";

export const CENTER_KINDS = [
  "전체",
  "헬스장",
  "필라테스",
  "요가",
  "수영장",
  "크로스핏·복싱",
  "클라이밍",
] as const;

export type CenterKind = (typeof CENTER_KINDS)[number];
export type PickedKind = Exclude<CenterKind, "전체">;

/**
 * 그 갈래를 찾을 때 쓸 검색어.
 *
 * 배열인 이유: "크로스핏·복싱"처럼 한 갈래에 업종이 둘인 경우가 있고,
 * 업종 코드가 없어서 한 낱말로는 근처를 다 훑지 못하기 때문이다.
 */
const KEYWORD: Record<PickedKind, string[]> = {
  헬스장: ["헬스장", "피트니스"],
  필라테스: ["필라테스"],
  요가: ["요가원"],
  수영장: ["수영장"],
  "크로스핏·복싱": ["크로스핏", "복싱장"],
  클라이밍: ["클라이밍"],
};

/**
 * "전체"일 때 훑을 검색어.
 * 갈래별 검색어를 전부 쓰면 카카오를 여덟 번 부르게 되므로 대표만 남겼다.
 */
const ALL_KEYWORDS = ["헬스장", "필라테스", "요가원", "수영장", "크로스핏"];

/**
 * 이 말이 있으면 그 갈래로 본다.
 *
 * 업종만 보지 않고 상호까지 함께 본다. 운동시설은 카카오 업종이 "스포츠,레저"에서
 * 끊기는 경우가 잦은 반면(예: 레드포인트클라이밍센터), 종류는 거의 언제나 상호에 들어 있다.
 */
const MATCH: Record<PickedKind, RegExp> = {
  헬스장: /헬스|피트니스|휘트니스|짐$|트레이닝|웨이트/,
  필라테스: /필라테스/,
  요가: /요가/,
  수영장: /수영/,
  "크로스핏·복싱": /크로스핏|복싱|킥복싱|무에타이|주짓수|격투|태권도|검도|합기도/,
  클라이밍: /클라이밍|암벽|볼더/,
};

/**
 * 운동시설인지 아닌지.
 *
 * 업종 코드로 좁힐 수 없어서 "헬스장"으로 검색해도 부동산·카페·학원이 섞여 온다.
 * 갈래를 고르지 않았을 때(전체)는 이 그물이 유일한 거름망이라 식당 탭보다 중요하다.
 */
const IS_SPORTS =
  /스포츠|레저|헬스|피트니스|휘트니스|요가|필라테스|수영|체육|클라이밍|복싱|주짓수|무도|격투|크로스핏|골프|테니스|배드민턴|탁구|볼링|무술|태권도|검도|댄스|발레/;

export function isPickedKind(k: CenterKind): k is PickedKind {
  return k !== "전체";
}

/** 화면 밖에서 온 값일 수 있다. 모르는 말이면 전체로 본다 */
export function toKind(v: unknown): CenterKind {
  return (CENTER_KINDS as readonly string[]).includes(v as string) ? (v as CenterKind) : "전체";
}

/** 그 갈래를 찾을 검색어들. 전체면 대표 검색어를 돌려준다 */
export function centerKeywords(k: CenterKind): string[] {
  return (isPickedKind(k) && KEYWORD[k]) || ALL_KEYWORDS;
}

/** text에는 상호와 업종을 함께 넘긴다 */
export function matchesKind(text: string, k: CenterKind): boolean {
  if (!isPickedKind(k)) return true;
  return MATCH[k].test(text);
}

export function isSportsPlace(categoryName: string): boolean {
  return IS_SPORTS.test(categoryName);
}

/** 갈래별로 모델에게 덧붙일 주의사항. 값을 매길 때 놓치기 쉬운 것들 */
export const KIND_NOTE: Record<PickedKind, string> = {
  헬스장:
    "헬스장은 보통 월 정액이고 기간을 길게 끊을수록 월 단가가 내려갑니다. PT를 따로 붙이면 회당 결제라 값이 크게 뜁니다.",
  필라테스:
    "그룹 수업과 1:1 개인 수업의 값 차이가 가장 큰 종목입니다. 어느 쪽을 말하는지 priceBasis에 밝혀주세요.",
  요가: "월 정액이 흔하고 헬스장과 비슷하거나 조금 높습니다. 무제한권과 횟수권이 따로 있습니다.",
  수영장:
    "공공 수영장(구민체육센터)과 사설 수영장은 값이 두세 배 차이 납니다. 상호에서 공공인지 사설인지 짐작해 반영하세요.",
  "크로스핏·복싱":
    "크로스핏은 소수 정예라 헬스장보다 눈에 띄게 비쌉니다. 복싱·주짓수는 그 중간입니다.",
  클라이밍:
    "월 정액권과 1일 이용권이 함께 있습니다. 주 2회 이하로 다닐 생각이면 1일권이 쌀 수 있다는 점을 짚어주세요.",
};

/**
 * 갈래를 대표하는 종목 이름.
 *
 * MET 값을 여기 새로 적지 않는다. 소모 열량의 출처는 lib/exercise.ts 한 곳뿐이어야
 * 같은 운동이 화면마다 다른 열량으로 보이지 않는다.
 */
const KIND_EXERCISE: Record<PickedKind, string> = {
  헬스장: "웨이트 (고강도)",
  필라테스: "필라테스",
  요가: "요가",
  수영장: "수영 (자유형)",
  "크로스핏·복싱": "크로스핏 · 서킷",
  클라이밍: "클라이밍",
};

/** 갈래에 어울리는 종목. 이름은 lib/exercise.ts에 실제로 있는 것만 나온다 */
export function kindExercise(k: PickedKind): string {
  const name = KIND_EXERCISE[k];
  // 종목 이름을 고치면 여기가 먼저 깨져야 한다. 조용히 빈 값이 나가면 열량이 0이 된다
  if (!findExercise(name)) {
    throw new Error(`lib/exercise.ts에 "${name}" 종목이 없습니다.`);
  }
  return name;
}
