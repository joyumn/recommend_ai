---
title: 정리 플래그와 모듈 1회 가드를 같이 쓰면 fetch 결과가 버려진다
date: 2026-09-05
category: logic-errors
module: components/DailyQuote
problem_type: logic_error
component: frontend
symptoms:
  - AI가 만든 오늘의 한마디가 한 번도 뜨지 않고 늘 내장 문구만 보인다
  - 화면이 멀쩡해 보여서 실패가 오류로 드러나지 않고 조용히 묻힌다
  - localStorage(fitplan.v1)에 quote가 끝내 저장되지 않는다
  - 아이폰 단축어로 막 저장한 오늘 활동 기록이 문구 저장 뒤 사라진다
root_cause: async_timing
resolution_type: code_fix
severity: medium
related_components: [api_layer, service_layer]
framework_version: next 16.3.4, react 19.2.8
tags:
  - react-strict-mode
  - useeffect-cleanup
  - use-sync-external-store
  - stale-closure
  - silent-failure
  - localstorage
  - async-timing
  - lost-update
---

# 정리 플래그와 모듈 1회 가드를 같이 쓰면 fetch 결과가 버려진다

## 문제

`components/DailyQuote.tsx`가 `/api/quote`에서 받아온 오늘의 한마디를 한 번도 저장하지 못했다. 개발 모드에서 effect가 두 번 도는 것과, 하루 한 번만 부르려고 둔 모듈 단위 가드가 맞물려서, 실제로 요청을 보낸 쪽이 자기 응답을 스스로 버렸다.

## 증상

- 첫 화면 맨 위 "오늘의 한마디"가 늘 `lib/quotes.ts`의 내장 문구였다. AI가 쓴 문구로 바뀌는 것을 본 적이 없다.
- **오류가 나지 않았다.** 콘솔 경고도, 빈 카드도 없었다. `components/DailyQuote.tsx:43-46`이 저장된 문구가 없으면 `builtinQuote(today, offset)`를 그리기 때문에, 실패해도 카드는 정상으로 보인다. 파일 주석(`components/DailyQuote.tsx:25-30`)에 적힌 "API가 막힌 날은 내장 문구가 그대로 남는다"가 원래 의도한 동작이라, 화면만 봐서는 성공한 날과 실패한 날을 구분할 수 없었다.
- 브라우저 네트워크 기록을 켜 두고 새로고침해 보니 `/api/quote` 요청이 아예 나가지 않는 새로고침이 있었다. (`asked`는 모듈 변수라 전체 새로고침 때만 비워진다. 이번 세션에서 확인한 바로는 Fast Refresh로 다시 그려질 때는 그대로 남아 있었다.)
- `localStorage["fitplan.v1"]`(`lib/storage.ts:8`)을 직접 열어 보니 `quote` 키가 끝내 채워지지 않았다.

## 통하지 않은 것

**"정리 함수부터 달자"가 원인이었다.** effect 안에서 비동기 요청을 하면 `let alive = true` 를 두고 `return () => { alive = false }` 로 정리하는 것이 보통의 정답이고, 처음 코드도 그렇게 쓰여 있었다. 문제는 이 파일에 가드가 **두 개** 있었다는 점이다. 하나는 하루 한 번만 부르려는 모듈 단위 1회 가드(`components/DailyQuote.tsx:8`, `:49-50`), 다른 하나가 이 `alive` 플래그였다. 둘 다 각각은 옳은데, 개발 모드의 이중 실행에서는 서로를 무력화한다.

- 1회차 실행: `asked.add(today)` 후 fetch 시작 → 정리 함수가 돌며 `alive = false`
- 2회차 실행: `asked.has(today)`가 참이라 아무것도 하지 않고 반환
- 1회차 응답 도착: `alive`가 이미 false → 결과 버림

**흔히 기대하는 신호가 나올 수 없는 구조였다.** 이 종류의 실수는 보통 "unmounted 컴포넌트에 setState 했다"는 경고로 드러나는데, 여기서는 애초에 setState를 하지 않는다. `alive` 검사가 저장 시도보다 **앞에** 있으므로, 코드는 시킨 대로 조용히 반환할 뿐이고 React가 지적할 거리가 없다. fetch를 `AbortController`로 끊은 것도 아니라 콘솔에 취소 오류도 남지 않는다. 즉 이 버그는 로그로는 절대 찾을 수 없고, 네트워크 기록과 `localStorage` 실물을 직접 열어봐야만 보인다.

## 해결

### 버그 1 — 정리 플래그를 지운다

고치기 전(이번 세션에서 문제를 재현하던 형태):

