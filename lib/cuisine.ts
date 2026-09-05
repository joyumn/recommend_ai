/**
 * 음식 갈래. 근처 식당을 고를 때 "오늘은 한식" 같은 기준을 준다.
 *
 * 카카오 장소 검색은 좌표로 찾을 때 업종을 세분해서 걸러주지 않는다.
 * 그래서 갈래를 고르면 그 말을 검색어로 넣어 다시 찾고, 받아온 목록도 한 번 더 거른다.
 */

export const CUISINES = ["전체", "한식", "중식", "일식", "양식", "채식"] as const;
export type Cuisine = (typeof CUISINES)[number];
export type PickedCuisine = Exclude<Cuisine, "전체">;

/** 카카오가 돌려주는 category_name에 이 말이 있으면 그 갈래로 본다 */
const MATCH: Record<PickedCuisine, RegExp> = {
  한식: /한식|백반|국밥|해장|찌개|전골|칼국수|국수|냉면|족발|보쌈|삼계|곰탕|설렁탕|고기|구이|쌈밥|한정식|분식|김밥|떡볶이|죽/,
  중식: /중식|중국|마라|훠궈|딤섬|양꼬치/,
  일식: /일식|초밥|스시|돈까스|돈카츠|라멘|우동|소바|이자카야|회|참치|규동/,
  양식: /양식|이탈리|파스타|피자|스테이크|햄버거|버거|멕시칸|브런치|샌드위치|프렌치|스페인|그릴/,
  채식: /채식|비건|샐러드|사찰|두부|샤브|월남쌈|포케/,
};

/** 그 갈래를 찾을 때 쓸 검색어 */
const KEYWORD: Record<PickedCuisine, string> = {
  한식: "한식",
  중식: "중국집",
  일식: "일식",
  양식: "양식 레스토랑",
  채식: "샐러드",
};

export function isPicked(c: Cuisine): c is PickedCuisine {
  return c !== "전체";
}

export function cuisineKeyword(c: PickedCuisine): string {
  return KEYWORD[c];
}

export function matchesCuisine(categoryName: string, c: Cuisine): boolean {
  if (!isPicked(c)) return true;
  return MATCH[c].test(categoryName);
}

/** 갈래별로 모델에게 덧붙일 주의사항 */
export const CUISINE_NOTE: Record<PickedCuisine, string> = {
  한식: "국물과 밥의 양을 조절해 권하세요.",
  중식: "기름과 소스가 많은 편입니다. 볶음 기름과 소스를 남기는 쪽으로 권하세요.",
  일식: "튀김옷과 소스, 밥의 양을 눈여겨보세요.",
  양식: "크림·치즈·드레싱이 열량을 좌우합니다. 소스는 따로 달라고 하는 방법도 알려주세요.",
  채식: "고기가 없어도 튀김·드레싱·견과류로 열량이 올라갑니다. 단백질원이 부족하지 않은지 함께 보세요.",
};
