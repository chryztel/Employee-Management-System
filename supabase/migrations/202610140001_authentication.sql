-- Additive migration. Apply through the Supabase migration workflow, not ad-hoc edits.
begin;

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete restrict,
  employee_id text not null unique,
  email text not null unique check (email = lower(email)),
  role text not null check (role in ('employee', 'manager')),
  status text not null default 'invited' check (status in ('invited', 'active', 'disabled')),
  username text unique check (username is null or username ~ '^[a-z0-9][a-z0-9_.-]{2,31}$'),
  display_name text not null,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  check (status <> 'active' or (auth_user_id is not null and username is not null))
);

create table public.activation_tokens (
  token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  consumed_at timestamptz,
  revoked_at timestamptz,
  operation_id uuid,
  operation_username text,
  started_at timestamptz,
  delivery_status text not null default 'pending' check (delivery_status in ('pending', 'sent', 'failed')),
  check (expires_at > created_at)
);
create index activation_tokens_profile_idx on public.activation_tokens(profile_id);
create unique index activation_one_processing_per_profile on public.activation_tokens(profile_id)
  where operation_id is not null and consumed_at is null and revoked_at is null;

create table public.auth_rate_limits (
  key_hash text primary key check (key_hash ~ '^[a-f0-9]{64}$'),
  window_start timestamptz not null,
  attempts integer not null check (attempts >= 0)
);

alter table public.profiles enable row level security;
alter table public.activation_tokens enable row level security;
alter table public.auth_rate_limits enable row level security;
revoke all on public.profiles, public.activation_tokens, public.auth_rate_limits from anon, authenticated;
grant select on public.profiles to authenticated;
grant all on public.profiles, public.activation_tokens, public.auth_rate_limits to service_role;
create policy profiles_read_self on public.profiles for select to authenticated
  using (auth_user_id = (select auth.uid()) and status = 'active');
-- No client token, rate-limit, or profile write policies. Roles cannot be self-assigned.

insert into public.profiles (employee_id, email, role, display_name) values
  ('MGR-001', 'chryztelsalvador@gmail.com', 'manager', 'Chryztel Salvador'),
  ('EMP-001', 'dump3319@gmail.com', 'employee', 'John Doe');

