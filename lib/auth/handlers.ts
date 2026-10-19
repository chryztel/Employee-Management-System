import 'server-only';
import { after } from 'next/server';
import { cookies } from 'next/headers';
import { adminClient, isolatedAuthClient } from '../supabase/admin';
import { serverClient } from '../supabase/server';
import { authenticatedAccount } from './session';
import { appOrigin, cookieOptions, required } from './config';
import { randomInt } from 'node:crypto';
import { newActivationToken, temporaryPassword, tokenHash, privateHash, readRecoveryProof, signRecoveryProof } from './crypto';
import { completeActivation, ActivationFailure, type ActivationOperation } from './activation';
import { sendAuthEmail } from './email';
import { MUST_CHANGE_CREDENTIALS, RECOVERY_TOKEN_COOKIE, RECOVERY_PROOF_COOKIE, GENERIC_EMAIL_MESSAGE, normalizeUsername, validUsername, validPassword, validEmail, roleDestination, type AccountProfile } from './policy';
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
  return { redirect: account.mustChangeCredentials ? '/update-credentials' : roleDestination(account.profile.role) };
}
export async function logout() {
  const client = await serverClient();
  const { error } = await client.auth.signOut({ scope: 'local' });
  if (error) throw new AuthHttpError(503, 'Could not finish signing out. Please retry.');
  const jar = await cookies();
  for (const name of [RECOVERY_TOKEN_COOKIE, RECOVERY_PROOF_COOKIE]) jar.delete(name);
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
  // Activate and email after the generic response. Latency does not reveal eligibility.
  if (data) after(async () => {
    try {
      const credentials = await issueTemporaryCredentials(hash, employeeId.toLowerCase());
      await sendAuthEmail({ to: data.email, name: data.display_name, kind: 'activation', url: `${appOrigin()}/login`, expires: '', ...credentials });
      await admin.from('activation_tokens').update({ delivery_status: 'sent' }).eq('token_hash', hash);
    } catch {
      await admin.from('activation_tokens').update({ delivery_status: 'failed' }).eq('token_hash', hash);
      console.error('WorkSync activation or email delivery failed or is uncertain.');
    }
  });
  else after(async () => {
    try { await resendTemporaryCredentials(employeeId, email); }
    catch { console.error('WorkSync temporary credential resend failed or is uncertain.'); }
  });
  return { message: GENERIC_EMAIL_MESSAGE };
}
// A lost or unreadable activation email must not strand the account: while the
// temporary credentials are still unreplaced, a new request rotates the password.
async function resendTemporaryCredentials(employeeId: string, email: string) {
  const admin = adminClient();
  const { data, error } = await admin.from('profiles').select('*').eq('employee_id', employeeId).eq('email', email).eq('status', 'active').maybeSingle();
  const profile = data as AccountProfile | null;
  if (error || !profile) return;
  const { data: auth, error: userError } = await admin.auth.admin.getUserById(profile.auth_user_id);
  if (userError || auth.user?.app_metadata?.[MUST_CHANGE_CREDENTIALS] !== true) return;
  const password = temporaryPassword();
  const { error: writeError } = await admin.auth.admin.updateUserById(profile.auth_user_id, { password });
  if (writeError) throw new Error('Temporary password rotation failed');
  await sendAuthEmail({ to: profile.email, name: profile.display_name, kind: 'activation', url: `${appOrigin()}/login`, expires: '', username: profile.username, password });
}
class UsernameTaken extends Error {}
// Activates the invited account with a server-chosen username and random temporary
// password. The Auth flag forces /update-credentials until the user replaces both.
async function issueTemporaryCredentials(hash: string, baseUsername: string) {
  const admin = adminClient(); const password = temporaryPassword();
  for (const username of [baseUsername, `${baseUsername}-${randomInt(1000, 10000)}`]) {
    try {
      await completeActivation({
        async begin(value, name) {
          const { data, error } = await admin.rpc('auth_begin_activation', { p_hash: value, p_username: name });
          if (error?.code === '23505') throw new UsernameTaken();
          if (error) throw new ActivationFailure('pending');
          return data as ActivationOperation | null;
        },
        async setPassword(userId, value) {
          try {
            // Auth merges app_metadata keys, so employee_id/role are preserved.
            const { error } = await admin.auth.admin.updateUserById(userId, { password: value, email_confirm: true, app_metadata: { [MUST_CHANGE_CREDENTIALS]: true } });
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
      return { username, password };
    } catch (error) { if (!(error instanceof UsernameTaken)) throw error; }
  }
  throw new ActivationFailure('invalid');
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
  // First login after activation: the temporary password was just verified by
  // sign-in, so a new password is mandatory and the current one is not re-asked.
  const firstLogin = account.mustChangeCredentials;
  const oldPassword = firstLogin ? '' : input(body, 'oldPassword', 128);
  const password = firstLogin ? passwordInput(body) : input(body, 'password', 128);
  if (password) passwordInput(body);
  if (!firstLogin && !oldPassword) throw new AuthHttpError(400, 'Enter your current password to update credentials.');
  await rateLimit('credentials', account.user.id, 5);
  if (firstLogin) {
    if (await passwordMatches(account.profile.email, password)) throw new AuthHttpError(400, 'Choose a new password, not the temporary one from your email.');
  } else if (!await passwordMatches(account.profile.email, oldPassword)) throw new AuthHttpError(401, 'The current password is incorrect.');
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
  if (firstLogin) {
    const { error: flagError } = await admin.auth.admin.updateUserById(account.user.id, { app_metadata: { [MUST_CHANGE_CREDENTIALS]: false } });
    if (flagError) throw new AuthHttpError(503, 'Credentials saved, but setup could not finish. Sign in with your new username and password, then retry.');
  }
  const { error: signOutError } = await account.client.auth.signOut({ scope: 'global' });
  if (signOutError) throw new AuthHttpError(503, 'Credentials updated. Please sign out and sign in again.');
  jarClearRecovery(await cookies());
  return { redirect: firstLogin ? '/credentials-updated?mode=activation' : '/credentials-updated' };
}
function jarClearRecovery(jar: Awaited<ReturnType<typeof cookies>>) { for (const key of [RECOVERY_TOKEN_COOKIE, RECOVERY_PROOF_COOKIE]) jar.delete(key); }
