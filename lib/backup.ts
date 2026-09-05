import { createClient } from "@supabase/supabase-js";

/**
 * 기기 사이에 기록을 옮기는 백업.
 *
 * 이 앱은 로그인이 없다. 대신 백업할 때 만들어지는 코드가 열쇠다.
 * 브라우저는 Supabase에 직접 접속하지 않는다. 이 파일은 서버(app/api/backup)에서만
 * 불리고, service_role 키는 서버 밖으로 나가지 않는다.
 * 브라우저에 키를 두면 누구나 남의 백업을 긁어갈 수 있다.
 */

const URL_ENV = "SUPABASE_URL";
const KEY_ENV = "SUPABASE_SERVICE_ROLE_KEY";

export function assertBackupEnv() {
  if (!process.env[URL_ENV] || !process.env[KEY_ENV]) {
    throw new Error(
      "백업 저장소가 아직 연결되지 않았습니다. SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 설정해주세요.",
    );
  }
}

function client() {
  return createClient(process.env[URL_ENV]!, process.env[KEY_ENV]!, {
    auth: { persistSession: false },
  });
}

/**
 * 코드 글자. 사람이 눈으로 읽고 손으로 옮겨 적는 값이라
 * 헷갈리는 글자(0/O, 1/I/L)를 뺐다.
 */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const GROUPS = 3;
const PER_GROUP = 4;

/** K7M2-9QXP-4T8R 모양. 31^12이라 찍어서 맞히기는 사실상 불가능하다 */
export function newCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(GROUPS * PER_GROUP));
  const chars = [...bytes].map((b) => ALPHABET[b % ALPHABET.length]);
  return Array.from({ length: GROUPS }, (_, i) =>
    chars.slice(i * PER_GROUP, (i + 1) * PER_GROUP).join(""),
  ).join("-");
}

/** 사용자가 소문자로 적거나 줄표를 빼먹어도 받아준다 */
export function normalizeCode(raw: string): string | null {
  const chars = raw.toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (chars.length !== GROUPS * PER_GROUP) return null;
  if ([...chars].some((c) => !ALPHABET.includes(c))) return null;

  return Array.from({ length: GROUPS }, (_, i) =>
    chars.slice(i * PER_GROUP, (i + 1) * PER_GROUP),
  ).join("-");
}

/** 백업 한 건을 저장한다. 같은 코드로 다시 저장하면 덮어쓴다 */
export async function saveBackup(code: string, data: unknown): Promise<void> {
  const { error } = await client()
    .from("backups")
    .upsert({ code, data, updated_at: new Date().toISOString() }, { onConflict: "code" });

  if (error) throw new Error(`백업을 저장하지 못했습니다: ${error.message}`);
}

/** 코드로 백업을 찾는다. 없으면 null */
export async function loadBackup(code: string): Promise<unknown | null> {
  const { data, error } = await client()
    .from("backups")
    .select("data")
    .eq("code", code)
    .maybeSingle();

  if (error) throw new Error(`백업을 불러오지 못했습니다: ${error.message}`);
  return data?.data ?? null;
}