```tsx
useEffect(() => {
  if (saved || asked.has(today)) return;
  asked.add(today);

  let alive = true;
  (async () => {
    const res = await fetch("/api/quote", { /* ... */ });
    if (!alive) return;              // ← 여기서 결과가 버려진다
    const json = await res.json();
    if (!alive) return;
    commitState({ ...state, quote: { /* ... */ } });
  })();

  return () => { alive = false; };   // ← 1회차 실행을 스스로 무효화한다
}, [today, saved]);
```

고친 뒤(`components/DailyQuote.tsx:48-71`, 현재 트리):

```tsx
useEffect(() => {
  if (saved || asked.has(today)) return;
  asked.add(today);

  (async () => {
    try {
      const res = await fetch("/api/quote", { /* ... */ });
      if (!res.ok) return;
      const json = (await res.json()) as { text?: string };
      if (!json.text) return;
      commitState({
        ...stateSnapshot(),
        quote: { date: today, text: json.text, author: "몸친", from: "ai" },
      });
    } catch {
      // 내장 문구가 이미 떠 있으므로 조용히 넘어간다
    }
  })();
}, [today, saved]);
```

`alive` 플래그와 정리 함수를 통째로 지우고 1회 가드만 남겼다. 중복 호출을 막는 일은 `asked` 하나로 충분하고, 언마운트 뒤에 저장이 일어나도 여기서는 문제가 없다(아래 "왜 이 방법이 통하나").

### 버그 2 — 저장할 때 저장소를 다시 읽는다

```diff
- commitState({ ...state, quote: { ... } })
+ commitState({ ...stateSnapshot(), quote: { ... } })
```

`state`는 effect가 돌던 시점에 props로 받아둔 값이다. 응답은 몇 초 뒤에 오는데, 그 사이에 같은 저장소에 쓰는 다른 코드가 있다. `lib/useHealthLink.ts:23-34`가 아이폰 단축어 주소(`/?steps=8123&kcal=430&min=45`)로 앱이 열렸을 때 `commitState(withActivity(state, ...))`로 오늘 활동을 저장한다. 이 훅은 부모인 `app/page.tsx:41`에서 돌고, `DailyQuote`는 `components/PlanTab.tsx:68`을 거친 그 아래에 있다. 자식 effect가 먼저 돌아 fetch를 걸어두고, 곧바로 부모 effect가 활동 기록을 저장한다. 몇 초 뒤 도착한 문구가 **그 이전에 찍어둔** `state`를 바탕으로 저장되면, 방금 들어온 걸음 수·활동 열량이 통째로 지워진다.

`stateSnapshot()`(`lib/storage.ts:92-95`)은 모듈의 `cached`를 그대로 돌려주고, `commitState`(`lib/storage.ts:102-107`)가 매번 `cached`를 갱신한다. 그래서 저장 직전에 읽으면 항상 가장 최근 값 위에 얹게 된다.

이번 세션에서 고친 뒤 확인한 결과: `/api/quote`가 200을 반환했고, `localStorage["fitplan.v1"].quote`가 `{"from":"ai","text":"주말의 상쾌한 시작을 위해…"}`로 채워졌으며, 카드가 내장 문구에서 AI 문구로 바뀌었다.

> 참고: `git log -- components/DailyQuote.tsx`에는 커밋이 `0fd8704` 하나뿐이고, 그 커밋에 이미 고쳐진 형태가 들어 있다. 문제가 있던 중간 형태는 커밋으로 남지 않았으니 diff를 찾지 말 것.

## 왜 이 방법이 통하나

**근본 원인은 이중 실행과 1회 가드의 조합이다.** 개발 모드에서 React는 effect를 실행 → 정리 → 재실행한다(파일 주석 `components/DailyQuote.tsx:7`에 "개발 중 effect가 두 번 도는 경우까지 막는다"고 적혀 있는, 바로 그 상황이다). 이때 정리 함수는 "이 실행을 무효로 한다"는 뜻인데, 모듈 단위 `asked`는 정리 함수가 되돌려주지 않는다. 그래서 재실행은 "이미 했다"고 판단해 건너뛰고, 무효 처리된 1회차만 실제 작업을 갖고 있게 된다. **하나의 부수효과를 두 개의 서로 다른 수명(모듈 수명 / 실행 수명)으로 관리하면 늘 이렇게 어긋난다.** 둘 중 하나만 남겨야 하고, "하루 한 번"이라는 요구사항을 만족하는 쪽은 모듈 가드다.

