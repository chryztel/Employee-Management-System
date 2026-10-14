# WorkSync authentication

Implemented authentication is separate from attendance, tasks, leave, and announcement demo data. The original portals and local UI state remain in place. Account identity, credentials, session logout, and server-side role access are now real authentication features.

## Current verification and setup status

- TypeScript, ESLint, production build, offline authentication/provisioning tests, and safe production HTTP smoke checks are available through the commands below.
- No live users were created or modified and no real emails were sent during development.
- The project-scoped `supabase-worksync` connector targets the same project reference as `.env.local`. It is configured read-only, so it can inspect but not apply migrations.
- Root cause of the Auth admin HTTP 500 (from Auth logs): `Scan error on column index 3, name "confirmation_token": converting NULL to string is unsupported`. Eight legacy `@chryztel.com` users from an earlier schema (`employees`, `departments`, `employee_emergency_contacts`, `app_settings`) were inserted by SQL with NULL `confirmation_token`, `recovery_token`, `email_change_token_new`, and `email_change`. GoTrue cannot list users until those columns are set to `''`. This repair touches no passwords, but it modifies live Auth rows and requires owner approval. Provisioning dry-run is blocked until it is done.
- Public signup is currently ENABLED on the live project (`disable_signup: false` from `/auth/v1/settings`). Disable it in the dashboard (Authentication → Sign In / Providers → Allow new users to sign up).
- Legacy users have no `profiles` row, so they cannot sign in to WorkSync. They are retained pending an owner audit; nothing was deleted.
- Security advisor warnings (SECURITY DEFINER functions executable by anon, mutable search_path, extensions in `public`) belong to the legacy schema, not the authentication migration.
- Provisioning sets server-controlled `app_metadata` (`employee_id`, `role`) on newly created Auth users. The `profiles` table remains the authorization source.
- SQL integration tests are supplied for a disposable test database and have not been run against live data.
- Browser visual and end-to-end interaction checks remain pending because the session has no available browser surface. Do not treat offline tests as email-delivery verification.
- Dependency audit reports five high-severity entries in the existing `eslint-config-next` → `fast-glob` → `micromatch` → `braces@3.0.3` development dependency chain. The root advisory is [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). Review a compatible patched lint dependency before accepting untrusted lint patterns; npm's suggested Next ESLint downgrade is a separate compatibility decision.

## Environment

Use `.env.example` as the variable-name reference. Keep real values exclusively in `.env.local` / deployment secrets. No secret keys are embedded in client bundles. `SUPABASE_SECRET_KEY` is the privileged modern server key; EmailJS private credentials are used only by the server REST request.

`NEXT_PUBLIC_APP_URL` must be the exact browser origin, such as `http://localhost:3000` for development or your HTTPS production origin. All form requests use a strict Origin check. Previewing on another port requires setting this origin for that instance and rebuilding. Do not use a public production HTTP origin.

## Migration and provisioning

1. Inspect existing tables in the project configured in `.env.local`. If `profiles`, `activation_tokens`, or `auth_rate_limits` already exist with another schema, stop and reconcile them; the migration deliberately does not replace existing tables.
2. Apply `supabase/migrations/202610140001_authentication.sql` through your tracked Supabase CLI migration workflow. For a new linked repository, use `npx supabase init`, `npx supabase login`, `npx supabase link --project-ref <the reference in .env.local>`, then `npx supabase db push`. Review the target and migration plan before applying. The migration creates only three authentication-related tables, restricted RPCs, constraints, and RLS; it seeds the two invited enrollment records without creating Auth users.
3. Run `npm run auth:provision` for a read-only dry-run (Node 24, or Node 22.18+ with native TypeScript support).
4. After approval to create/associate live accounts, run `npm run auth:provision -- --apply`. There is no HTTP provisioning endpoint. This script does not send emails.
5. Re-run dry-run. Both identities should report associated. Repeated apply is idempotent.

| Employee ID | Registered email | Role |
| --- | --- | --- |
| MGR-001 | chryztelsalvador@gmail.com | manager |
| EMP-001 | dump3319@gmail.com | employee |

New Auth users receive an undisclosed cryptographically random password and remain unconfirmed/invited. They cannot access the portals until activation finishes. Existing Auth passwords are never overwritten by provisioning. Existing confirmed users are associated as active with a default username of `mgr-001` / `emp-001`, preserving their Auth credentials. Already-associated profiles (including disabled ones) remain unchanged. Conflicting associations abort. If Auth creation succeeds but profile association fails, the next run associates that existing user instead of recreating it.

