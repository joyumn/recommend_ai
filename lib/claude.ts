import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

/**
 * Claude 클라이언트. 서버(app/api/*)에서만 import 한다.
 * 브라우저 코드에서 쓰면 API 키가 그대로 노출된다.
 */
const client = new Anthropic();

/** 바꿔 끼울 수 있게 열어뒀다. 값은 ANTHROPIC_MODEL 환경변수로 넘긴다 */
export const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5";

/**
 * 생각 깊이. 값이 올라갈수록 답이 꼼꼼해지고 토큰을 더 쓴다.
 * 이 앱은 한 번 호출이 작아서, 판단이 필요한 곳만 medium을 쓴다.
 */
export type Effort = "low" | "medium" | "high";

export function assertApiKey() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY가 설정되지 않았습니다. .env.local 파일(로컬) 또는 Vercel 환경변수를 확인하세요.",
    );
  }
}

export type ImageMediaType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

export interface ImagePart {
  base64: string;
  mediaType: ImageMediaType;
}

/**
 * 사진의 실제 형식을 앞 몇 바이트로 알아낸다.
 *
 * 화면이 알려준 형식을 그대로 믿으면, 확장자와 내용이 다른 사진에서 API가 400을 낸다
 * ("jpeg라고 했는데 png로 보인다"). 눈으로 확인할 수 있는 것은 확인하고 넘긴다.
 */
export function sniffImageType(base64: string, fallback: ImageMediaType): ImageMediaType {
  const head = base64.slice(0, 16);
  if (head.startsWith("/9j/")) return "image/jpeg";
  if (head.startsWith("iVBORw0KGgo")) return "image/png";
  if (head.startsWith("R0lGOD")) return "image/gif";
  if (head.startsWith("UklGR")) return "image/webp";
  return fallback;
}

/**
 * 스키마에 맞는 JSON을 받아온다.
 *
 * output_config.format으로 zod 스키마를 그대로 넘기면 모델이 그 모양으로만 답한다.
 * SDK가 응답을 다시 zod로 검사해 parsed_output에 담아주므로, 모양이 어긋나면
 * 화면이 깨지기 전에 여기서 걸린다.
 */
export async function generateJson<T extends z.ZodType>({
  system,
  prompt,
  image,
  schema,
  effort = "medium",
  maxTokens = 8000,
}: {
  system: string;
  prompt: string;
  image?: ImagePart;
  schema: T;
  effort?: Effort;
  maxTokens?: number;
}): Promise<z.infer<T>> {
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];

  // 사진은 글보다 먼저 넣는다. 무엇을 보고 답해야 하는지 먼저 읽게 하려는 것이다
  if (image) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: sniffImageType(image.base64, image.mediaType),
        data: image.base64,
      },
    });
  }
  content.push({ type: "text", text: prompt });

  const res = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content }],
    output_config: { format: zodOutputFormat(schema), effort },
    // 안전 분류기가 거절하면 같은 요청을 다른 모델로 한 번 더 돌려준다.
    // 음식 사진에서 날 일은 드물지만, 났을 때 화면이 빈손이 되지 않게 켜 둔다.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  });

  if (res.stop_reason === "refusal") {
    throw new Error("이 요청에는 답할 수 없었습니다. 다른 사진이나 조건으로 다시 시도해주세요.");
  }

  const parsed = res.parsed_output;
  if (!parsed) {
    throw new Error("모델이 형식에 맞는 답을 돌려주지 않았습니다. 다시 시도해주세요.");
  }
  return parsed;
}

/**
 * 화면에 그대로 띄울 수 있는 한국어 오류 문구.
 * 크레딧이 떨어졌을 때가 특히 헷갈려서, 그 경우를 따로 짚어준다.
 */
export function friendlyError(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) {
    return "ANTHROPIC_API_KEY가 올바르지 않습니다. 키를 다시 확인해주세요.";
  }
  if (e instanceof Anthropic.RateLimitError) {
    return "요청이 몰렸습니다. 잠시 후 다시 시도해주세요.";
  }
  if (e instanceof Anthropic.BadRequestError) {
    // 크레딧 소진은 400으로 온다. 메시지에 credit balance가 들어 있다
    if (/credit balance/i.test(e.message)) {
      return "Anthropic 크레딧이 부족합니다. 콘솔에서 잔액을 확인하고 충전해주세요.";
    }
    return `요청이 거부되었습니다: ${e.message}`;
  }
  if (e instanceof Anthropic.APIError) {
    return `Claude 호출에 실패했습니다 (${e.status}). 잠시 후 다시 시도해주세요.`;
  }
  return e instanceof Error ? e.message : "알 수 없는 오류";
}
