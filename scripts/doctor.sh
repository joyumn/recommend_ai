#!/usr/bin/env bash
# 키가 살아 있는지 먼저 확인한다.
#
# 기능을 다 만든 뒤에 "키가 placeholder였다", "크레딧이 없다", "모델 이름이 바뀌었다"를
# 알게 되면 그 시간이 다 날아간다. 코드를 쓰기 전에 이걸 먼저 돌린다.
#
#   bash scripts/doctor.sh
#
# 하나라도 실패하면 0이 아닌 값으로 끝난다.

set -u
cd "$(dirname "$0")/.." || exit 1

ok=0
fail=0

pass() { echo "  [정상] $1"; ok=$((ok + 1)); }
bad()  { echo "  [문제] $1"; echo "         -> $2"; fail=$((fail + 1)); }

# .env.local 읽기 (화면에 값은 찍지 않는다)
if [ ! -f .env.local ]; then
  echo "[.env.local 없음] cp .env.example .env.local 로 만들고 키를 채우세요."
  exit 1
fi
set -a
# shellcheck disable=SC1091
. ./.env.local >/dev/null 2>&1
set +a

echo "1. 키가 채워져 있는지"
for key in ANTHROPIC_API_KEY KAKAO_REST_KEY; do
  value="${!key:-}"
  if [ -z "$value" ]; then
    bad "$key 없음" ".env.local에 추가하세요 (.env.example 참고)"
  elif [ ${#value} -lt 20 ] || [ "$value" = "여기에붙여넣기" ]; then
    bad "$key 가 자리표시자입니다(${#value}자)" "실제 키로 바꾸세요"
  else
    pass "$key (${#value}자)"
  fi
done

for key in SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY; do
  [ -z "${!key:-}" ] && echo "  [선택] $key 없음 — 기기 간 백업만 안 됩니다"
done

echo
echo "2. 실제로 불러보기"

# Claude: 가장 싼 호출로 키와 크레딧을 함께 확인한다
if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
  body='{"model":"'"${ANTHROPIC_MODEL:-claude-opus-5}"'","max_tokens":4,"messages":[{"role":"user","content":"hi"}]}'
  res=$(curl -s -o /dev/null -w "%{http_code}" https://api.anthropic.com/v1/messages \
    -H "x-api-key: ${ANTHROPIC_API_KEY}" \
    -H "anthropic-version: 2023-06-01" \
    -H "content-type: application/json" \
    --data "$body")
  case "$res" in
    200) pass "Claude API (${ANTHROPIC_MODEL:-claude-opus-5})" ;;
    401) bad "Claude API 401" "키가 틀렸습니다. console.anthropic.com에서 다시 발급하세요" ;;
    400) bad "Claude API 400" "크레딧 잔액이나 모델 이름을 확인하세요" ;;
    429) bad "Claude API 429" "한도에 걸렸습니다. 잠시 뒤 다시" ;;
    *)   bad "Claude API HTTP $res" "잠시 뒤 다시 시도하세요" ;;
  esac
fi

# 카카오: 장소 검색과 이미지 검색을 따로 본다. 장소 검색은 제품 설정을 켜야 열린다
if [ -n "${KAKAO_REST_KEY:-}" ]; then
  res=$(curl -s -o /dev/null -w "%{http_code}" \
    "https://dapi.kakao.com/v2/local/search/keyword.json?query=%EA%B0%95%EB%82%A8%EC%97%AD&size=1" \
    -H "Authorization: KakaoAK ${KAKAO_REST_KEY}")
  if [ "$res" = "200" ]; then
    pass "카카오 장소 검색"
  else
    bad "카카오 장소 검색 HTTP $res" "developers.kakao.com → 제품 설정 → 카카오맵 사용 설정을 켜세요"
  fi

  res=$(curl -s -o /dev/null -w "%{http_code}" \
    "https://dapi.kakao.com/v2/search/image?query=%EA%B9%80%EC%B9%98%EC%B0%8C%EA%B0%9C&size=1" \
    -H "Authorization: KakaoAK ${KAKAO_REST_KEY}")
  [ "$res" = "200" ] && pass "카카오 이미지 검색" || bad "카카오 이미지 검색 HTTP $res" "같은 키를 씁니다. 위 설정을 확인하세요"
fi

# Supabase: 넣었을 때만
if [ -n "${SUPABASE_URL:-}" ] && [ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  res=$(curl -s -o /dev/null -w "%{http_code}" \
    "${SUPABASE_URL}/rest/v1/backups?select=code&limit=1" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}")
  case "$res" in
    200) pass "Supabase backups 표" ;;
    404) bad "Supabase 404" "표가 아직 없습니다. npx supabase db push 를 돌리세요" ;;
    *)   bad "Supabase HTTP $res" "URL과 service_role 키를 확인하세요" ;;
  esac
fi

echo
echo "3. 코드"
if npx tsc --noEmit -p tsconfig.json >/dev/null 2>&1; then
  pass "타입 검사"
else
  bad "타입 오류" "npx tsc --noEmit 로 내용을 보세요"
fi

echo
echo "정상 ${ok}개, 문제 ${fail}개"
[ "$fail" -eq 0 ] || exit 1
