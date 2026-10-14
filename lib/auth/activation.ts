// The workflow is testable without Supabase or email. Database RPCs serialize claims.
export type ActivationOperation = { id: string; user_id: string; email: string; mode: 'mutate' | 'resume' };
export type ActivationDependencies = {
  begin: (hash: string, username: string) => Promise<ActivationOperation | null>;
  setPassword: (userId: string, password: string) => Promise<'ok' | 'rejected' | 'unknown'>;
  verifyPassword: (email: string, password: string) => Promise<boolean>;
  finish: (hash: string, operationId: string) => Promise<boolean>;
  cancel: (hash: string, operationId: string) => Promise<void>;
};
export class ActivationFailure extends Error {
  constructor(public code: 'invalid' | 'password' | 'pending') { super(code); }
}
export async function completeActivation(deps: ActivationDependencies, hash: string, username: string, password: string) {
  const operation = await deps.begin(hash, username);
  if (!operation) throw new ActivationFailure('invalid');
  if (operation.mode === 'resume') {
    // After a timeout, never blindly repeat an Auth credential write. Only reconcile
    // an already applied password. A concurrent request cannot overwrite it.
    if (!await deps.verifyPassword(operation.email, password)) throw new ActivationFailure('pending');
  } else {
    const outcome = await deps.setPassword(operation.user_id, password);
    if (outcome === 'rejected') {
      await deps.cancel(hash, operation.id);
      throw new ActivationFailure('password');
    }
    if (outcome === 'unknown') throw new ActivationFailure('pending');
  }
  if (!await deps.finish(hash, operation.id)) throw new ActivationFailure('pending');
}
