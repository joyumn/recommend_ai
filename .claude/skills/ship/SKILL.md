---
name: ship
description: 바뀐 것을 배포하고 실제 주소에서 되는지까지 확인한다. 빌드 → 커밋 → push → Vercel 배포 대기 → 라이브 확인. 사용자가 "배포해줘", "올려줘", "ship"이라고 할 때 쓴다.
---

# 배포하고 확인까지

"올라갔을 것이다"로 끝내지 않는다. 실제 주소가 200을 주고 화면이 뜨는 것까지 보고 끝낸다.

## 1. 나가기 전에

```bash
bash scripts/doctor.sh
npx tsc --noEmit -p tsconfig.json && npx eslint app components lib && npm run build
```

하나라도 실패하면 **고치고 다시**. 실패한 채로 push하지 않는다.

## 2. 커밋

한국어로, **무엇을 왜** 고쳤는지 적는다. 제목 한 줄, 빈 줄, 본문.
본문에는 그 변경이 없었을 때 무엇이 잘못됐는지를 적는다.

```bash
git add -A
git commit -F <메시지파일>
```

기본 브랜치(`main`)에서 작업 중이면 그대로 커밋한다. 이 저장소는 혼자 쓰는 저장소다.

## 3. push하면 배포는 자동

`main`에 push하면 Vercel이 자동으로 프로덕션에 올린다. 따로 `vercel deploy`를 돌리지 않는다.

```bash
git push origin main
```

## 4. 배포가 끝날 때까지 기다린다

```bash
npx vercel ls recommend-ai
```

맨 윗줄이 `● Ready`가 될 때까지 기다린다(보통 20초 안팎). `● Error`면 로그를 본다.

```bash
npx vercel logs <배포주소>
```

## 5. 실제 주소에서 확인

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://recommend-ai-six.vercel.app/
```

200이 아니면 배포가 안 끝났거나 문제가 있는 것이다.

화면이 바뀌는 변경이었다면 **브라우저로 직접 열어 눈으로 본다**(claude-in-chrome).
서버 라우트가 바뀌었다면 그 라우트를 실제로 한 번 부른다.

> 짧은 시간에 자동 요청을 많이 보내면 Vercel 자동 방어가 켜져 403이 난다.
> 확인은 필요한 만큼만, 몇 번으로 끝낸다.

## 6. 보고

- 커밋 해시와 제목
- 배포 상태와 주소
- 확인한 것: 무엇을 어떻게 확인했고 결과가 무엇이었는지
- 확인하지 못한 것이 있으면 숨기지 말고 그대로 적는다
