import { GoogleGenAI, type Part } from "@google/genai";
import type { z } from "zod";
import { z as zod } from "zod";

/**
 * Gemini 클라이언트. 서버(app/api/*)에서만 import 한다.
 * 브라우저 코드에서 쓰면 API 키가 그대로 노출된다.
 */
const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" });

/**
 * 무료 티어에서 쓸 수 있고 이미지도 읽는 모델.
 * gemini-2.5-flash는 모델 목록에는 보이지만 신규 사용자에게는 404가 난다.
 * 막히면 GEMINI_MODEL 환경변수로 갈아끼울 수 있게 열어뒀다.
 */
export const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.7-flash";

export function assertApiKey() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY가 설정되지 않았습니다. .env.local 파일(로컬) 또는 Vercel 환경변수를 확인하세요.",
    );
  }
}

/** zod 스키마를 Gemini가 받는 JSON Schema로. $schema 키만 빼면 그대로 통한다 */
function toGeminiSchema(schema: z.ZodType): unknown {
  const out = zod.toJSONSchema(schema) as Record<string, unknown>;
  delete out["$schema"];
  return out;
}

/**
 * 스키마에 맞는 JSON을 받아온다.
 * 응답을 zod로 한 번 더 검사하므로, 모양이 어긋나면 화면이 깨지기 전에 여기서 잡힌다.
 */
export async function generateJson<T extends z.ZodType>({
  system,
  parts,
  schema,
  temperature = 0.4,
}: {
  system: string;
  parts: Part[];
  schema: T;
  temperature?: number;
}): Promise<z.infer<T>> {
  const res = await genai.models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts }],
    config: {
      systemInstruction: system,
      responseMimeType: "application/json",
      responseJsonSchema: toGeminiSchema(schema),
      temperature,
    },
  });

  const text = res.text;
  if (!text) {
    throw new Error("모델이 빈 응답을 돌려줬습니다. 다시 시도해주세요.");
  }
  return schema.parse(JSON.parse(text));
}
