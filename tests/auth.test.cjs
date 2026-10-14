// Entirely offline: real source modules, fake Supabase/EmailJS boundaries, no env.local.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { randomUUID } = require('node:crypto');
const root = path.resolve(__dirname, '..');
Object.assign(process.env, {
  NEXT_PUBLIC_APP_URL: 'http://localhost:3000', NEXT_PUBLIC_SUPABASE_URL: 'https://offline.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'offline-public', SUPABASE_SECRET_KEY: 'offline-secret-never-a-real-key',
});
global.fetch = async () => { throw new Error('Unexpected network access in offline authentication tests'); };
const good = 'WorkSync-Test-2026!';

function fixture(status = 'invited', role = 'employee') {
  const profile = { id: randomUUID(), auth_user_id: randomUUID(), employee_id: role === 'manager' ? 'MGR-001' : 'EMP-001', email: 'offline@example.invalid', role, status, username: status === 'active' ? 'test.user' : null, display_name: 'Test User' };
  const f = { profiles: [profile], tokens: new Map(), jar: new Map(), sessions: new Set(), queued: [], mails: [], passwords: new Map([[profile.email, good]]), counts: new Map(), writes: 0, session: null, profile };
  const jar = { get: n => f.jar.has(n) ? { value: f.jar.get(n) } : undefined, getAll: () => [...f.jar].map(([name, value]) => ({ name, value })), set: (n, v) => f.jar.set(n, v), delete: n => f.jar.delete(n) };
  const ok = data => Promise.resolve({ data, error: null });
  class Query {
    constructor(table) { this.table = table; this.filters = []; }
    select() { return this; }
    eq(key, value) { this.filters.push(row => row[key] === value); return this; }
    neq(key, value) { this.filters.push(row => row[key] !== value); return this; }
    update(value) { this.updateValue = value; return this; }
    rows() { return (this.table === 'profiles' ? f.profiles : [...f.tokens.values()]).filter(row => this.filters.every(fn => fn(row))); }
    maybeSingle() { return ok(structuredClone(this.rows()[0] || null)); }
    then(resolve, reject) { if (this.updateValue) this.rows().forEach(row => Object.assign(row, this.updateValue)); return ok(null).then(resolve, reject); }
  }
  function client(main = false) {
    let ownSession = null;
    return { from: table => new Query(table), auth: {
      async signInWithPassword({ email, password }) {
        const p = f.profiles.find(p => p.email === email);
        if (!p || f.passwords.get(email) !== password) return { data: { user: null }, error: { status: 400 } };
        ownSession = { user: { id: p.auth_user_id, email }, id: randomUUID() }; f.sessions.add(ownSession.id);
        if (main) f.session = ownSession;
        return { data: { user: ownSession.user, session: { access_token: 'fake' } }, error: null };
      },
      async getUser() { const s = main ? f.session : ownSession; return { data: { user: s?.user || null }, error: s ? null : { status: 401 } }; },
      async getClaims() { const s = main ? f.session : ownSession; return { data: { claims: { session_id: s?.id } }, error: s ? null : { status: 401 } }; },
      async signOut({ scope } = {}) {
        if (scope === 'global' && f.failSignOut) { f.failSignOut = false; return { error: { status: 500 } }; }
        const s = main ? f.session : ownSession;
        if (scope === 'global') f.sessions.clear(); else if (s) f.sessions.delete(s.id);
        if (main) f.session = null; ownSession = null; return { error: null };
      },
      async updateUser({ password }) {
        const s = main ? f.session : ownSession;
        if (!s) return { error: { status: 401 } };
        f.writes++; f.passwords.set(s.user.email, password);
        if (f.failUserUpdate) { f.failUserUpdate = false; return { error: { status: 500 } }; }
        return { data: { user: s.user }, error: null };
      },
      async verifyOtp({ token_hash, type }) {
        if (type !== 'recovery' || token_hash !== f.recoveryHash || f.otpUsed || f.otpExpired) return { data: { user: null }, error: { status: 403 } };
        f.otpUsed = true; ownSession = { user: { id: profile.auth_user_id, email: profile.email }, id: randomUUID() }; f.sessions.add(ownSession.id); f.session = ownSession;
        return { data: { user: ownSession.user }, error: null };
      },
    } };
  }
  const admin = { from: table => new Query(table), auth: { admin: {
    async updateUserById(id, { password }) {
      f.writes++;
      if (f.rejectPassword) return { error: { status: 422 } };
      const p = f.profiles.find(p => p.auth_user_id === id); f.passwords.set(p.email, password);
      if (f.unknownWrite) { f.unknownWrite = false; return { error: { status: 500 } }; }
      return { error: null };
    },
    async generateLink() { f.recoveryHash = 'a'.repeat(64); return { data: { properties: { hashed_token: f.recoveryHash } }, error: null }; },
  } }, async rpc(name, args) {
    if (name === 'auth_take_rate_limit') { const n = (f.counts.get(args.p_key) || 0) + 1; f.counts.set(args.p_key, n); return ok(n <= args.p_limit); }
    if (name === 'auth_session_exists') return ok(f.sessions.has(args.p_session_id) && f.profiles.some(p => p.auth_user_id === args.p_user_id));
    if (name === 'auth_issue_activation') {
      const p = f.profiles.find(p => p.employee_id === args.p_employee_id && p.email === args.p_email && p.status === 'invited' && p.auth_user_id);
      if (!p || [...f.tokens.values()].some(t => t.profile_id === p.id && t.operation_id && !t.consumed_at && !t.revoked_at)) return ok(null);
      for (const t of f.tokens.values()) if (t.profile_id === p.id && !t.consumed_at) t.revoked_at = true;
      f.tokens.set(args.p_hash, { token_hash: args.p_hash, profile_id: p.id, expires_at: Date.now() + 1800000, delivery_status: 'pending' });
      return ok({ email: p.email, display_name: p.display_name, expires_at: new Date(Date.now() + 1800000).toISOString() });
    }
    const t = f.tokens.get(args.p_hash); const p = t && f.profiles.find(p => p.id === t.profile_id);
    const eligible = t && p && !t.revoked_at && !t.consumed_at && t.expires_at > Date.now() && p.status === 'invited';
    if (name === 'auth_inspect_activation') return ok(eligible ? { expires_at: new Date(t.expires_at).toISOString() } : null);
    if (name === 'auth_begin_activation') {
      if (!eligible) return ok(null);
      if (f.profiles.some(other => other.id !== p.id && other.username === args.p_username)) return { data: null, error: { code: '23505' } };
      if (t.operation_id) {
        if (t.operation_username !== args.p_username) return { data: null, error: { code: 'P0001' } };
        return ok({ id: t.operation_id, user_id: p.auth_user_id, email: p.email, mode: 'resume' });
      }
      t.operation_id = randomUUID(); t.operation_username = args.p_username; p.username = args.p_username;
      return ok({ id: t.operation_id, user_id: p.auth_user_id, email: p.email, mode: 'mutate' });
    }
    if (name === 'auth_finish_activation') {
      if (f.failFinish) { f.failFinish = false; return { data: null, error: { code: 'offline_failure' } }; }
      if (!eligible || t.operation_id !== args.p_operation) return ok(false);
      t.consumed_at = true; p.status = 'active'; return ok(true);
    }
    if (name === 'auth_cancel_activation') { if (t?.operation_id === args.p_operation && p.status === 'invited') { delete t.operation_id; p.username = null; } return ok(null); }
    throw new Error('Unmocked RPC: ' + name);
  } };
  const cache = new Map();
  function load(file) {
    file = path.resolve(file); if (cache.has(file)) return cache.get(file).exports;
    if (file === path.join(root, 'lib/supabase/admin.ts')) return { adminClient: () => admin, isolatedAuthClient: () => client() };
    if (file === path.join(root, 'lib/supabase/server.ts')) return { serverClient: async () => client(true) };
    if (file === path.join(root, 'lib/auth/email.ts')) return { sendAuthEmail: async mail => { if (f.failMail) throw new Error('fake provider rejection'); f.mails.push(mail); } };
    const m = new Module(file, module); m.filename = file; m.paths = module.paths; cache.set(file, m);
    m.require = name => {
      if (name === 'server-only') return {};
      if (name === 'next/headers') return { cookies: async () => jar };
      if (name === 'next/server') return { connection: async () => {}, after: fn => f.queued.push(fn), NextResponse: { redirect: (url, status) => new Response(null, { status, headers: { location: url } }) } };
      if (name === 'next/navigation') return { redirect: destination => { const e = new Error('redirect'); e.destination = destination; throw e; } };
      if (name.startsWith('@/')) return load(path.join(root, name.slice(2) + '.ts'));
      if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name + (name.endsWith('.ts') ? '' : '.ts')));
      return require(name);
    };
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    m._compile(code, file); return m.exports;
  }
  f.load = name => load(path.join(root, name));
  f.flush = async () => { const queued = f.queued.splice(0); for (const fn of queued) await fn(); };
  f.post = (action, body = {}, options = {}) => f.load('app/api/auth/[action]/route.ts').POST(new Request(`http://localhost:3000/api/auth/${action}`, { method: 'POST', headers: { origin: 'http://localhost:3000', 'content-type': 'application/json', ...options.headers }, body: options.raw ?? JSON.stringify(body) }), { params: Promise.resolve({ action }) });
  f.signIn = async () => client(true).auth.signInWithPassword({ email: profile.email, password: f.passwords.get(profile.email) });
  return f;
}
async function issued(f) {
  const response = await f.post('request-activation', { employeeId: f.profile.employee_id, email: f.profile.email }); assert.equal(response.status, 200); await f.flush();
  const token = new URL(f.mails.at(-1).url).searchParams.get('token'); f.jar.set('worksync-activation', token); return token;
}
function credentials(username = 'new.user') { return { username, password: good, confirmPassword: good }; }

