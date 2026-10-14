import 'server-only';
import { after } from 'next/server';
import { cookies } from 'next/headers';
import { adminClient, isolatedAuthClient } from '../supabase/admin';
import { serverClient } from '../supabase/server';
import { authenticatedAccount } from './session';
import { appOrigin, cookieOptions, required } from './config';
import { newActivationToken, validActivationToken, tokenHash, privateHash, readRecoveryProof, signRecoveryProof } from './crypto';
import { completeActivation, ActivationFailure, type ActivationOperation } from './activation';
import { sendAuthEmail } from './email';
import { ACTIVATION_COOKIE, RECOVERY_TOKEN_COOKIE, RECOVERY_PROOF_COOKIE, GENERIC_EMAIL_MESSAGE, normalizeUsername, validUsername, validPassword, validEmail, roleDestination, type AccountProfile } from './policy';
import { AuthHttpError, input, rateLimit } from './http';

async function passwordMatches(email: string, password: string) {
  const client = isolatedAuthClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) return false;
  await client.auth.signOut({ scope: 'local' });
  return true;
}
function passwordInput(body: Record<string, unknown>) {
  const password = input(body, 'password', 128);
  if (!validPassword(password)) throw new AuthHttpError(400, 'Use 12–128 characters, including uppercase, lowercase, a number, and a symbol.');
  if (password !== input(body, 'confirmPassword', 128)) throw new AuthHttpError(400, 'The passwords do not match.');
  return password;
}
export async function login(body: Record<string, unknown>) {
  const username = normalizeUsername(input(body, 'username', 64));
  const password = input(body, 'password', 128);
  if (!validUsername(username) || !password) throw new AuthHttpError(400, 'Enter your username and password.');
  await rateLimit('login', username, 10, 900);
  const { data, error } = await adminClient().from('profiles').select('*').eq('username', username).eq('status', 'active').maybeSingle();
  if (error) throw new AuthHttpError(503, 'Authentication is temporarily unavailable.');
  const profile = data as AccountProfile | null;
  // Unknown names still make an Auth request, and every account error is generic.
  const email = profile?.email || `unknown-${privateHash(username, required('SUPABASE_SECRET_KEY')).slice(0, 24)}@invalid.worksync.local`;
  const client = await serverClient();
  const result = await client.auth.signInWithPassword({ email, password });
  if (result.error || !result.data.user || !profile || result.data.user.id !== profile.auth_user_id) {
    if (result.data.user) await client.auth.signOut({ scope: 'local' });
    throw new AuthHttpError(401, 'Invalid username or password.');
  }
  // Re-check the profile and session after sign-in; roles come from the database.
  const account = await authenticatedAccount();
  if (!account) { await client.auth.signOut({ scope: 'local' }); throw new AuthHttpError(401, 'Invalid username or password.'); }
  return { redirect: roleDestination(account.profile.role) };
}
export async function logout() {
  const client = await serverClient();
  const { error } = await client.auth.signOut({ scope: 'local' });
  if (error) throw new AuthHttpError(503, 'Could not finish signing out. Please retry.');
  const jar = await cookies();
  for (const name of [ACTIVATION_COOKIE, RECOVERY_TOKEN_COOKIE, RECOVERY_PROOF_COOKIE]) jar.delete(name);
  return { redirect: '/login' };
}
export async function requestActivation(body: Record<string, unknown>) {
  const employeeId = input(body, 'employeeId', 32).trim().toUpperCase();
  const email = input(body, 'email').trim().toLowerCase();
  if (!validEmail(email) || !/^[A-Z]{3}-\d{3}$/.test(employeeId)) throw new AuthHttpError(400, 'Enter a valid registered email and employee ID.');
  await rateLimit('activation-request', `${employeeId}:${email}`, 3);
  const raw = newActivationToken(); const hash = tokenHash(raw); const admin = adminClient();
  const { data, error } = await admin.rpc('auth_issue_activation', { p_employee_id: employeeId, p_email: email, p_hash: hash });
  if (error) throw new AuthHttpError(503, 'Activation is temporarily unavailable. Please try again later.');
  // Send after the generic response. Delivery latency does not reveal eligibility.
  // A failed/uncertain send retains a valid token; a later request can rotate it.
  if (data) after(async () => {
    try {
      await sendAuthEmail({ to: data.email, name: data.display_name, kind: 'activation', url: `${appOrigin()}/auth/activate?token=${encodeURIComponent(raw)}`, expires: data.expires_at });
      await admin.from('activation_tokens').update({ delivery_status: 'sent' }).eq('token_hash', hash);
    } catch {
      await admin.from('activation_tokens').update({ delivery_status: 'failed' }).eq('token_hash', hash);
      console.error('WorkSync activation email failed or delivery is uncertain.');
    }
  });
  return { message: GENERIC_EMAIL_MESSAGE };
}
export async function activate(body: Record<string, unknown>) {
  const username = normalizeUsername(input(body, 'username', 64));
  if (!validUsername(username)) throw new AuthHttpError(400, 'Use 3–32 letters, numbers, dots, underscores, or hyphens for your username.');
  const password = passwordInput(body); const jar = await cookies(); const raw = jar.get(ACTIVATION_COOKIE)?.value || '';
  if (!validActivationToken(raw)) throw new AuthHttpError(410, 'This activation link is invalid, expired, or already used. Request a new link.');
  const hash = tokenHash(raw); await rateLimit('activation-complete', hash, 10);
  const admin = adminClient();
  try {
    await completeActivation({
      async begin(value, name) {
        const { data, error } = await admin.rpc('auth_begin_activation', { p_hash: value, p_username: name });
        if (error?.code === '23505') throw new AuthHttpError(409, 'This username is unavailable. Please choose another.');
        if (error) throw new AuthHttpError(503, 'Setup could not start. If you already submitted, retry with the same username and password.');
        return data as ActivationOperation | null;
      },
      async setPassword(userId, value) {
        try {
          const { error } = await admin.auth.admin.updateUserById(userId, { password: value, email_confirm: true });
          if (!error) return 'ok';
          return error.status && error.status >= 400 && error.status < 500 ? 'rejected' : 'unknown';
        } catch { return 'unknown'; }
      },
      verifyPassword: passwordMatches,
      async finish(value, operation) {
        const { data, error } = await admin.rpc('auth_finish_activation', { p_hash: value, p_operation: operation });
        if (error) throw new ActivationFailure('pending');
        return data === true;
      },
      async cancel(value, operation) { const { error } = await admin.rpc('auth_cancel_activation', { p_hash: value, p_operation: operation }); if (error) throw new ActivationFailure('pending'); },
    }, hash, username, password);
  } catch (error) {
    if (error instanceof ActivationFailure) {
      if (error.code === 'invalid') throw new AuthHttpError(410, 'This link is invalid, expired, or already used. If setup finished, sign in.');
      if (error.code === 'password') throw new AuthHttpError(400, 'Supabase could not accept this password. Choose a different strong password and retry.');
      throw new AuthHttpError(503, 'Setup is pending. Retry with the exact same username and password. If the link expires, contact your administrator.');
    }
    throw error;
  }
  jar.delete(ACTIVATION_COOKIE);
  // Completing an invitation in a browser already signed into another account
  // must still lead to a fresh login, rather than silently reopening that portal.
  await (await serverClient()).auth.signOut({ scope: 'local' });
  return { redirect: '/credentials-updated?mode=activation' };
}
export async function forgotPassword(body: Record<string, unknown>) {
  const email = input(body, 'email').trim().toLowerCase();
  if (!validEmail(email)) throw new AuthHttpError(400, 'Enter a valid email address.');
  await rateLimit('recovery-request', email, 3);
  const { data, error } = await adminClient().from('profiles').select('email, display_name').eq('email', email).eq('status', 'active').maybeSingle();
  if (error) throw new AuthHttpError(503, 'Password recovery is temporarily unavailable.');
  if (data) after(async () => {
    try {
      // generateLink does not send mail. Only EmailJS sends the reviewed template.
      const result = await adminClient().auth.admin.generateLink({ type: 'recovery', email: data.email });
      const hash = result.data.properties?.hashed_token;
      if (result.error || !hash) throw new Error('Recovery link unavailable');
      await sendAuthEmail({ to: data.email, name: data.display_name, kind: 'recovery', url: `${appOrigin()}/auth/recovery?token_hash=${encodeURIComponent(hash)}`, expires: 'This link expires according to your Supabase email OTP expiry setting (recommended: 30 minutes).' });
    } catch { console.error('WorkSync recovery email failed or delivery is uncertain.'); }
  });
  return { message: GENERIC_EMAIL_MESSAGE };
}
export async function resetPassword(body: Record<string, unknown>) {
  const password = passwordInput(body); const jar = await cookies();
  await rateLimit('recovery-complete', tokenHash(jar.get(RECOVERY_TOKEN_COOKIE)?.value || jar.get(RECOVERY_PROOF_COOKIE)?.value || 'missing'), 10);
  let account = await authenticatedAccount();
  let proof = readRecoveryProof(jar.get(RECOVERY_PROOF_COOKIE)?.value || '', required('SUPABASE_SECRET_KEY'));
  if (!proof || !account || proof.userId !== account.user.id || proof.sessionId !== account.sessionId) {
    const token = jar.get(RECOVERY_TOKEN_COOKIE)?.value || '';
    if (!/^[a-f0-9]{64}$/.test(token)) throw new AuthHttpError(410, 'This recovery link is invalid or expired. Request a new link.');
    const client = await serverClient();
    const result = await client.auth.verifyOtp({ type: 'recovery', token_hash: token });
    if (result.error || !result.data.user) throw new AuthHttpError(410, 'This recovery link is invalid, expired, or already used.');
    account = await authenticatedAccount();
    if (!account) { await client.auth.signOut({ scope: 'local' }); throw new AuthHttpError(403, 'This account cannot use password recovery.'); }
    proof = { purpose: 'recovery', userId: account.user.id, sessionId: account.sessionId, expires: Date.now() + 15 * 60 * 1000 };
    jar.set(RECOVERY_PROOF_COOKIE, signRecoveryProof(proof, required('SUPABASE_SECRET_KEY')), cookieOptions(900));
    jar.delete(RECOVERY_TOKEN_COOKIE);
  }
  if (!proof.passwordUpdated) {
    const result = await account.client.auth.updateUser({ password });
    if (result.error) {
      // A timed-out prior write may already have set this password. Reconcile it
      // using Auth instead of leaving a valid recovery session unable to finish.
      if (!await passwordMatches(account.profile.email, password)) throw new AuthHttpError(503, 'The password could not be updated. Retry here while this recovery session is valid.');
    }
    proof = { ...proof, passwordUpdated: true };
    jar.set(RECOVERY_PROOF_COOKIE, signRecoveryProof(proof, required('SUPABASE_SECRET_KEY')), cookieOptions(Math.max(1, Math.floor((proof.expires - Date.now()) / 1000))));
  }
  const { error } = await account.client.auth.signOut({ scope: 'global' });
  if (error) throw new AuthHttpError(503, 'Password updated. Please retry to finish revoking existing sessions.');
  jar.delete(RECOVERY_PROOF_COOKIE); jar.delete(RECOVERY_TOKEN_COOKIE);
  return { redirect: '/credentials-updated?mode=recovery' };
}
export async function updateCredentials(body: Record<string, unknown>) {
  const account = await authenticatedAccount();
  if (!account) throw new AuthHttpError(401, 'Please sign in again.');
  const username = normalizeUsername(input(body, 'username', 64));
  if (!validUsername(username)) throw new AuthHttpError(400, 'Use a valid username with 3–32 characters.');
  const oldPassword = input(body, 'oldPassword', 128);
  const password = input(body, 'password', 128);
  if (password) passwordInput(body);
  if (!oldPassword) throw new AuthHttpError(400, 'Enter your current password to update credentials.');
  await rateLimit('credentials', account.user.id, 5);
  if (!await passwordMatches(account.profile.email, oldPassword)) throw new AuthHttpError(401, 'The current password is incorrect.');
  const admin = adminClient();
  const { data: collision, error: lookupError } = await admin.from('profiles').select('id').eq('username', username).neq('id', account.profile.id).maybeSingle();
  if (lookupError) throw new AuthHttpError(503, 'Credentials are temporarily unavailable.');
  if (collision) throw new AuthHttpError(409, 'This username is unavailable.');
  if (password) {
    const { error } = await account.client.auth.updateUser({ password });
    if (error) throw new AuthHttpError(503, 'Password update could not be confirmed. Try signing in with your new password before retrying.');
  }
  const { error } = await admin.from('profiles').update({ username }).eq('id', account.profile.id).eq('status', 'active');
  if (error) throw new AuthHttpError(409, password ? 'Password updated, but the username was unavailable. Sign in using your previous username and new password.' : 'This username is unavailable.');
  const { error: signOutError } = await account.client.auth.signOut({ scope: 'global' });
  if (signOutError) throw new AuthHttpError(503, 'Credentials updated. Please sign out and sign in again.');
  jarClearRecovery(await cookies());
  return { redirect: '/credentials-updated' };
}
function jarClearRecovery(jar: Awaited<ReturnType<typeof cookies>>) { for (const key of [ACTIVATION_COOKIE, RECOVERY_TOKEN_COOKIE, RECOVERY_PROOF_COOKIE]) jar.delete(key); }
