/**
 * 종목별 소모 열량 - 순수 수식. 열량 계산과 같은 이유로 AI를 쓰지 않는다.
 *
 * MET(대사당량)는 가만히 앉아 있을 때를 1로 놓고 그 운동이 몇 배로 힘든지를 나타낸다.
 * 값은 운동생리학에서 널리 쓰는 표(Compendium of Physical Activities)를 옮긴 것이며,
 * 사람과 강도에 따라 달라지는 추정치다.
 */

export interface ExerciseKind {
  name: string;
  met: number;
  /** 화면에서 묶어 보여줄 갈래 */
  group: "걷기·달리기" | "자전거·수영" | "근력·홈트" | "구기·라켓" | "야외·레저";
}

export const EXERCISES: ExerciseKind[] = [
  { name: "걷기 (보통)", met: 3.0, group: "걷기·달리기" },
  { name: "빠르게 걷기", met: 4.3, group: "걷기·달리기" },
  { name: "조깅", met: 7.0, group: "걷기·달리기" },
  { name: "러닝 (10km/h)", met: 10.0, group: "걷기·달리기" },
  { name: "러닝 (빠르게)", met: 12.5, group: "걷기·달리기" },
  { name: "트레드밀 걷기", met: 4.0, group: "걷기·달리기" },
  { name: "계단 오르기", met: 8.0, group: "걷기·달리기" },

  { name: "자전거 (가볍게)", met: 6.0, group: "자전거·수영" },
  { name: "자전거 (빠르게)", met: 8.5, group: "자전거·수영" },
  { name: "실내 사이클 · 스피닝", met: 7.0, group: "자전거·수영" },
  { name: "수영 (천천히)", met: 6.0, group: "자전거·수영" },
  { name: "수영 (자유형)", met: 8.3, group: "자전거·수영" },
  { name: "아쿠아로빅", met: 5.5, group: "자전거·수영" },
  { name: "로잉머신", met: 7.0, group: "자전거·수영" },

  { name: "웨이트 (가볍게)", met: 3.5, group: "근력·홈트" },
  { name: "웨이트 (고강도)", met: 6.0, group: "근력·홈트" },
  { name: "맨몸 홈트", met: 5.0, group: "근력·홈트" },
  { name: "크로스핏 · 서킷", met: 8.0, group: "근력·홈트" },
  { name: "줄넘기", met: 11.0, group: "근력·홈트" },
  { name: "복싱 (샌드백)", met: 6.0, group: "근력·홈트" },
  { name: "필라테스", met: 3.0, group: "근력·홈트" },
  { name: "요가", met: 2.5, group: "근력·홈트" },
  { name: "스트레칭", met: 2.3, group: "근력·홈트" },
  { name: "댄스 · 줌바", met: 6.5, group: "근력·홈트" },

  { name: "축구", met: 7.0, group: "구기·라켓" },
  { name: "농구", met: 6.5, group: "구기·라켓" },
  { name: "배드민턴", met: 5.5, group: "구기·라켓" },
  { name: "테니스", met: 7.3, group: "구기·라켓" },
  { name: "탁구", met: 4.0, group: "구기·라켓" },
  { name: "볼링", met: 3.8, group: "구기·라켓" },

  { name: "등산", met: 6.5, group: "야외·레저" },
  { name: "서핑", met: 3.5, group: "야외·레저" },
  { name: "패들보드 (SUP)", met: 6.0, group: "야외·레저" },
  { name: "클라이밍", met: 8.0, group: "야외·레저" },
  { name: "스키 · 스노보드", met: 6.0, group: "야외·레저" },
  { name: "스케이트보드", met: 5.0, group: "야외·레저" },
  { name: "골프 (걸어서)", met: 4.8, group: "야외·레저" },
  { name: "인라인 · 롤러", met: 7.5, group: "야외·레저" },
];

export const EXERCISE_GROUPS = [
  "걷기·달리기",
  "자전거·수영",
  "근력·홈트",
  "구기·라켓",
  "야외·레저",
] as const;

export function findExercise(name: string): ExerciseKind | undefined {
  return EXERCISES.find((e) => e.name === name);
}

/** 체중을 모를 때 쓸 값. 프로필을 채우면 그 체중으로 계산한다 */
const DEFAULT_WEIGHT_KG = 70;

/**
 * 운동으로 태운 열량(kcal).
 *
 * MET 1은 가만히 있을 때의 대사량이라, 그 몫은 운동으로 태운 것이 아니다.
 * 이 앱의 목표치("움직여 태울 열량" = TDEE − 기초대사량)와 자를 맞추려고
 * 1을 빼고 계산한다. 건강 앱이 말하는 "활동 에너지"와도 같은 기준이 된다.
 */
export function exerciseKcal(met: number, minutes: number, weightKg?: number): number {
  const weight = weightKg && weightKg > 0 ? weightKg : DEFAULT_WEIGHT_KG;
  const perMinute = ((met - 1) * 3.5 * weight) / 200;
  return Math.max(0, Math.round(perMinute * minutes));
}

/**
 * zod enum에 넣을 종목 이름들.
 * 모델이 없는 종목을 지어내면 MET을 못 찾아 소모 열량이 0이 된다. 목록 안에서만 고르게 묶는다.
 */
export const EXERCISE_NAMES = EXERCISES.map((e) => e.name) as [string, ...string[]];