test('token entropy, hashing, password rules, username normalization, and proof tamper/expiry checks', () => {
  const f = fixture(); const c = f.load('lib/auth/crypto.ts'); const policy = f.load('lib/auth/policy.ts');
  const tokens = new Set(Array.from({ length: 200 }, c.newActivationToken)); assert.equal(tokens.size, 200);
  for (const token of tokens) { assert.equal(token.length, 43); assert.ok(c.validActivationToken(token)); assert.match(c.tokenHash(token), /^[a-f0-9]{64}$/); assert.notEqual(c.tokenHash(token), token); }
  assert.ok(!policy.validPassword('Short1!')); assert.ok(policy.validPassword(good)); assert.ok(!policy.validUsername('test user')); assert.equal(policy.normalizeUsername(' Test.User '), 'test.user');
  const proof = { purpose: 'recovery', userId: 'user', sessionId: 'session', expires: 2000 }; const sealed = c.signRecoveryProof(proof, 'test-key');
  assert.deepEqual(c.readRecoveryProof(sealed, 'test-key', 1000), proof); assert.equal(c.readRecoveryProof(sealed, 'test-key', 2000), null); assert.equal(c.readRecoveryProof(sealed, 'wrong-key', 1000), null); assert.equal(c.readRecoveryProof(sealed + 'bad', 'test-key', 1000), null);
});
test('real POST route rejects cross-site requests, invalid JSON, oversized bodies, unsupported actions, and weak passwords', async () => {
  const f = fixture(); assert.equal((await f.post('login', {}, { headers: { origin: 'https://attacker.invalid' } })).status, 403);
  assert.equal((await f.post('login', {}, { raw: 'not-json' })).status, 400); assert.equal((await f.post('login', {}, { raw: 'x'.repeat(9000) })).status, 413);
  assert.equal((await f.post('signup')).status, 404); assert.equal((await f.post('__proto__')).status, 404);
  assert.equal((await f.post('complete-activation', { username: 'user', password: 'short', confirmPassword: 'short' })).status, 400);
  assert.equal(f.writes, 0); assert.equal(f.mails.length, 0);
});
test('unknown and eligible activation requests have identical responses and only hashed tokens are stored', async () => {
  const f = fixture(); const eligible = await f.post('request-activation', { email: f.profile.email, employeeId: f.profile.employee_id });
  const unknown = await f.post('request-activation', { email: 'unknown@example.invalid', employeeId: 'EMP-999' });
  assert.equal(eligible.status, unknown.status); assert.deepEqual(await eligible.json(), await unknown.json()); assert.equal(f.mails.length, 0);
  await f.flush(); assert.equal(f.mails.length, 1); const raw = new URL(f.mails[0].url).searchParams.get('token');
  assert.ok(!JSON.stringify([...f.tokens.values()]).includes(raw)); assert.equal(f.tokens.size, 1);
});
test('active accounts cannot request activation; send failures preserve retry eligibility', async () => {
  const active = fixture('active'); await active.post('request-activation', { email: active.profile.email, employeeId: active.profile.employee_id }); await active.flush(); assert.equal(active.tokens.size, 0);
  const f = fixture(); f.failMail = true; const oldError = console.error; console.error = () => {};
  try { await f.post('request-activation', { email: f.profile.email, employeeId: f.profile.employee_id }); await f.flush(); } finally { console.error = oldError; }
  assert.equal([...f.tokens.values()][0].delivery_status, 'failed'); f.failMail = false; await issued(f); assert.equal(f.mails.length, 1); assert.equal([...f.tokens.values()].filter(t => !t.revoked_at).length, 1);
});
test('activation is single-use; expired and rotated tokens cannot mutate credentials', async () => {
  const f = fixture(); await issued(f); const result = await f.post('complete-activation', credentials()); assert.equal(result.status, 200); assert.equal(f.profile.status, 'active'); assert.equal(f.writes, 1);
  assert.equal((await f.post('complete-activation', credentials())).status, 410); assert.equal(f.writes, 1);
  const expired = fixture(); await issued(expired); [...expired.tokens.values()][0].expires_at = Date.now() - 1; assert.equal((await expired.post('complete-activation', credentials())).status, 410); assert.equal(expired.writes, 0);
  const rotated = fixture(); const old = await issued(rotated); await issued(rotated); rotated.jar.set('worksync-activation', old); assert.equal((await rotated.post('complete-activation', credentials())).status, 410);
});
test('concurrent activation claims perform only one password write', async () => {
  const f = fixture(); await issued(f); const responses = await Promise.all([f.post('complete-activation', credentials()), f.post('complete-activation', credentials())]);
  assert.ok(responses.some(r => r.status === 200)); assert.equal(f.writes, 1); assert.equal(f.profile.status, 'active');
});
test('uncertain Auth result and failed DB completion reconcile without another password write', async () => {
  for (const failure of ['unknownWrite', 'failFinish']) {
    const f = fixture(); await issued(f); f[failure] = true; assert.equal((await f.post('complete-activation', credentials())).status, 503);
    assert.equal(f.profile.status, 'invited'); assert.equal(f.writes, 1);
    assert.equal((await f.post('complete-activation', { ...credentials(), password: 'Different-Password-2026!', confirmPassword: 'Different-Password-2026!' })).status, 503); assert.equal(f.writes, 1);
    assert.equal((await f.post('complete-activation', credentials())).status, 200); assert.equal(f.writes, 1);
  }
});
test('definitive password rejection releases the claim and username conflicts do not write passwords', async () => {
  const f = fixture(); await issued(f); f.rejectPassword = true; assert.equal((await f.post('complete-activation', credentials())).status, 400); assert.equal(f.profile.username, null);
  f.rejectPassword = false; assert.equal((await f.post('complete-activation', credentials())).status, 200);
  const conflict = fixture(); await issued(conflict); conflict.profiles.push({ ...conflict.profile, id: randomUUID(), username: 'new.user', status: 'active' });
  assert.equal((await conflict.post('complete-activation', credentials())).status, 409); assert.equal(conflict.writes, 0);
});
test('login resolves names server-side, hides account existence, rate limits, and uses verified database roles', async () => {
  const f = fixture('active'); const wrong = await f.post('login', { username: 'test.user', password: 'wrong' }); const unknown = await f.post('login', { username: 'unknown.user', password: 'wrong' });
  assert.equal(wrong.status, 401); assert.deepEqual(await wrong.json(), await unknown.json());
  assert.deepEqual(await (await f.post('login', { username: 'TEST.USER', password: good })).json(), { redirect: '/employee' });
  const mgr = fixture('active', 'manager'); assert.deepEqual(await (await mgr.post('login', { username: 'test.user', password: good })).json(), { redirect: '/manager' });
  for (let i = 0; i < 10; i++) await f.post('login', { username: 'limited.user', password: 'wrong' }); assert.equal((await f.post('login', { username: 'limited.user', password: 'wrong' })).status, 429);
});
test('server role guards reject anonymous, wrong-role, disabled, and revoked sessions', async () => {
  const f = fixture('active'); const guards = f.load('lib/auth/session.ts');
  await assert.rejects(guards.requireRole('employee'), e => e.destination === '/login'); await f.signIn(); assert.equal((await guards.requireRole('employee')).role, 'employee');
  await assert.rejects(guards.requireRole('manager'), e => e.destination === '/employee'); f.sessions.clear(); await assert.rejects(guards.requireRole('employee'), e => e.destination === '/login');
  await f.signIn(); f.profile.status = 'disabled'; await assert.rejects(guards.requireRole('employee'), e => e.destination === '/login');
  const m = fixture('active', 'manager'); await m.signIn(); await assert.rejects(m.load('lib/auth/session.ts').requireRole('employee'), e => e.destination === '/manager');
});
test('logout removes access and credentials require current-password reauthentication', async () => {
  const f = fixture('active'); await f.signIn(); assert.equal((await f.post('credentials', { ...credentials('updated.user'), oldPassword: 'wrong' })).status, 401); assert.equal(f.writes, 0);
  assert.equal((await f.post('credentials', { ...credentials('updated.user'), oldPassword: good })).status, 200); assert.equal(f.profile.username, 'updated.user'); assert.equal(f.session, null);
  await f.signIn(); assert.equal((await f.post('logout')).status, 200); assert.equal(await f.load('lib/auth/session.ts').authenticatedAccount(), null);
});
test('unknown and active recovery requests are generic; scanner GET never consumes OTP', async () => {
  const f = fixture('active'); const a = await f.post('forgot-password', { email: f.profile.email }); const b = await f.post('forgot-password', { email: 'unknown@example.invalid' }); assert.deepEqual(await a.json(), await b.json());
  await f.flush(); assert.equal(f.mails.length, 1);
  const response = await f.load('app/auth/recovery/route.ts').GET(new Request(f.mails[0].url)); assert.equal(response.status, 303); assert.equal(f.otpUsed, undefined); assert.equal(f.jar.get('worksync-recovery-token'), f.recoveryHash);
});
test('password recovery rejects expired/reused OTPs, signed-in users without recovery proof, and succeeds for a valid link', async () => {
  const f = fixture('active'); await f.signIn(); assert.equal((await f.post('reset-password', credentials())).status, 410);
  f.recoveryHash = 'b'.repeat(64); f.jar.set('worksync-recovery-token', f.recoveryHash); f.otpExpired = true; assert.equal((await f.post('reset-password', credentials())).status, 410);
  f.otpExpired = false; const newPassword = 'Updated-WorkSync-2026!'; const body = { password: newPassword, confirmPassword: newPassword };
  assert.equal((await f.post('reset-password', body)).status, 200); assert.equal(f.passwords.get(f.profile.email), newPassword); assert.equal(f.sessions.size, 0);
  f.jar.set('worksync-recovery-token', f.recoveryHash); assert.equal((await f.post('reset-password', body)).status, 410);
});
test('password recovery retries a failed global sign-out without changing the password twice', async () => {
  const f = fixture('active'); f.recoveryHash = 'c'.repeat(64); f.jar.set('worksync-recovery-token', f.recoveryHash); f.failSignOut = true;
  assert.equal((await f.post('reset-password', credentials())).status, 503); assert.equal(f.writes, 1); assert.ok(f.jar.get('worksync-recovery-proof'));
  assert.equal((await f.post('reset-password', credentials())).status, 200); assert.equal(f.writes, 1); assert.equal(f.sessions.size, 0);
});
test('migration restricts token/profile writes and privileged functions; no business tables exist', () => {
  const sql = fs.readFileSync(path.join(root, 'supabase/migrations/202610140001_authentication.sql'), 'utf8');
  assert.equal((sql.match(/enable row level security/g) || []).length, 3);
  assert.match(sql, /revoke all on function/); assert.match(sql, /from public, anon, authenticated/); assert.match(sql, /create unique index activation_one_processing_per_profile/);
  const tables = [...sql.matchAll(/create table public\.(\w+)/g)].map(m => m[1]); assert.deepEqual(tables, ['profiles', 'activation_tokens', 'auth_rate_limits']);
  assert.ok(!sql.includes('plaintext')); assert.ok(!sql.includes('encrypted_password'));
});

