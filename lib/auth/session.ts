import 'server-only';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { serverClient } from '../supabase/server';
import { adminClient } from '../supabase/admin';
import { isAuthorized, roleDestination, type AccountProfile, type AccountRole } from './policy';
export async function authenticatedAccount(readOnly = false) {
  await connection(); // Never evaluate an identity in a partial-prerender snapshot.
  const client = await serverClient(readOnly);
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return null;
  const { data: claims, error: claimsError } = await client.auth.getClaims();
  const sessionId = claims?.claims?.session_id;
  if (claimsError || typeof sessionId !== 'string') return null;
  const { data: sessionExists, error: sessionError } = await adminClient().rpc('auth_session_exists', { p_user_id: user.id, p_session_id: sessionId });
  if (sessionError) throw new Error('Session verification unavailable');
  if (!sessionExists) return null;
  const { data, error: profileError } = await client.from('profiles').select('*').eq('auth_user_id', user.id).eq('status', 'active').maybeSingle();
  if (profileError) throw new Error('Account verification unavailable');
  const profile = data as AccountProfile | null;
  if (!profile || !['employee', 'manager'].includes(profile.role)) return null;
  return { client, user, profile, sessionId };
}
export async function requireRole(role: AccountRole) {
  const account = await authenticatedAccount(true);
  if (!account) redirect('/login');
  if (!isAuthorized(account.profile, role)) redirect(roleDestination(account.profile.role));
  return account.profile;
}
