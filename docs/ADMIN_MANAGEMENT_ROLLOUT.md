# Admin Management Rollout Checklist

Status: implementation and isolated RTDB Rules Emulator validation complete; production rollout intentionally pending owner approval.

## Implemented

- Primary administrator is bound to the owner-confirmed UID `cCEggFojkdNXlDneD3p3zHdreIg1`.
- One-time bootstrap requires the matching server-configured email, matching UID, and verified Firebase Authentication email.
- Only the primary administrator can create, list, and revoke Admin roles.
- Additional Admins receive the `admin: true` custom claim but must verify their email before app and RTDB Admin access is granted.
- Revocation removes the role claim and revokes refresh tokens; it does not delete the Firebase Authentication account or application data.
- RTDB Rules retain existing paths and Anonymous odometer update constraints.

## Validation completed

GitHub Actions run #113 on commit `c1e489ec0630c2c8d375594ccba98580dea69265` passed:
- TypeScript typecheck
- Node test suite
- 9 RTDB Rules Emulator authorization tests
- Vite production build
- Cloud Functions dependency installation and syntax check

The Emulator tests use project ID `demo-uns-fleet-service` and do not connect to the production Firebase project.

## Production rollout — do not run without explicit owner approval

1. Confirm the production Firebase project and current deployed Functions/Rules state.
2. Confirm the primary account's actual Firebase Auth UID and verified email in Firebase Console; this project owner previously confirmed the UID used in source.
3. Configure the Functions parameter `BOOTSTRAP_ADMIN_EMAIL` to the exact primary account email through the approved Firebase deployment process.
4. Review and approve the proposed RTDB Rules. Do not overwrite current production Rules without a fresh export/backup and a controlled rollout plan.
5. Deploy Functions first, then bootstrap the primary Admin once and force-refresh the primary user's ID token.
6. Apply the reviewed RTDB Rules only after confirming the existing application reads/writes still pass. Keep rollback copy of the current Rules.
7. Test primary Admin, additional Admin, unverified Admin, ordinary user, Anonymous odometer flow, and Admin revocation on a controlled account.
8. Deploy the web application only after production Functions and Rules tests pass.

## Outstanding security work

- `telegramConfig` is intentionally still readable by authenticated sessions for legacy client compatibility. It contains sensitive bot configuration. Migrate Telegram sending and credentials to a trusted backend, then remove client read access and rotate the exposed bot token before claiming the RTDB Rules audit is fully closed.
- Do not place service account keys, bot tokens, or other secrets in the browser or repository.
- Production deployment and changes to the `main` branch require explicit approval.
