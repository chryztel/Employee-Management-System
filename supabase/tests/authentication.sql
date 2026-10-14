-- Run ONLY against a disposable local/test Supabase database after the migration.
-- Synthetic Auth rows have no password/identity. Everything rolls back; no API/mail.
begin;
do $$
declare
  u uuid := gen_random_uuid();
  u2 uuid := gen_random_uuid();
  p uuid;
  p2 uuid;
  result jsonb;
  operation uuid;
  rejected boolean := false;
  e text := 'auth-test-' || u::text || '@example.invalid';
  e2 text := 'auth-test-' || u2::text || '@example.invalid';
begin
  insert into auth.users(id, email, aud, role) values (u, e, 'authenticated', 'authenticated'), (u2, e2, 'authenticated', 'authenticated');
  insert into public.profiles(auth_user_id, employee_id, email, role, display_name)
    values (u, 'TST-900', e, 'employee', 'Offline SQL fixture') returning id into p;
  insert into public.profiles(auth_user_id, employee_id, email, role, display_name)
    values (u2, 'TST-901', e2, 'employee', 'Expired SQL fixture') returning id into p2;

  if public.auth_issue_activation('TST-900', 'unknown@example.invalid', repeat('b',64)) is not null then raise exception 'unknown account revealed'; end if;
  result := public.auth_issue_activation('TST-900', e, repeat('b',64));
  if result is null then raise exception 'eligible account rejected'; end if;
  result := public.auth_begin_activation(repeat('b',64), 'sql.test.user');
  operation := (result->>'id')::uuid;
  if result->>'mode' <> 'mutate' then raise exception 'initial claim incorrect'; end if;
  if public.auth_issue_activation('TST-900', e, repeat('c',64)) is not null then raise exception 'processing operation overwritten'; end if;
  result := public.auth_begin_activation(repeat('b',64), 'sql.test.user');
  if result->>'mode' <> 'resume' or (result->>'id')::uuid <> operation then raise exception 'retry not idempotent'; end if;
  begin perform public.auth_begin_activation(repeat('b',64), 'different.user'); exception when others then rejected := true; end;
  if not rejected then raise exception 'concurrent username overwrite permitted'; end if;
  if not public.auth_finish_activation(repeat('b',64), operation) then raise exception 'completion failed'; end if;
  if not public.auth_finish_activation(repeat('b',64), operation) then raise exception 'completion retry not idempotent'; end if;
  if public.auth_inspect_activation(repeat('b',64)) is not null then raise exception 'consumed token reused'; end if;
  if public.auth_begin_activation(repeat('b',64), 'sql.test.user') is not null then raise exception 'consumed token claimed'; end if;
  if public.auth_issue_activation('TST-900', e, repeat('c',64)) is not null then raise exception 'active account reset through activation'; end if;

  perform public.auth_issue_activation('TST-901', e2, repeat('d',64));
  rejected := false;
  begin perform public.auth_begin_activation(repeat('d',64), 'sql.test.user'); exception when unique_violation then rejected := true; end;
  if not rejected then raise exception 'duplicate username permitted'; end if;
  update public.activation_tokens set created_at = now() - interval '1 hour', expires_at = now() - interval '1 second' where token_hash = repeat('d',64);
  if public.auth_inspect_activation(repeat('d',64)) is not null then raise exception 'expired token inspected'; end if;
  if public.auth_begin_activation(repeat('d',64), 'expired.user') is not null then raise exception 'expired token claimed'; end if;

  if not public.auth_take_rate_limit(repeat('f',64), 1, 60) then raise exception 'first rate request denied'; end if;
  if public.auth_take_rate_limit(repeat('f',64), 1, 60) then raise exception 'rate limit bypassed'; end if;
  perform set_config('request.jwt.claim.sub', u::text, true);
  perform set_config('worksync.sql_fixture_profile', p::text, true);
end; $$;

set local role authenticated;
do $$
declare n integer; denied boolean := false;
begin
  select count(*) into n from public.profiles;
  if n <> 1 then raise exception 'RLS exposes another profile or hides own profile'; end if;
  begin perform 1 from public.activation_tokens; exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'client can read activation tokens'; end if;
  denied := false;
  begin update public.profiles set role = 'manager' where id = current_setting('worksync.sql_fixture_profile')::uuid; exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'client can assign roles'; end if;
  denied := false;
  begin perform public.auth_begin_activation(repeat('b',64), 'client.attack'); exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'client can invoke privileged operation'; end if;
end; $$;
reset role;
rollback;
