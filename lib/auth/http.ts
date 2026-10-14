import 'server-only';
import { adminClient } from '../supabase/admin';
import { appOrigin, required } from './config';
import { privateHash } from './crypto';
export class AuthHttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function checkOrigin(request: Request) {
  if (request.headers.get('origin') !== appOrigin() || request.headers.get('sec-fetch-site') === 'cross-site') throw new AuthHttpError(403, 'Please submit this form from WorkSync.');
}
export async function readBody(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new AuthHttpError(415, 'A JSON request is required.');
  // Read with a hard cap rather than trusting Content-Length.
  const reader = request.body?.getReader();
  if (!reader) throw new AuthHttpError(400, 'Please complete the form.');
  const chunks: Uint8Array[] = []; let size = 0;
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > 8192) { await reader.cancel(); throw new AuthHttpError(413, 'Request is too large.'); }
    chunks.push(value);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('body');
    return body;
  } catch { throw new AuthHttpError(400, 'Please complete the form with valid details.'); }
}
export function input(body: Record<string, unknown>, key: string, max = 254) {
  const value = body[key];
  if (typeof value !== 'string' || value.length > max) throw new AuthHttpError(400, 'Please complete the form with valid details.');
  return value;
}
export async function rateLimit(scope: string, identity: string, limit = 5, seconds = 900) {
  const admin = adminClient();
  // Both a global cap and a subject cap work across instances. Untrusted forwarded
  // headers cannot be used to evade the limit. Deploy behind an additional WAF cap.
  for (const [key, count, duration] of [[`${scope}:global`, 120, 60], [`${scope}:${identity}`, limit, seconds]] as const) {
    const { data, error } = await admin.rpc('auth_take_rate_limit', { p_key: privateHash(key, required('SUPABASE_SECRET_KEY')), p_limit: count, p_seconds: duration });
    if (error) throw new AuthHttpError(503, 'Authentication is temporarily unavailable. Please try again later.');
    if (!data) throw new AuthHttpError(429, 'Too many attempts. Please try again later.');
  }
}
export function json(data: object, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' } });
}
