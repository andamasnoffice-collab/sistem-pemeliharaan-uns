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

GitHub Actions run #123 on latest documented branch commit `643294a5de24ffbf3063db68d778be808c4510e0` passed:
- TypeScript typecheck
- Node test suite
- 9 RTDB Rules Emulator authorization tests
- Vite production build
- Cloud Functions dependency installation and syntax check

The Emulator tests use project ID `demo-uns-fleet-service` and do not connect to the production Firebase project.

## Latest validation update (2026-11-19)

GitHub Actions run #123 completed successfully on the latest documented branch commit. All workflow steps passed, including typecheck, Node tests, 9 RTDB Rules Emulator tests, Vite build, and Functions lint/syntax check. The Emulator used the isolated demo project, not production.

## Production rollout — do not run without explicit owner approval

1. Confirm the production Firebase project and current deployed Functions/Rules state.
2. Confirm the primary account's actual Firebase Auth UID and verified email in Firebase Console; this project owner previously confirmed the UID used in source.
3. Configure the Functions parameter `BOOTSTRAP_ADMIN_EMAIL` to the exact primary account email through the approved Firebase deployment process.
4. Review and approve the proposed RTDB Rules. Do not overwrite current production Rules without a fresh export/backup and a controlled rollout plan.
5. Deploy Functions first, then bootstrap the primary Admin once and force-refresh the primary user's ID token.
6. Apply the reviewed RTDB Rules only after confirming the existing application reads/writes still pass. Keep rollback copy of the current Rules.
7. Test primary Admin, additional Admin, unverified Admin, ordinary user, Anonymous odometer flow, and Admin revocation on a controlled account.
8. Deploy the web application only after production Functions and Rules tests pass.

## Telegram compatibility decision — owner accepted (2026-11-19)

- The project owner explicitly chose to keep the existing Telegram integration unchanged because notifications are working reliably.
- Preserve the current `telegramConfig` read permission, browser listener, client-side configuration flow, and Telegram Bot API delivery path. Do not migrate, disable, rotate, or otherwise change Telegram as part of this work unless the owner later requests it.
- This is an accepted compatibility/security risk, not a claim that the bot token is protected: any authenticated client that can read `telegramConfig` may be able to obtain its bot token. Keep this limitation visible in the audit record.
- The isolated RTDB Emulator suite includes a compatibility test confirming that the existing Telegram config read remains available. Do not remove or weaken that test.

## Remaining rollout controls

- Continue hardening and validating Admin authorization independently of Telegram.
- Do not place additional secrets in the repository.
- Production deployment, production RTDB Rules changes, and changes to the `main` branch require explicit owner approval.
