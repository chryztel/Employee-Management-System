// CLI-only workflow; injectable for offline idempotency tests.
import { randomBytes } from 'node:crypto';
import type { SupabaseClient, User } from '@supabase/supabase-js';
const enrolled = [
  { employeeId: 'MGR-001', email: 'chryztelsalvador@gmail.com', role: 'manager' },
  { employeeId: 'EMP-001', email: 'dump3319@gmail.com', role: 'employee' },
] as const;
export async function provisionAccounts(admin: SupabaseClient, apply = false, log: (text: string) => void = console.log) {
  log(apply ? 'Provisioning enrolled accounts. Existing credentials will not be changed.' : 'DRY RUN: no users, profiles, passwords, or email delivery will be changed.');
  const users: User[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw new Error('Could not read Auth users. Check server credentials and project access.');
    users.push(...data.users); if (data.users.length < 100) break;
  }
  for (const item of enrolled) {
    const { data: profile, error } = await admin.from('profiles').select('auth_user_id, status, email, username').eq('employee_id', item.employeeId).maybeSingle();
    if (error || !profile) {
      log(`${item.employeeId}: tracked authentication migration is required.`);
      if (apply) throw new Error('Apply the SQL migration before provisioning.');
      continue;
    }
    if (profile.email !== item.email) throw new Error(`${item.employeeId}: enrollment mismatch; refusing to modify.`);
    const matches = users.filter(u => u.email?.toLowerCase() === item.email);
    if (matches.length > 1) throw new Error(`${item.employeeId}: ambiguous Auth identity; refusing to modify.`);
    let user = matches[0];
    if (profile.auth_user_id) {
      if (!user || user.id !== profile.auth_user_id) throw new Error(`${item.employeeId}: association mismatch; refusing to modify.`);
      log(`${item.employeeId}: already associated (${profile.status}); unchanged.`); continue;
    }
    if (profile.status !== 'invited') throw new Error(`${item.employeeId}: existing profile status preserved; manual review required.`);
    if (!apply) { log(`${item.employeeId}: ${user ? 'associate existing Auth user without changing credentials' : 'create unconfirmed Auth user with an undisclosed random password'}; profile will be ${user?.email_confirmed_at ? 'active with employee-ID username' : 'invited'}.`); continue; }
    if (!user) {
      // app_metadata is server-controlled (users cannot edit it). The profiles row stays
      // the authority for authorization; this mirrors identity for operators and logs.
      const { data, error: createError } = await admin.auth.admin.createUser({ email: item.email, password: randomBytes(48).toString('base64url'), email_confirm: false, app_metadata: { employee_id: item.employeeId, role: item.role } });
      if (createError || !data.user) throw new Error(`${item.employeeId}: creation was not confirmed. Rerun dry-run to reconcile; do not reset any password.`);
      user = data.user;
    }
    // Associating existing confirmed accounts marks them active, preserving their
    // Auth credentials. They cannot be reset through the invited activation flow.
    const { data, error: associateError } = await admin.rpc('auth_provision_profile', { p_employee_id: item.employeeId, p_user_id: user.id, p_existing_active: Boolean(user.email_confirmed_at) });
    if (associateError) throw new Error(`${item.employeeId}: association incomplete. Rerun dry-run; existing Auth credentials remain unchanged.`);
    log(`${item.employeeId}: ${data}.`);
  }
  log('No emails sent. No existing Auth credentials overwritten.');
}