create function public.auth_take_rate_limit(p_key text, p_limit integer, p_seconds integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if p_limit < 1 or p_seconds < 1 then raise exception 'invalid limit'; end if;
  insert into public.auth_rate_limits as r (key_hash, window_start, attempts)
    values (p_key, clock_timestamp(), 1)
    on conflict (key_hash) do update set
      attempts = case when r.window_start + make_interval(secs => p_seconds) <= clock_timestamp() then 1 else r.attempts + 1 end,
      window_start = case when r.window_start + make_interval(secs => p_seconds) <= clock_timestamp() then clock_timestamp() else r.window_start end
    returning attempts into n;
  return n <= p_limit;
end; $$;

create function public.auth_issue_activation(p_employee_id text, p_email text, p_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare p public.profiles; expiry timestamptz := clock_timestamp() + interval '30 minutes';
begin
  select * into p from public.profiles where employee_id = p_employee_id and email = p_email for update;
  if not found or p.status <> 'invited' or p.auth_user_id is null then return null; end if;
  -- Never replace a credential operation with an uncertain external Auth outcome.
  if exists (select 1 from public.activation_tokens where profile_id = p.id and operation_id is not null and consumed_at is null and revoked_at is null) then return null; end if;
  update public.activation_tokens set revoked_at = clock_timestamp() where profile_id = p.id and consumed_at is null and revoked_at is null;
  insert into public.activation_tokens (token_hash, profile_id, expires_at) values (p_hash, p.id, expiry);
  return jsonb_build_object('email', p.email, 'display_name', p.display_name, 'expires_at', expiry);
end; $$;

create function public.auth_inspect_activation(p_hash text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('expires_at', t.expires_at, 'processing', t.operation_id is not null)
  from public.activation_tokens t join public.profiles p on p.id = t.profile_id
  where t.token_hash = p_hash and t.expires_at > now() and t.consumed_at is null
    and t.revoked_at is null and p.status = 'invited' and p.auth_user_id is not null;
$$;

create function public.auth_begin_activation(p_hash text, p_username text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare t public.activation_tokens; p public.profiles;
begin
  select * into t from public.activation_tokens where token_hash = p_hash;
  if not found then return null; end if;
  select * into p from public.profiles where id = t.profile_id for update;
  if not found then return null; end if;
  select * into t from public.activation_tokens where token_hash = p_hash for update;
  if not found then return null; end if;
  if t.expires_at <= clock_timestamp() or t.consumed_at is not null or t.revoked_at is not null or p.status <> 'invited' or p.auth_user_id is null then return null; end if;
  if t.operation_id is not null then
    if t.operation_username <> p_username then raise exception 'operation already started'; end if;
    return jsonb_build_object('id', t.operation_id, 'user_id', p.auth_user_id, 'email', p.email, 'mode', 'resume');
  end if;
  -- Unique username constraint reserves the name across all concurrent activations.
  update public.profiles set username = p_username where id = p.id;
  update public.activation_tokens set operation_id = gen_random_uuid(), operation_username = p_username,
    started_at = clock_timestamp() where token_hash = p_hash returning * into t;
  return jsonb_build_object('id', t.operation_id, 'user_id', p.auth_user_id, 'email', p.email, 'mode', 'mutate');
end; $$;

create function public.auth_finish_activation(p_hash text, p_operation uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare t public.activation_tokens; p public.profiles;
begin
  select * into t from public.activation_tokens where token_hash = p_hash;
  if not found then return false; end if;
  select * into p from public.profiles where id = t.profile_id for update;
  if not found then return false; end if;
  select * into t from public.activation_tokens where token_hash = p_hash for update;
  if not found then return false; end if;
  if t.operation_id is distinct from p_operation or t.revoked_at is not null then return false; end if;
  -- Idempotent completion for the same operation after a lost database response.
  if t.consumed_at is not null then return p.status = 'active'; end if;
  if t.expires_at <= clock_timestamp() or p.status <> 'invited' then return false; end if;
  update public.profiles set status = 'active', activated_at = clock_timestamp() where id = p.id;
  update public.activation_tokens set consumed_at = clock_timestamp() where token_hash = p_hash;
  update public.activation_tokens set revoked_at = clock_timestamp() where profile_id = p.id and token_hash <> p_hash and consumed_at is null and revoked_at is null;
  return true;
end; $$;

create function public.auth_cancel_activation(p_hash text, p_operation uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare t public.activation_tokens;
begin
  select * into t from public.activation_tokens where token_hash = p_hash;
  if not found then return; end if;
  perform 1 from public.profiles where id = t.profile_id and status = 'invited' for update;
  if not found then return; end if;
  update public.activation_tokens set operation_id = null, operation_username = null, started_at = null
    where token_hash = p_hash and operation_id = p_operation and consumed_at is null and revoked_at is null;
  if found then update public.profiles set username = null where id = t.profile_id; end if;
end; $$;

create function public.auth_provision_profile(p_employee_id text, p_user_id uuid, p_existing_active boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare p public.profiles; auth_email text;
begin
  select * into p from public.profiles where employee_id = p_employee_id for update;
  if not found then raise exception 'not an enrolled account'; end if;
  select lower(email) into auth_email from auth.users where id = p_user_id;
  if auth_email is distinct from p.email then raise exception 'account association mismatch'; end if;
  if p.auth_user_id is not null then
    if p.auth_user_id <> p_user_id then raise exception 'already associated'; end if;
    return 'unchanged';
  end if;
  if p.status <> 'invited' then raise exception 'cannot overwrite account'; end if;
  update public.profiles set auth_user_id = p_user_id,
    status = case when p_existing_active then 'active' else 'invited' end,
    username = case when p_existing_active then lower(p.employee_id) else null end,
    activated_at = case when p_existing_active then clock_timestamp() else null end
    where id = p.id;
  return case when p_existing_active then 'associated_active' else 'associated_invited' end;
end; $$;

-- Verify refresh-session revocation as well as JWT identity. Used on recovery retries
-- and protected routes; old access JWTs cannot bypass a completed global logout/reset.
create function public.auth_session_exists(p_user_id uuid, p_session_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from auth.sessions where id = p_session_id and user_id = p_user_id);
$$;

revoke all on function public.auth_take_rate_limit(text, integer, integer), public.auth_issue_activation(text, text, text), public.auth_inspect_activation(text), public.auth_begin_activation(text, text), public.auth_finish_activation(text, uuid), public.auth_cancel_activation(text, uuid), public.auth_provision_profile(text, uuid, boolean), public.auth_session_exists(uuid, uuid) from public, anon, authenticated;
grant execute on function public.auth_take_rate_limit(text, integer, integer), public.auth_issue_activation(text, text, text), public.auth_inspect_activation(text), public.auth_begin_activation(text, text), public.auth_finish_activation(text, uuid), public.auth_cancel_activation(text, uuid), public.auth_provision_profile(text, uuid, boolean), public.auth_session_exists(uuid, uuid) to service_role;
commit;