The migration is additive. Rollback means deploying a maintenance/login shell while retaining Auth users and authentication tables. Do not roll production back to the old unguarded demo routes or drop live identities/tables. No destructive rollback is executed by this implementation.

## Required Supabase dashboard settings

- Enable Email/password sign-in; disable **Allow new users to sign up** and anonymous sign-ins. No public registration is implemented, but the project-level Auth API must also reject signup. [General configuration](https://supabase.com/docs/guides/auth/general-configuration).
- Keep email confirmation enabled. Successful token-based activation explicitly confirms the pre-created account through the server Admin API.
- Set Site URL to the exact `NEXT_PUBLIC_APP_URL`. Add your HTTPS production origin and local development origin to allowed redirect URLs; include `/auth/recovery` and `/auth/activate` paths where needed. Links generated here use a fixed server-configured origin, not a user-supplied redirect.
- Set Email OTP Expiration to **1800 seconds** for password recovery. Supabase controls recovery OTP expiry; the application separately enforces a 30-minute activation expiry and a 15-minute recovery retry proof. [Email OTP/link expiry](https://supabase.com/docs/guides/auth/auth-email-passwordless).
- Set a password minimum of 12 characters and require lowercase, uppercase, digits, and symbols. Leaked-password protection can be enabled if supported by your plan. The app validates the same rules before password writes. [Password security](https://supabase.com/docs/guides/auth/password-security).
- This implementation reauthenticates the current password before normal credential updates. It does not implement Supabase's separate nonce/OTP reauthentication UI: keep **Secure password change** disabled unless that additional flow is added. Recovery uses the verified recovery session.
- Keep Auth rate limits enabled. Add a deployment/WAF request cap. Application limits are database-backed per normalized subject plus a global route cap; they do not trust arbitrary forwarded IP headers. Supabase outages fail closed.

No Supabase SMTP customization is required for the application emails: `admin.generateLink` generates recovery tokens without sending mail, and EmailJS sends both kinds of messages. Other dashboard security-notification emails are controlled by Supabase settings.

## EmailJS configuration and template mapping

Enable API requests from non-browser applications in EmailJS Account → Security and use the configured private key. Confirm the service and template are active and have sufficient quota. [Server API](https://www.emailjs.com/docs/rest-api/send/) / [Node SDK server-request setting](https://github.com/emailjs-com/emailjs-nodejs).

One template supports both activation and recovery. Configure the recipient as `{{to_email}}`, subject as `{{email_subject}}`, and the button link as `{{action_url}}` (not a fixed URL).

| Variable | Value/use |
| --- | --- |
| `to_email` | Registered account recipient |
| `to_name` | Profile display name |
| `app_name` | WorkSync |
| `email_subject` | Activate your WorkSync account / Reset your WorkSync password |
| `message` | Action-specific instructions |
| `action_label` | Activate account / Reset password |
| `action_url` | Full single-use activation or recovery URL |
| `activation_link` | Activation URL for activation mail; empty for recovery |
| `reset_link` | Recovery URL for recovery mail; empty for activation |
| `expires_at` | Activation expiry timestamp / Supabase recovery expiry instructions |

Do not place a username/password or any API key in the template. Token URLs are private bearer links. Disable link tracking, keep the application's no-referrer policy, and redact query strings from hosting/access logs.

Email delivery runs through Next.js `after()` following a generic response to avoid revealing eligibility through provider latency. Hosts must support Next.js after-response work and the handler's configured 60-second maximum duration. Activation rows record pending/sent/failed provider submission status; “sent” is API acceptance, not proof of inbox delivery. An uncertain send keeps the token valid; requesting another link rotates unclaimed older tokens. No raw activation token is stored in the database. If the process dies before sending, request another link.

## Configured routes

| Route | Purpose |
| --- | --- |
| `/` | Redirect to login |
| `/login` | Username/password login; existing sessions redirect to their role |
| `/activate` | Registered email/employee ID activation request |
| `/auth/activate?token=…` | Validate link server-side, stage HttpOnly token, remove token from URL |
| `/activation-confirmed` | Email verified; credentials still required |
| `/update-credentials` | Initial credentials with activation grant, or authenticated account settings |
| `/credentials-updated` | Completion confirmation and redirect to login |
| `/forgot-password` | Generic recovery email request |
| `/auth/recovery?token_hash=…` | Stage recovery token; GET does not consume OTP |
| `/reset-password` | Verify recovery OTP and set password on POST |
| `/employee`, `/manager` | Server-verified role-restricted portals |

POST JSON endpoints under `/api/auth/`: `login`, `logout`, `request-activation`, `complete-activation`, `forgot-password`, `reset-password`, and `credentials`. Unsupported actions, including signup, return 404. Requests require the configured Origin, JSON body, and an 8 KB size cap. Activation tokens and recovery proofs are HttpOnly; login/session persistence uses HttpOnly Supabase cookies with SameSite=Lax and Secure on HTTPS. `proxy.ts` refreshes cookies; page/API guards verify the Supabase user, current Auth session, and database profile role/status.

Normal credential changes require the current password, then sign out all sessions. Profile email is administrator-managed. Other contact fields remain local demo data. Business-module edits do not write to Supabase.

## Tests and live account walkthrough

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:auth
npm.cmd run build
npm.cmd run start -- --port 3101
# In a second terminal (smoke requests use the configured Origin):
npm.cmd run auth:smoke
```

`test:auth` is fully offline. It exercises the actual route handlers, validation, authorization, activation orchestration, signed proof expiry, concurrency, recovery, and provisioning with mocked Supabase/EmailJS boundaries. `auth:smoke` makes safe HTTP requests without emailing, logging into a real account, or changing passwords. It accepts `AUTH_TEST_BASE_URL` to change the server address. SQL/RLS integration tests in `supabase/tests/authentication.sql` must be run only on a disposable local/test Supabase database after the migration; fixtures are transactionally rolled back.

After live migration/provisioning and approval to send email:

1. Open `/activate`. Use **MGR-001** and **chryztelsalvador@gmail.com**; submit once and check inbox/spam. The response deliberately does not reveal whether the account is eligible.
2. Open the email link. Continue to create a unique manager username and a strong password. Confirm activation, then log in. Expect `/manager`.
3. In that manager session, visit `/employee`. Expect a server-side redirect to `/manager`.
4. Log out. Expect `/login`; direct access to either portal is denied.
5. Repeat for **EMP-001** and **dump3319@gmail.com**, choosing a different username. Expect `/employee`; visiting `/manager` redirects back to `/employee`.
6. Refresh and restart the browser within the session lifetime to check persistence. Use Profile settings or `/update-credentials` to change credentials with the current password; log in again with the new credentials.
7. Use `/forgot-password` with the registered email. Follow the recovery email, choose a new password, and sign in again. Verify the old password fails and replaying the recovery link cannot reset again.
8. Replay an activation link after success: it must be rejected. Use a dedicated test account/database to check real expiration or inspect a token after 30 minutes; do not shorten live tokens or reset active accounts just to test.

Existing confirmed accounts associated as active skip activation and use the employee-ID username plus their existing password. If that password is unknown, use the approved recovery process rather than provisioning a replacement password.

## Partial failures and operator recovery

- Activation reserves a unique username and marks a serialized operation before the external password write. Confirmed 4xx password rejection releases that claim. Transport/5xx uncertainty preserves it, preventing another password overwrite. Retry with the exact same username/password to verify an already-applied password and finish the DB transaction.
- If the operation never reached Auth or its token expires during an unresolved operation, it deliberately remains blocked. An administrator must inspect Supabase Auth logs and the invited profile/token before reconciliation. Do not automatically clear processing tokens or reset an active account. An explicit repair may finish an already-applied activation or cancel a demonstrably failed operation through the tracked privileged RPCs; uncertain password resets require separate approval.
- Recovery stores a signed, expiring retry proof bound to the verified user and Auth session. If password update succeeds but global signout fails, retry finishes session revocation without another password write. Consumed recovery OTPs cannot create another recovery session.
- Password update and username update are separate external/database operations. A rare username conflict after a password write produces an explicit partial-success message: sign in using the previous username and new password, then retry the username change.
- Keep the rate-limit table bounded with operational cleanup of rows older than one day, and periodically remove consumed/revoked non-processing tokens older than your audit retention period. Do not delete unresolved processing operations.

No Git commits, pushes, or identity changes are part of this setup.
