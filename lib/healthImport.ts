/**
 * 폰 건강 앱의 오늘치 활동을 앱으로 들여오는 통로.
 *
 * 웹앱은 Apple 건강이나 삼성헬스를 직접 읽을 수 없다. 그래서 두 갈래로 받는다.
 * - 아이폰: 단축어가 건강 앱에서 값을 읽어 이 앱 주소를 파라미터와 함께 연다
 * - 안드로이드: 삼성헬스·Google Fit에서 내려받은 CSV 파일을 골라 브라우저에서 읽는다
 * 어느 쪽도 안 되면 손으로 입력한다. 데이터는 전부 이 브라우저 안에만 남는다.
 */

export interface ParsedActivity {
  steps?: number;
  activeKcal?: number;
  exerciseMin?: number;
  /** 실제로 읽어낸 날짜(YYYY-MM-DD). 오늘이 아닐 수 있어 화면에 함께 보여준다 */
  dateKey?: string;
}

/* ---------- 1. 아이폰 단축어: 주소 파라미터 ---------- */

const URL_KEYS: Record<keyof Omit<ParsedActivity, "dateKey">, string[]> = {
  steps: ["steps", "step", "걸음"],
  activeKcal: ["kcal", "activekcal", "calories", "cal", "energy"],
  exerciseMin: ["min", "minutes", "exercise", "workout", "duration"],
};

/** 주소에 활동 값이 실려 왔으면 읽어낸다. 값이 하나도 없으면 null */
export function activityFromSearch(search: string): ParsedActivity | null {
  const q = new URLSearchParams(search);
  const out: ParsedActivity = {};

  for (const [field, names] of Object.entries(URL_KEYS) as [
    keyof typeof URL_KEYS,
    string[],
  ][]) {
    for (const name of names) {
      const raw = q.get(name);
      if (raw === null) continue;
      const n = Number(raw.replace(/[^0-9.]/g, ""));
      if (Number.isFinite(n) && n >= 0) {
        out[field] = Math.round(n);
        break;
      }
    }
  }

  return Object.keys(out).length > 0 ? out : null;
}

/* ---------- 2. 안드로이드: 내려받은 CSV ---------- */

/**
 * 헤더 줄 찾기. 삼성헬스 CSV는 첫 줄이 "com.samsung.shealth.step_daily_trend,1,..." 같은
 * 메타 정보라, 그 줄에도 step이라는 글자가 들어 있다. 그래서 한 줄에 걸린 개수로 점수를 매겨
 * 컬럼 이름이 가장 많이 모인 줄을 고른다.
 */
const COLUMN_WORDS = /step|걸음|cal|칼로리|energy|date|day|일자|날짜|time|시간|minute|duration|운동/;

function findHeader(rows: string[][]): number {
  let best = -1;
  let bestScore = 0;

  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const cells = rows[i];
    if (cells.length < 2) continue;
    // 숫자만 늘어선 줄은 데이터다
    if (!cells.some((c) => c.trim() !== "" && Number.isNaN(Number(c)))) continue;

    const score = cells.filter((c) => COLUMN_WORDS.test(c.toLowerCase())).length;
    if (score >= 2 && score > bestScore) {
      best = i;
      bestScore = score;
    }
  }

  return best;
}

/** 아주 단순한 CSV 분해. 따옴표로 감싼 칸 안의 쉼표만 지켜주면 충분하다 */
function splitCsv(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const cells: string[] = [];
      let cur = "";
      let quoted = false;
      for (const ch of line) {
        if (ch === '"') quoted = !quoted;
        else if (ch === "," && !quoted) {
          cells.push(cur);
          cur = "";
        } else cur += ch;
      }
      cells.push(cur);
      return cells.map((c) => c.trim());
    });
}

function pickColumn(header: string[], pattern: RegExp, avoid?: RegExp): number {
  return header.findIndex(
    (h) => pattern.test(h.toLowerCase()) && !(avoid && avoid.test(h.toLowerCase())),
  );
}

function toDateKey(raw: string): string | null {
  // 삼성헬스는 날짜를 1970년부터의 밀리초로 적는다
  if (/^\d{10}$|^\d{13}$/.test(raw.trim())) {
    const ms = Number(raw.trim());
    const d = new Date(raw.trim().length === 10 ? ms * 1000 : ms);
    if (!Number.isNaN(d.getTime())) {
      const p = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    }
  }

  const dashed = raw.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (dashed) {
    const [, y, m, d] = dashed;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const packed = raw.match(/\b(\d{4})(\d{2})(\d{2})\b/);
  if (packed) return `${packed[1]}-${packed[2]}-${packed[3]}`;
  return null;
}

/** 값이 지나치게 크면 밀리초다. 삼성헬스는 운동 시간을 ms로 적는다 */
function toMinutes(n: number): number {
  if (n > 100000) return Math.round(n / 60000);
  if (n > 1440) return Math.round(n / 60);
  return Math.round(n);
}

/**
 * 삼성헬스·Google Fit이 내려주는 CSV에서 오늘 줄을 찾는다.
 * 컬럼 이름이 버전마다 달라서, 고정된 위치 대신 이름으로 짚는다.
 * 오늘 줄이 없으면 가장 마지막(최근) 줄을 쓰고, 어느 날짜인지 함께 돌려준다.
 */
export function parseHealthCsv(text: string, todayKey: string): ParsedActivity | null {
  const rows = splitCsv(text);
  const headerIdx = findHeader(rows);
  if (headerIdx < 0) return null;

  const header = rows[headerIdx];
  const dateCol = pickColumn(header, /date|day|일자|날짜|시간|time/);
  const stepCol = pickColumn(header, /step|걸음/, /goal|목표|target/);
  const kcalCol = pickColumn(header, /cal|칼로리|energy/, /goal|목표|target|bmr|기초/);
  const minCol = pickColumn(header, /minute|duration|active_time|운동|분/, /goal|목표/);

  if (stepCol < 0 && kcalCol < 0 && minCol < 0) return null;

  // 줄 끝이 잘려 들어오는 파일이 있어, 필요한 칸만 있으면 받아들인다
  const needed = Math.max(dateCol, stepCol, kcalCol, minCol) + 1;
  const body = rows.slice(headerIdx + 1).filter((r) => r.length >= needed);
  if (body.length === 0) return null;

  const num = (row: string[], col: number): number | undefined => {
    if (col < 0) return undefined;
    const n = Number((row[col] ?? "").replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? n : undefined;
  };

  const withDate = body
    .map((row) => ({ row, key: dateCol >= 0 ? toDateKey(row[dateCol] ?? "") : null }))
    .filter((x) => x.key !== null);

  const target =
    withDate.find((x) => x.key === todayKey) ??
    withDate[withDate.length - 1] ??
    { row: body[body.length - 1], key: null };

  const steps = num(target.row, stepCol);
  const activeKcal = num(target.row, kcalCol);
  const rawMin = num(target.row, minCol);

  const out: ParsedActivity = { dateKey: target.key ?? undefined };
  if (steps !== undefined) out.steps = Math.round(steps);
  if (activeKcal !== undefined) out.activeKcal = Math.round(activeKcal);
  if (rawMin !== undefined) out.exerciseMin = toMinutes(rawMin);

  const hasValue =
    out.steps !== undefined || out.activeKcal !== undefined || out.exerciseMin !== undefined;
  return hasValue ? out : null;
}
