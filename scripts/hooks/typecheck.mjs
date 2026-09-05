/**
 * 파일을 고친 직후 타입 검사.
 *
 * 빌드할 때가 아니라 고친 그 자리에서 알려줘야 원인을 바로 찾는다.
 * .ts/.tsx를 고쳤을 때만 돌고, 문제가 없으면 아무 말도 하지 않는다.
 *
 * Claude Code의 PostToolUse 훅으로 불린다(.claude/settings.json).
 * 훅 입력(JSON)은 표준입력으로 들어온다.
 */
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const input = await new Promise((done) => {
  let raw = "";
  process.stdin.on("data", (c) => (raw += c));
  process.stdin.on("end", () => done(raw));
});

let file = "";
try {
  const json = JSON.parse(input || "{}");
  file = json.tool_input?.file_path ?? json.tool_response?.filePath ?? "";
} catch {
  process.exit(0);
}

// 타입스크립트 파일이 아니면 볼 것이 없다
if (!/\.(ts|tsx)$/.test(file)) process.exit(0);

try {
  execFileSync("npx", ["tsc", "--noEmit", "-p", "tsconfig.json"], {
    cwd: root,
    stdio: "pipe",
    shell: process.platform === "win32",
  });
  // 통과하면 조용히 끝낸다. 잘 되는 것까지 말하면 화면만 시끄럽다
  process.exit(0);
} catch (e) {
  const out = `${e.stdout ?? ""}${e.stderr ?? ""}`.trim().split("\n").slice(0, 15).join("\n");
  if (!out) process.exit(0);

  console.log(
    JSON.stringify({
      systemMessage: "타입 오류가 있습니다",
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext: `방금 고친 파일 기준 타입 검사 결과입니다. 이어서 고치세요.\n\n${out}`,
      },
    }),
  );
  process.exit(0);
}
