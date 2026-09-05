-- 기기 사이에 기록을 옮기기 위한 백업 저장소.
--
-- 이 앱은 로그인이 없다. 대신 백업할 때 만들어지는 코드가 열쇠 역할을 한다.
-- 브라우저는 이 표에 직접 접근하지 않는다. 앱 서버(/api/backup)가 service_role 키로만
-- 읽고 쓴다. 그래서 아래에서 RLS를 켜고 정책은 하나도 만들지 않는다.
-- (정책이 없으면 anon 키로는 아무것도 못 읽는다. service_role은 RLS를 지나간다.)

create table if not exists public.backups (
  -- 사용자에게 보여주는 코드. 예: K7M2-9QXP-4T8R
  code text primary key,
  -- 앱 상태 전체(프로필·계획·식사·활동). 모양이 바뀌어도 담을 수 있게 jsonb
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.backups enable row level security;

-- 오래된 백업을 지울 때 쓰기 좋게
create index if not exists backups_updated_at_idx on public.backups (updated_at);

comment on table public.backups is '로그인 없이 기기 간에 기록을 옮기기 위한 백업. 코드가 곧 열쇠다.';
