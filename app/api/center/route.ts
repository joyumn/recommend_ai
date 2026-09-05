import { NextResponse } from "next/server";
import { generateJson, assertApiKey, friendlyError } from "@/lib/claude";
import { CenterSchema, type CenterPick } from "@/lib/schema";
import { exerciseKcal, findExercise, EXERCISE_NAMES } from "@/lib/exercise";
import { WEEKS_PER_MONTH, type WeeklyRoutine } from "@/lib/routine";
import {
  centerKeywords,
  toKind,
  isPickedKind,
  isSportsPlace,
  kindExercise,
  KIND_NOTE,
  matchesKind,
  type CenterKind,
} from "@/lib/center";

export const maxDuration = 60;

interface KakaoDoc {
  place_name: string;
  category_name: string;
  road_address_name: string;
  address_name: string;
  distance: string;
  place_url: string;
}

const SYSTEM = `당신은 한국의 운동시설 사정에 밝은 코치입니다.
실제로 존재하는 근처 운동센터 목록을 받아, 이 사람의 주간 운동량에 맞는 곳을 골라 추천합니다.

규칙:
- placeName, categoryName, distanceM, placeUrl은 **받은 목록의 값을 그대로** 옮기세요. 지어내지 마세요.
- exerciseName은 **주어진 종목 목록 안에서만** 고르세요. 그 이름으로 소모 열량을 계산하므로 목록에 없는 말을 쓰면 안 됩니다.
- 값(priceLow, priceHigh)은 **실제 가격표가 아니라 그 동네 시세와 업종으로 미루어 본 추정 범위**입니다.
  - payType이 "월정액"이면 한 달 회비, "회당"이면 1회 값을 쓰세요. 한 달치로 곱하지 마세요. 곱셈은 이쪽에서 합니다.
  - 대부분은 월 회원권으로 다닙니다. **그 센터에서 가장 흔한 등록 방식**을 payType으로 쓰세요.
    PT나 1:1 개인 수업처럼 회당 결제가 기본인 곳만 "회당"으로 하고, 그룹 수업이 있는 곳은 "월정액"으로 하세요.
  - 확신이 없을수록 하한과 상한을 넓게 잡으세요. 좁게 잡아 틀리는 것보다 낫습니다.
  - priceBasis에는 왜 그 금액이라고 봤는지 한 문장으로 쓰세요. 예: "역세권 프랜차이즈라 12개월 등록 기준", "구민체육센터라 공공 요금"
  - 상호에 프랜차이즈 이름이 보이면 그 브랜드의 통상 가격대를, 동네 이름이 보이면 그 지역 물가를 반영하세요.
- program에는 **무엇을 어떻게 할지만** 쓰세요. 주 몇 회·회당 몇 분인지는 앱이 따로 보여주므로 적지 마세요.
  적으면 앱이 계산한 횟수와 어긋나 두 숫자가 화면에 나란히 보입니다.
- fitScore는 이 사람의 주간 운동량과 목표에 얼마나 맞는지 1~5로 매기세요. 거리가 멀거나 값이 크게 부담되면 낮게 주세요.
- 같은 종류가 여러 곳이어도 그대로 두세요. 갈래를 억지로 섞지 말고 좋은 곳부터 담으세요.
- 목록에서 5~7곳만 골라 담으세요. 문장은 짧게 쓰세요.
- 의학적 진단이나 치료를 말하지 마세요.
- 한국어 존댓말로 답하세요.`;

interface Body {
  lat?: number;
  lng?: number;
  keyword?: string;
  kind?: CenterKind;
  /** 화면에서 계산해 보내온 주간 운동량. 값과 열량 계산의 기준이 된다 */
  routine?: WeeklyRoutine;
  weightKg?: number;
}

async function searchKakao(url: string): Promise<KakaoDoc[] | { error: string; status: number }> {
  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${process.env.KAKAO_REST_KEY}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[kakao]", res.status, text);
    return {
      error: `카카오 검색 실패 (${res.status}). REST API 키를 확인해주세요.`,
      status: 502,
    };
  }

  const json = (await res.json()) as { documents: KakaoDoc[] };
  return json.documents ?? [];
}

