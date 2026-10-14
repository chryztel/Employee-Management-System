// Shared validation contains no credentials or privileged clients.
export type AccountRole = 'employee' | 'manager';
export type AccountProfile = {
  id: string; auth_user_id: string; employee_id: string; email: string;
  role: AccountRole; status: string; username: string; display_name: string;
};
export function normalizeUsername(value: string) { return value.trim().toLowerCase(); }
export function validUsername(value: string) { return /^[a-z0-9][a-z0-9_.-]{2,31}$/.test(value); }
export function validEmail(value: string) { return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
export function passwordRules(value: string) {
  return { length: value.length >= 12 && value.length <= 128, upper: /[A-Z]/.test(value), lower: /[a-z]/.test(value), number: /[0-9]/.test(value), symbol: /[^A-Za-z0-9\s]/.test(value) };
}
export function validPassword(value: string) { return Object.values(passwordRules(value)).every(Boolean); }
export function roleDestination(role: AccountRole) { return role === 'manager' ? '/manager' : '/employee'; }
export function isAuthorized(profile: Pick<AccountProfile, 'role' | 'status'> | null, role: AccountRole) { return profile?.status === 'active' && profile.role === role; }
export const ACTIVATION_COOKIE = 'worksync-activation';
export const RECOVERY_TOKEN_COOKIE = 'worksync-recovery-token';
export const RECOVERY_PROOF_COOKIE = 'worksync-recovery-proof';
export const GENERIC_EMAIL_MESSAGE = 'If the details match an eligible account, an email with the next steps will arrive shortly. Check your inbox and spam folder.';
