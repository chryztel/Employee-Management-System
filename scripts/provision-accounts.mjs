import { existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { provisionAccounts } from '../lib/auth/provisioning.ts';
if (existsSync('.env.local')) process.loadEnvFile('.env.local');
function required(name) { if (!process.env[name]) throw new Error('Missing ' + name); return process.env[name].trim(); }
const admin = createClient(required('NEXT_PUBLIC_SUPABASE_URL'), required('SUPABASE_SECRET_KEY'), {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15000) }) },
});
provisionAccounts(admin, process.argv.includes('--apply')).catch(error => { console.error(error.message); process.exitCode = 1; });