export async function POST(req: Request) {
  try {
    assertApiKey();
    if (!process.env.KAKAO_REST_KEY) {
      return NextResponse.json(
        { error: "KAKAO_REST_KEY가 설정되지 않았습니다. .env.local 또는 Vercel 환경변수를 확인하세요." },
        { status: 500 },
      );
    }

    const body = (await req.json()) as Body;
    const { lat, lng, keyword, routine, weightKg } = body;
    const kind: CenterKind = toKind(body.kind);
    const hasCoords = typeof lat === "number" && typeof lng === "number";

    if (!hasCoords && !(keyword && keyword.trim())) {
      return NextResponse.json({ error: "위치 또는 동네 이름이 필요합니다." }, { status: 400 });
    }
    if (!routine) {
      return NextResponse.json(
        { error: "먼저 내 계획에서 프로필을 채워주세요. 주간 운동량이 있어야 센터를 고를 수 있습니다." },
        { status: 400 },
      );
    }

    /**
     * 카카오에는 음식점(FD6) 같은 운동시설 업종 코드가 없다.
     * 그래서 좌표만으로 훑는 category.json을 못 쓰고 언제나 검색어로 찾는다.
     */
    function buildUrl(q: string): string {
      if (hasCoords) {
        return (
          `https://dapi.kakao.com/v2/local/search/keyword.json` +
          `?query=${encodeURIComponent(q)}` +
          `&x=${lng}&y=${lat}&radius=2000&sort=distance&size=15`
        );
      }
      return (
        `https://dapi.kakao.com/v2/local/search/keyword.json` +
        `?query=${encodeURIComponent(`${keyword!.trim()} ${q}`)}&size=15`
      );
    }

    /** 검색어 여러 개를 한꺼번에 훑고 같은 곳은 하나로 합친다 */
    async function searchMany(
      queries: string[],
    ): Promise<KakaoDoc[] | { error: string; status: number }> {
      const results = await Promise.all(queries.map((q) => searchKakao(buildUrl(q))));
      const failed = results.find((r) => !Array.isArray(r));
      if (failed && !Array.isArray(failed)) return failed;

      const seen = new Map<string, KakaoDoc>();
      for (const r of results) {
        if (!Array.isArray(r)) continue;
        for (const d of r) seen.set(d.place_url, d);
      }
      return [...seen.values()].sort(
        (a, b) => (Number(a.distance) || 0) - (Number(b.distance) || 0),
      );
    }

    let found = await searchMany(centerKeywords(kind));
    if (!Array.isArray(found)) {
      return NextResponse.json({ error: found.error }, { status: found.status });
    }

    // 그 갈래가 근처에 아예 없을 수 있다. 빈손으로 돌려보내는 대신 갈래를 풀고 다시 찾는다
    let fellBack = false;
    if (found.length === 0 && isPickedKind(kind)) {
      const retry = await searchMany(centerKeywords("전체"));
      if (!Array.isArray(retry)) {
        return NextResponse.json({ error: retry.error }, { status: retry.status });
      }
      found = retry;
      fellBack = true;
    }

    const all = found.map((d) => ({
      placeName: d.place_name,
      categoryName: d.category_name,
      distanceM: Number(d.distance) || 0,
      placeUrl: d.place_url,
      address: d.road_address_name || d.address_name,
    }));

    // 업종 코드로 좁힐 수 없어 부동산·학원 같은 곳이 섞여 온다. 스포츠시설부터 골라낸다
    const sports = all.filter((p) => isSportsPlace(p.categoryName));
    const base = sports.length > 0 ? sports : all;

    let places = base;
    let note: string | null = null;

    if (isPickedKind(kind)) {
      const matched = base.filter((p) => matchesKind(`${p.placeName} ${p.categoryName}`, kind));
      if (!fellBack && matched.length >= 3) {
        places = matched;
      } else if (!fellBack && matched.length > 0) {
        places = base;
        note = `근처에 ${kind}이(가) ${matched.length}곳뿐이라 다른 종류도 함께 살펴봤습니다.`;
      } else {
        places = base;
        note =
          base.length > 0
            ? `근처에서 ${kind}을(를) 찾지 못해 다른 종류에서 골랐습니다.`
            : "근처에서 운동센터를 찾지 못했습니다.";
      }
    }

    if (places.length === 0) {
      return NextResponse.json({ picks: [], note });
    }

    const routineText = [
      `이 사람에게 권하는 주간 운동량: 주 ${routine.perWeek}회 · 회당 ${routine.minutesPerSession}분 (주 ${routine.weeklyMinutes}분)`,
      `그중 유산소 ${routine.cardioPerWeek}회, 근력 ${routine.strengthPerWeek}회`,
      routine.why,
    ].join("\n");

    const wants = isPickedKind(kind)
      ? `찾는 종류: ${kind}. ${KIND_NOTE[kind]} 어울리는 종목은 보통 "${kindExercise(kind)}"입니다.${
          note ? ` (${note} 목록에 다른 종류가 섞여 있으면 가까운 쪽을 골라주세요.)` : ""
        }`
      : "";

    const result = await generateJson({
      system: SYSTEM,
      schema: CenterSchema,
      // 값을 매기고 짧은 글을 쓰는 일이라 깊이 따질 것이 없다. 60초 안에 끝내는 쪽을 택한다
      effort: "low",
      prompt: [
        routineText,
        wants,
        "",
        `exerciseName은 다음 중에서만 고르세요: ${EXERCISE_NAMES.join(", ")}`,
        "",
        "아래는 실제 근처 운동센터 목록입니다. 이 중에서 골라주세요.",
        "",
        JSON.stringify(places, null, 2),
      ]
        .filter((line) => line !== "")
        .join("\n"),
    });

    /**
     * 월 비용과 소모 열량은 여기서 셈한다.
     * 모델에게 곱셈을 시키면 같은 단가에서도 매번 다른 월 비용이 나와 비교표가 흔들린다.
     */
    const picks: CenterPick[] = result.picks.map((p) => {
      const perMonth = p.payType === "회당" ? routine.perWeek * WEEKS_PER_MONTH : 1;
      const met = findExercise(p.exerciseName)?.met ?? 0;
      return {
        ...p,
        monthlyLow: Math.round((p.priceLow * perMonth) / 1000) * 1000,
        monthlyHigh: Math.round((p.priceHigh * perMonth) / 1000) * 1000,
        perSessionKcal: exerciseKcal(met, routine.minutesPerSession, weightKg),
      };
    });

    return NextResponse.json({ picks, note });
  } catch (e) {
    console.error("[/api/center]", e);
    return NextResponse.json({ error: friendlyError(e) }, { status: 500 });
  }
}