function provisioningFixture(existing = false) {
  const profiles = new Map([
    ['MGR-001', { email: 'chryztelsalvador@gmail.com', status: 'invited', auth_user_id: null }],
    ['EMP-001', { email: 'dump3319@gmail.com', status: 'invited', auth_user_id: null }],
  ]);
  const state = { users: existing ? [...profiles.values()].map(p => ({ id: randomUUID(), email: p.email, email_confirmed_at: '2026-10-01T00:00:00Z' })) : [], creates: 0, associations: 0, profiles };
  const admin = {
    from() { let id; return { select() { return this; }, eq(_, value) { id = value; return this; }, async maybeSingle() { return { data: profiles.get(id) || null, error: null }; } }; },
    auth: { admin: {
      async listUsers() { return { data: { users: state.users }, error: null }; },
      async createUser(input) { state.creates++; assert.equal(input.email_confirm, false); assert.ok(input.password.length >= 48); assert.match(input.app_metadata.employee_id, /^(MGR|EMP)-001$/); assert.equal(input.app_metadata.role, input.app_metadata.employee_id.startsWith('MGR') ? 'manager' : 'employee'); const user = { id: randomUUID(), email: input.email }; state.users.push(user); return { data: { user }, error: null }; },
      async updateUserById() { throw new Error('Provisioning must never overwrite existing credentials'); },
    } },
    async rpc(name, args) {
      assert.equal(name, 'auth_provision_profile');
      if (state.failAssociation) { state.failAssociation = false; return { error: { code: 'offline' } }; }
      state.associations++; const p = profiles.get(args.p_employee_id); assert.equal(p.status, 'invited'); assert.equal(p.auth_user_id, null);
      p.auth_user_id = args.p_user_id; p.status = args.p_existing_active ? 'active' : 'invited';
      if (args.p_existing_active) p.username = args.p_employee_id.toLowerCase();
      return { data: 'associated', error: null };
    },
  };
  return { admin, state, provision: fixture().load('lib/auth/provisioning.ts').provisionAccounts };
}
test('provisioning dry-run has no writes and repeated apply never recreates or resets accounts', async () => {
  const f = provisioningFixture(); await f.provision(f.admin, false, () => {}); assert.equal(f.state.creates, 0); assert.equal(f.state.associations, 0);
  await f.provision(f.admin, true, () => {}); assert.equal(f.state.creates, 2); assert.equal(f.state.associations, 2);
  await f.provision(f.admin, true, () => {}); assert.equal(f.state.creates, 2); assert.equal(f.state.associations, 2);
});
test('provisioning associates existing confirmed accounts as active without changing credentials', async () => {
  const f = provisioningFixture(true); await f.provision(f.admin, true, () => {}); assert.equal(f.state.creates, 0);
  assert.equal(f.state.profiles.get('MGR-001').status, 'active'); assert.equal(f.state.profiles.get('MGR-001').username, 'mgr-001');
  await f.provision(f.admin, true, () => {}); assert.equal(f.state.associations, 2);
});
test('provisioning recovers an Auth creation followed by failed profile association', async () => {
  const f = provisioningFixture(); f.state.failAssociation = true; await assert.rejects(f.provision(f.admin, true, () => {})); assert.equal(f.state.creates, 1);
  await f.provision(f.admin, true, () => {}); assert.equal(f.state.creates, 2); assert.equal(f.state.users.length, 2); assert.equal(f.state.associations, 2);
});
test('provisioning refuses association mismatches and preserves existing status', async () => {
  const f = provisioningFixture(true); const p = f.state.profiles.get('MGR-001'); p.auth_user_id = randomUUID(); p.status = 'active';
  await assert.rejects(f.provision(f.admin, true, () => {}), /association mismatch/); assert.equal(f.state.creates, 0); assert.equal(p.status, 'active');
});
