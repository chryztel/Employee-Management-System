import { checkOrigin, readBody, json, AuthHttpError } from '@/lib/auth/http';
import { login, logout, requestActivation, activate, forgotPassword, resetPassword, updateCredentials } from '@/lib/auth/handlers';
export const maxDuration = 60;

const handlers: Record<string, (body: Record<string, unknown>) => Promise<object>> = {
  login, logout, 'request-activation': requestActivation, 'complete-activation': activate,
  'forgot-password': forgotPassword, 'reset-password': resetPassword, credentials: updateCredentials,
};
export async function POST(request: Request, context: { params: Promise<{ action: string }> }) {
  try {
    checkOrigin(request);
    const action = (await context.params).action;
    const handler = handlers[action];
    if (!handler || !Object.hasOwn(handlers, action)) return json({ error: 'Not found.' }, 404);
    return json(await handler(await readBody(request)));
  } catch (error) {
    if (error instanceof AuthHttpError) return json({ error: error.message }, error.status);
    console.error('WorkSync authentication request failed.');
    return json({ error: 'Authentication is temporarily unavailable. Please try again later.' }, 503);
  }
}
