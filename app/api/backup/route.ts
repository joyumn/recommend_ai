import { NextResponse } from "next/server";
import { assertBackupEnv, loadBackup, newCode, normalizeCode, saveBackup } from "@/lib/backup";

export const maxDuration = 30;

/**
 * 기록 백업과 불러오기.
 *
 * 로그인이 없으므로 코드가 곧 열쇠다. 코드를 모르면 남의 백업을 볼 수 없고,
 * 브라우저는 Supabase에 직접 붙지 않는다(키는 서버에만 있다).
 */

/** 앱 상태는 크지 않다. 이보다 크면 우리 것이 아니거나 잘못 보낸 것이다 */
const MAX_BYTES = 512 * 1024;

export async function POST(req: Request) {
  try {
    assertBackupEnv();

    const body = (await req.json()) as { code?: string; state?: unknown };
    if (!body.state || typeof body.state !== "object") {
      return NextResponse.json({ error: "백업할 기록이 없습니다." }, { status: 400 });
    }

    const size = JSON.stringify(body.state).length;
    if (size > MAX_BYTES) {
      return NextResponse.json({ error: "기록이 너무 큽니다." }, { status: 413 });
    }

    // 코드를 함께 보내면 그 백업을 갱신하고, 없으면 새 코드를 만든다
    const code = body.code ? normalizeCode(body.code) : newCode();
    if (!code) {
      return NextResponse.json({ error: "코드 모양이 올바르지 않습니다." }, { status: 400 });
    }

    await saveBackup(code, body.state);
    return NextResponse.json({ code });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "알 수 없는 오류";
    console.error("[/api/backup POST]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    assertBackupEnv();

    const code = normalizeCode(new URL(req.url).searchParams.get("code") ?? "");
    if (!code) {
      return NextResponse.json(
        { error: "코드를 확인해주세요. K7M2-9QXP-4T8R 모양입니다." },
        { status: 400 },
      );
    }

    const state = await loadBackup(code);
    if (!state) {
      return NextResponse.json({ error: "그 코드로 저장된 기록이 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ state });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "알 수 없는 오류";
    console.error("[/api/backup GET]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
