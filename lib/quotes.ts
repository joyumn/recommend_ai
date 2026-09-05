/**
 * 매일 바뀌는 응원 문구.
 *
 * 인터넷이나 API가 막혀도 화면이 비지 않도록 앱 안에 문구를 넣어둔다.
 * 출처가 불분명한 유명인 인용은 넣지 않았다. 전해 내려오는 속담과,
 * 이 앱이 직접 쓴 응원 문장만 담는다.
 */

export interface Quote {
  text: string;
  author: string;
}

const BUILTIN: Quote[] = [
  { text: "천 리 길도 한 걸음부터.", author: "속담" },
  { text: "티끌 모아 태산.", author: "속담" },
  { text: "열 번 찍어 아니 넘어가는 나무 없다.", author: "속담" },
  { text: "시작이 반이다.", author: "속담" },
  { text: "공든 탑이 무너지랴.", author: "속담" },
  { text: "느리게 가도 좋습니다. 멈추지만 않으면 도착합니다.", author: "몸친" },
  { text: "오늘 한 끼를 완벽하게 못 지켰다고 어제까지가 사라지지 않습니다.", author: "몸친" },
  { text: "몸은 어제 먹은 것과 어제 움직인 것으로 만들어집니다. 오늘도 한 칸을 쌓는 날입니다.", author: "몸친" },
  { text: "남길 부분을 아는 것도 실력입니다.", author: "몸친" },
  { text: "체중계 숫자는 하루에도 오르내립니다. 일주일 흐름만 보세요.", author: "몸친" },
  { text: "완벽한 하루 하나보다, 무난한 하루 열흘이 셉니다.", author: "몸친" },
  { text: "배가 부른 것과 충분히 먹은 것은 다릅니다.", author: "몸친" },
  { text: "운동복을 입는 데까지가 가장 어렵습니다. 거기까지만 해보세요.", author: "몸친" },
  { text: "오늘 10분이 내일의 30분을 만듭니다.", author: "몸친" },
  { text: "잘 잔 날은 덜 먹게 됩니다. 오늘은 조금 일찍 누워보세요.", author: "몸친" },
  { text: "먹고 나서 후회하는 대신, 다음 한 끼를 정하세요.", author: "몸친" },
  { text: "물 한 잔이 군것질 하나를 대신할 때가 많습니다.", author: "몸친" },
  { text: "계단은 오늘 만날 수 있는 가장 가까운 운동기구입니다.", author: "몸친" },
  { text: "단백질을 먼저 채우면 나머지는 알아서 줄어듭니다.", author: "몸친" },
  { text: "어제보다 조금 나은 선택. 그게 전부입니다.", author: "몸친" },
  { text: "굶는 것은 계획이 아닙니다. 버티는 것이 계획입니다.", author: "몸친" },
  { text: "국물을 남기는 것만으로도 오늘의 절반은 지켰습니다.", author: "몸친" },
  { text: "약속 자리에서도 방법은 있습니다. 먹을 부분을 고르면 됩니다.", author: "몸친" },
  { text: "몸이 변하는 건 늘 결심보다 늦게 옵니다. 조금만 더 기다려주세요.", author: "몸친" },
  { text: "오늘의 목표는 완벽이 아니라 기록입니다.", author: "몸친" },
  { text: "쉬는 날도 계획의 일부입니다. 죄책감 없이 쉬세요.", author: "몸친" },
  { text: "많이 걷는 사람이 결국 이깁니다.", author: "몸친" },
  { text: "저녁을 가볍게 하면 내일 아침이 가볍습니다.", author: "몸친" },
  { text: "한 번 어긋난 날은 되돌리는 날이 아니라, 그냥 다음 날입니다.", author: "몸친" },
  { text: "지금 이 화면을 켠 것도 오늘의 실천입니다.", author: "몸친" },
];

/** 날짜 문자열 -> 정수. 같은 날에는 같은 문구가 나와야 한다 */
function seed(dateKey: string): number {
  let h = 0;
  for (let i = 0; i < dateKey.length; i++) {
    h = (h * 31 + dateKey.charCodeAt(i)) >>> 0;
  }
  return h;
}

/**
 * 오늘의 내장 문구.
 * offset을 올리면 같은 날에도 다음 문구로 넘어간다("다른 문구 보기"에 쓴다).
 */
export function builtinQuote(dateKey: string, offset = 0): Quote {
  return BUILTIN[(seed(dateKey) + offset) % BUILTIN.length];
}

export const BUILTIN_COUNT = BUILTIN.length;
