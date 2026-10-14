import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
export function newActivationToken() { return randomBytes(32).toString('base64url'); }
export function validActivationToken(token: string) { return /^[A-Za-z0-9_-]{43}$/.test(token); }
export function tokenHash(token: string) { return createHash('sha256').update(token).digest('hex'); }
export function privateHash(value: string, key: string) { return createHmac('sha256', key).update(value).digest('hex'); }
export type RecoveryProof = { purpose: 'recovery'; userId: string; sessionId: string; expires: number; passwordUpdated?: boolean };
export function signRecoveryProof(proof: RecoveryProof, key: string) {
  const payload = Buffer.from(JSON.stringify(proof)).toString('base64url');
  return `${payload}.${privateHash(payload, key)}`;
}
export function readRecoveryProof(value: string, key: string, now = Date.now()): RecoveryProof | null {
  try {
    const [payload, signature, extra] = value.split('.');
    if (extra || !payload || !/^[a-f0-9]{64}$/.test(signature || '')) return null;
    if (!timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(privateHash(payload, key), 'hex'))) return null;
    const proof = JSON.parse(Buffer.from(payload, 'base64url').toString()) as RecoveryProof;
    if (proof.purpose !== 'recovery' || typeof proof.userId !== 'string' || typeof proof.sessionId !== 'string' || !Number.isFinite(proof.expires) || proof.expires <= now) return null;
    return proof;
  } catch { return null; }
}
