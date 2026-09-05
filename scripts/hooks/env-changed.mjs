/**
 * .env.local이 바뀌었으면 개발 서버를 다시 켜라고 알린다.
 *
 * Next.js는 부팅할 때 환경변수를 읽어둔다. 키를 바꿔도 서버는 옛 값을 계속 쓴다.
 * 이걸 모르면 "키를 바꿨는데도 401이 난다"에서 한참을 헤맨다(실제로 그랬다).
 *
 * 사용자가 메모장으로 고쳐도 잡히도록, 훅이 아니라 파일의 수정 시각을 본다.
 * 한 번 알리면 그 시각을 적어두고 다음 변경까지 조용하다.
 *
 * Claude Code의 UserPromptSubmit 훅으로 불린다(.claude/settings.json).
 */
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const envFile = join(root, ".env.local");
const stampFile = join(root, ".claude", ".env-mtime");

let mtime;
try {
  mtime = String(Math.floor(statSync(envFile).mtimeMs));
} catch {
  // .env.local이 없으면 알릴 것도 없다
  process.exit(0);
}

let seen = "";
try {
  seen = readFileSync(stampFile, "utf8").trim();
} catch {
  // 처음 도는 경우
}

if (seen === mtime) process.exit(0);

try {
  writeFileSync(stampFile, mtime);
} catch {
  // 적어두지 못해도 알리는 것이 먼저다
}

// 처음 도는 경우까지 알리면 시끄럽다. 기준만 잡고 끝낸다
if (!seen) process.exit(0);

console.log(
  JSON.stringify({
    systemMessage: ".env.local이 바뀌었습니다 — 개발 서버를 껐다 켜야 새 값이 적용됩니다.",
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext:
        ".env.local이 마지막 알림 이후 수정됐습니다. 개발 서버가 떠 있다면 껐다 켜세요. " +
        "Next.js는 부팅 시점의 환경변수를 계속 쓰기 때문에, 켜둔 채로는 옛 키로 호출합니다.",
    },
  }),
);
