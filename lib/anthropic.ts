import Anthropic from "@anthropic-ai/sdk";

/**
 * Anthropic 클라이언트. 서버(app/api/*)에서만 import 한다.
 * 브라우저 코드에서 쓰면 API 키가 그대로 노출된다.
 */
export const anthropic = new Anthropic();

export const MODEL = "claude-opus-5";

/** API 키가 없을 때 500 대신 사람이 읽을 수 있는 메시지를 주기 위한 확인 */
export function assertApiKey() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY가 설정되지 않았습니다. .env.local 파일(로컬) 또는 Vercel 환경변수를 확인하세요.",
    );
  }
}
