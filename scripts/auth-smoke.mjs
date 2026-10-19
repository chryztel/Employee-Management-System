// Safe production HTTP checks. Never sends email, signs into a real account,
// provisions users, or changes passwords. Run after `npm run build` + `npm start`.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
if (existsSync('.env.local')) process.loadEnvFile('.env.local');
const base = process.env.AUTH_TEST_BASE_URL || 'http://localhost:3101';
const origin = new URL(process.env.NEXT_PUBLIC_APP_URL || base).origin;
for (const [route, text] of [['/login', 'Welcome back'], ['/activate', 'Activate your account'], ['/forgot-password', 'Forgot your password?'], ['/credentials-updated', 'Credentials updated!']]) {
  const response = await fetch(base + route, { redirect: 'manual' });
  assert.equal(response.status, 200, route); assert.ok((await response.text()).includes(text), route);
  console.log(`${route}: public authentication page passed.`);
}
for (const route of ['/employee', '/manager', '/update-credentials', '/reset-password']) {
  const response = await fetch(base + route, { redirect: 'manual' }); const text = await response.text();
  const redirected = [303, 307, 308].includes(response.status) || text.includes('NEXT_REDIRECT') || text.includes('http-equiv="refresh"');
  assert.ok(redirected, `${route} must redirect anonymous visitors`);
  assert.ok(!text.includes('class="app-shell"'), `${route} must not expose the portal shell`);
  console.log(`${route}: anonymous access denied.`);
}
for (const [route, target] of [['/auth/recovery?token_hash=invalid', '/forgot-password']]) {
  const response = await fetch(base + route, { redirect: 'manual' }); assert.equal(response.status, 303); assert.equal(new URL(response.headers.get('location')).pathname, target);
  assert.ok(response.headers.get('cache-control').includes('no-store')); assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  console.log(`${route.split('?')[0]}: malformed link rejected.`);
}
async function post(action, body, requestOrigin = origin) {
  return fetch(`${base}/api/auth/${action}`, { method: 'POST', headers: { origin: requestOrigin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
assert.equal((await post('login', {}, 'https://attacker.invalid')).status, 403);
assert.equal((await post('signup', {})).status, 404);
assert.equal((await post('login', { username: '?', password: 'invalid' })).status, 400);
assert.equal((await post('complete-activation', { username: 'test.user', password: 'TestSafe-Password-2026!', confirmPassword: 'TestSafe-Password-2026!' })).status, 404);
assert.equal((await post('reset-password', { password: 'weak', confirmPassword: 'weak' })).status, 400);
assert.equal((await post('credentials', {})).status, 401);
console.log('HTTP route validation, CSRF, removed link activation, and credential authorization passed. No emails or real account changes.');