**외부 저장소에 쓰는 것은 언마운트 가드가 필요 없다.** `alive` 플래그가 필요한 진짜 이유는 사라진 컴포넌트의 `setState`를 막는 것이다. 여기서 저장 대상은 컴포넌트 상태가 아니라 `lib/storage.ts`의 모듈 저장소다. `commitState`는 `cached`를 바꾸고 `saveState`로 localStorage에 쓴 뒤, 살아 있는 구독자에게만 알린다(`lib/storage.ts:102-107`). 구독 해지는 `subscribeState`가 돌려주는 함수가 리스너를 `Set`에서 빼는 것으로 이미 끝난다(`lib/storage.ts:84-89`). 화면 쪽은 `app/page.tsx:38`의 `useSyncExternalStore(subscribeState, stateSnapshot, serverStateSnapshot)`가 알아서 받는다. 즉 컴포넌트가 사라진 뒤 저장이 도착해도 잘못될 것이 없고, 오히려 저장되는 편이 맞다 — 사용자가 탭을 옮겼다고 이미 받아온 문구를 버릴 이유는 없다.

## 예방

이 저장소에서 **"불러온 다음 `commitState` 하는" effect를 새로 쓸 때** 세 가지를 확인한다.

1. **가드는 하나만.** `asked` 같은 모듈 단위 1회 가드를 쓰기로 했다면 `alive`/`cancelled` 플래그와 정리 함수를 함께 두지 않는다. 정리 함수는 모듈 가드를 되돌리지 못하므로, 둘을 같이 쓰는 순간 개발 모드에서 결과가 버려진다. 반대로 정리 플래그를 쓰기로 했다면 모듈 가드를 두지 않는다.
2. **저장 직전에 저장소를 다시 읽는다.** `await` 뒤의 `commitState`에는 `...state`(effect 진입 때 찍힌 값)가 아니라 `...stateSnapshot()`을 쓴다. 같은 tick에 `lib/useHealthLink.ts`가 같은 저장소에 쓰기 때문에, 몇 초짜리 요청이 끼면 남의 저장을 덮어쓴다. 리뷰할 때는 `commitState`가 나오는 줄을 전부 훑고, 그 위에 `await`가 있는데 인자에 `stateSnapshot()`이 없는 곳을 찾으면 된다.
3. **조용한 실패를 전제로 확인한다.** 이 버그가 비싼 이유는 내장 문구(`lib/quotes.ts`)가 실패를 가려주기 때문이다. 폴백이 있는 기능은 화면만 봐서는 되는지 알 수 없다. 확인은 반드시 (a) 네트워크 기록에서 요청이 실제로 나갔는지, (b) `localStorage["fitplan.v1"]`에 값이 들어갔는지 **둘 다** 본다. 폴백을 새로 넣을 때는 그 폴백이 무엇을 가리게 되는지도 함께 적어둔다.

### 아직 같은 모양으로 남아 있는 곳

이 문서를 쓰는 시점에 `await` 뒤에서 찍어둔 `state`로 `commitState`를 부르는 자리가 네 곳 더 있다. 넷 다 이번에는 손대지 않았다 — 사용자가 버튼을 눌러 시작하는 흐름이라 단축어 저장과 겹칠 창이 좁기 때문이다. 다음에 그 근처를 만지면 함께 바꾸는 편이 좋다.

- `app/page.tsx:54` — `commitState({ ...(state ?? loadState()), profile, daily, plan })`, `await fetch("/api/plan")` 뒤
- `components/BackupCard.tsx:37` — `commitState({ ...state, backupCode: json.code })`, `await fetch("/api/backup")` 뒤
- `components/RecentMeals.tsx:261` — `commitState(addManualLog(state, ...))`, `await fetch("/api/meal")` 뒤
- `components/ActivityCard.tsx:174` — `commitState(next)`. `next`는 `:150`에서 찍어둔 `state`로 시작하고, 그 앞 `:137`에 `await file.text()`가 있다. 기다림이 fetch가 아니라 파일 읽기라 눈에 덜 띈다

같은 파일의 `components/BackupCard.tsx:55`는 제외한다. 백업을 불러오는 자리라 저장소 전체를 백업 내용으로 갈아끼우는 것이 의도한 동작이다.

이 저장소에는 테스트 도구가 없다(`package.json`의 스크립트는 `dev`/`build`/`start`/`lint`뿐이다). 그래서 위 세 가지는 자동으로 잡히지 않고, 리뷰에서 눈으로 보는 수밖에 없다. 최소한 새 코드에 `commitState`가 들어갔다면 `grep -rn "alive\|cancelled" components lib`와 `grep -rn "commitState" components lib app` 두 줄은 돌려볼 것.

## 관련

- `components/DailyQuote.tsx` — 고쳐진 effect와 모듈 단위 1회 가드
- `lib/storage.ts` — `commitState` / `stateSnapshot`, 외부 저장소 계약
- `lib/useHealthLink.ts` — 같은 저장소에 쓰는 다른 코드. 여기는 `await`가 없어 찍어둔 `state`가 그대로 최신이다
- `README.md`의 "오늘의 한마디" — 이 수정으로 되살아난 동작을 사용자 언어로 설명한 곳
