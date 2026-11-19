# Security audit — migration branch

Date: 2026-11-19

## Scope and safety boundary

This is a source-code audit of the migration branch. It does not change Firebase Rules, production data, credentials, or deployed services. Findings below describe current client-side behavior inherited from the legacy app.

## Findings

### High — Telegram bot credential is available to browser clients

- The app reads `artifacts/uns-fleet-service/public/data_v2/telegramConfig` from all signed-in clients.
- The node contains `botToken` and `chatId`; the app copies them into client state and localStorage.
- Notification delivery calls the Telegram Bot API directly from the browser using that token.
- A user/device that can read this node can extract the bot token and use it outside this app.

### High — Gemini API key is stored client-side

- The Gemini key is loaded from localStorage and the admin settings node.
- The browser calls the Gemini API directly.
- A browser user with access to the key can reuse it outside this app and generate quota/cost exposure.

### Medium — additional integration endpoints and configuration are client-side

- WhatsApp gateway URL and Google Sheets webhook URL are stored in client settings and used by browser fetch calls.
- A webhook URL may itself act as a bearer credential. Treat it as secret unless its owner confirms otherwise.
- Export/backup data includes integration configuration fields; backups must be treated as sensitive.


### High — client-side admin flag treats every email/password account as admin

- The auth-state handler sets `isAdmin = !user.isAnonymous`.
- There is no client-side role/custom-claim verification in this flow. Therefore, any non-anonymous Firebase account is presented with admin capabilities in the UI.
- This is only a UI gate; it is not a security boundary. RTDB Rules must independently enforce which authenticated UIDs may write master data, settings, and sensitive nodes.
- Before changing this behavior, define the approved admin UID list or server-managed custom claim and confirm that the production Rules enforce it. Do not infer the admin list from email domain or from the fact that an account can sign in.

### Medium — FCM bridge endpoint is embedded in the browser

- The application posts notification requests directly to a Google Apps Script web-app endpoint from the browser.
- Treat the endpoint as public and assume requests can be replayed or forged unless the script validates Firebase ID tokens, authorizes the requested action, and applies rate limits.
- Validate the deployed script's authorization behavior before changing the client payload or endpoint. The source audit cannot verify the script's deployed code or access settings.

### Informational — Firebase web API key

The Firebase web `apiKey` in the client configuration is an application identifier, not an Admin SDK credential. Its exposure is expected for Firebase web apps; access must be controlled by Authentication, RTDB Security Rules, and optionally App Check.

## Recommended remediation sequence

1. Provision a trusted backend endpoint (Firebase Cloud Functions or Cloud Run) and configure Telegram/Gemini/WhatsApp/Sheets secrets in the server's secret manager or environment configuration.
2. Add authorization checks to backend actions. Do not trust a client-supplied role flag; verify the Firebase ID token and the intended admin authorization on the server.
3. Move notification and AI requests to the backend. Return only operation status and non-sensitive response data to the browser.
4. Stop reading/writing bot tokens and API keys from public RTDB nodes and browser localStorage. Remove legacy copies only after the backend has been configured and the new flow has passed end-to-end tests.
5. Review RTDB Rules against actual read/write operations and test with anonymous and admin accounts before applying any rule change.
6. Rotate exposed Telegram/Gemini credentials after cutover. Rotation is required because previously distributed client copies cannot be reliably recalled.

## Do not do yet

- Do not delete `telegramConfig` or existing settings fields yet; current notification delivery depends on them.
- Do not tighten production Rules blindly; the current client directly reads and writes multiple nodes.
- Do not claim secrets are protected until the server endpoint is deployed, clients no longer receive the secrets, and the old credentials are rotated.

## Current migration branch safeguards

- Existing RTDB project and `artifacts/uns-fleet-service/public/data_v2` node layout remain unchanged.
- Realtime listener unsubscribe functions are tracked and released on root component teardown.
- Admin settings listener is released on logout without detaching the public data listeners.
- SheetJS is now imported from the pinned npm dependency instead of loaded from a third-party CDN.


## Admin management implementation status — migration branch only

- Added callable Firebase Functions for one-time primary-admin bootstrap, Admin creation, Admin listing, and Admin-claim revocation. These functions use Firebase Authentication Admin SDK and do not read or write Realtime Database.
- The bootstrap endpoint accepts only the verified account matching the server-side `BOOTSTRAP_ADMIN_EMAIL` parameter. It refuses first-time bootstrap if another Admin claim already exists.
- The frontend now checks the server-issued `admin: true` custom claim and the standard `email_verified` token claim. A non-admin email/password sign-in is returned to anonymous public mode.
- The frontend has a Manajemen Admin dialog. New accounts receive an Admin custom claim but must verify their email before the application treats them as Admin.
- Revocation removes the Admin custom claim and revokes refresh tokens. Already-issued ID tokens can remain valid until expiry; production RTDB Rules must be tested with this propagation window in mind.
- GitHub Actions run `44449172118` passed on commit `4cf57cdff44fd832a96437f47ece9feb9cdf1376`, including typecheck, tests, build, Functions dependency installation, and Functions syntax validation. Subsequent UI hardening changes are subject to their own latest CI result.
- Firebase Functions have not been deployed. The `BOOTSTRAP_ADMIN_EMAIL` parameter has not been configured in the live project. The primary account has not been verified against live Firebase Authentication from this repository workflow.
- No RTDB Rules file or `.firebaserc` project binding is present in this repository branch. Therefore, this source change does not establish production database authorization. The legacy UI previously used client-side role checks; all production write permissions must be independently enforced by the live RTDB Rules before enabling this migration.
- App Check is not enforced by the callable functions yet. Configure and validate App Check for the production web app before enabling enforcement.
- Do not deploy or replace the production app until the live Rules are inspected and tested with anonymous, primary-admin, ordinary-account, and revoked-admin sessions.


## Live RTDB Rules audit — supplied by project owner (2026-11-19)

Scope: static review of the owner-supplied Rules JSON against the migration branch paths and repository operations. No production Rules, RTDB data, Authentication users, or deployed services were changed. This is not an Emulator or live authorization test.

### Findings

- **Critical — Telegram credential disclosure (known, owner-accepted risk):** `artifacts/uns-fleet-service/public/data_v2/telegramConfig/.read` is `auth != null`. Anonymous Authentication satisfies this condition, and the current client attaches a Telegram config listener for every session and stores the bot token in client state. The token is therefore available to any authenticated/anonymous app session. On 2026-11-19 the owner explicitly instructed that Telegram remain unchanged because notifications are working reliably. Preserve the current permission and delivery flow; do not migrate, rotate, or disable Telegram in this work. This is an accepted risk, not a technical remediation. See `docs/TELEGRAM_COMPATIBILITY_DECISION.md`.
- **High — Custom Claims Admin are not authorized by the supplied Rules:** the Admin management implementation checks `auth.token.admin === true`, but the supplied Rules authorize privileged writes using only the fixed UID `cCEggFojkdNXlDneD3p3zHdreIg1`. Newly created Admin accounts will not be able to manage `vehicles`, `drivers`, `logs`, `settings`, `serviceAlertState`, `notifications`, `keyStats`, `meta`, or `telegramConfig` unless the relevant Rules explicitly recognize the Admin custom claim. The bootstrap account's UID must be verified against the existing fixed UID before rollout; do not assume they are the same account.
- **High — Admin settings listener mismatch:** the frontend attaches the `settings` listener for a verified custom-claim Admin, while the supplied `settings/.read` only permits the fixed UID. A newly bootstrapped or added Admin will receive a permission-denied error on this listener.
- **Medium — Anonymous vehicle update policy:** the `vehicles/$vehicleId/.write` condition allows anonymous sessions to update existing records only when the listed identity/master/service-baseline fields remain unchanged and `currentKm` does not decrease. This is consistent with a restricted odometer/operational-update pattern, but it does not explicitly constrain the other writable operational fields. Validate the exact intended field allowlist and payloads with RTDB Emulator before changing it. Anonymous sessions cannot create or delete vehicle records under this condition.
- **Medium — notification token validation:** each token write requires `newData.child('uid').val() == auth.uid` and validates required fields. This binds a token record to the authenticated UID, but the supplied rule does not permit deletion because a delete has null `newData`. Confirm whether token cleanup is required and design a narrowly scoped delete rule if so.
- **Compatibility caution — shared/legacy paths:** the supplied Rules also cover sibling `data` and nodes such as `serviceAlertState`, `notifications`, `keyStats`, and `meta`. The migration branch's core repository uses `data_v2/{vehicles,drivers,logs,settings,telegramConfig,notificationTokens}`; other apps may depend on the sibling paths. Do not remove or rename any of these paths.

### Safe next steps

1. Confirm whether the fixed UID in the Rules is the same Firebase Authentication account as the designated primary Admin email. Verify this in Firebase Authentication; do not infer it from the email address.
2. Prepare a proposed Rules revision that preserves current anonymous reads and the existing anonymous vehicle operational-update behavior, while adding a Custom Claims Admin path alongside the legacy UID during migration.
3. Before any production Rules change, test anonymous, legacy UID Admin, primary custom-claim Admin, additional custom-claim Admin, ordinary email/password user, and revoked Admin against every affected node using RTDB Emulator.
4. Preserve Telegram's current `telegramConfig` read and delivery behavior per the owner's 2026-11-19 compatibility decision; retain the Emulator compatibility test and document the accepted token-exposure risk.
5. Obtain explicit owner approval before applying any production Rules or deploying any service.



## Follow-up validation — Admin UID and verified-claim enforcement (2026-11-19)

- The project owner confirmed that the legacy fixed UID `cCEggFojkdNXlDneD3p3zHdreIg1` belongs to the designated primary Admin account `Kala@gmail.com`. This resolves the earlier UID-identity uncertainty.
- The proposed Rules file now permits the legacy primary UID and, separately, a custom-claim Admin only when both `auth.token.admin === true` and `auth.token.email_verified === true`. The same verified-claim requirement is applied to privileged reads and writes, including the vehicle Admin write path.
- This prevents a newly created Admin account from exercising RTDB Admin privileges before email verification. The callable Functions already require a verified caller for Admin operations.
- Static Node tests now assert that each privileged write path contains both the Admin and email-verification checks, while retaining the legacy primary UID. These tests inspect the Rules text; they are not equivalent to RTDB Emulator authorization tests.
- Latest CI for commit `c2465987f7dfae75073df63d42a3b2cfa672b90e` completed successfully (typecheck, tests, Vite build, Functions install and syntax check). The follow-up Rules/test commits are awaiting their own CI run.
- No Emulator test, live Authentication lookup, production Rules update, Functions deployment, or application deployment has been performed. Production remains unchanged.


## Primary Admin account-management boundary (2026-11-19)

- The owner-designated primary account is bound to the confirmed UID `cCEggFojkdNXlDneD3p3zHdreIg1` (email `Kala@gmail.com`).
- The one-time bootstrap endpoint now requires both the verified configured email and this exact UID.
- Creating, listing, and revoking Admin accounts now require a verified Admin custom claim **and** the primary UID. Additional Admins retain their application Admin permissions but cannot grant or revoke other Admin accounts.
- The frontend shows the Manajemen Admin entry only to the primary UID, guards the management methods, and clears the primary-admin UI state when the session returns to Anonymous.
- Revocation still removes the target's Admin custom claim and revokes refresh tokens without deleting the Firebase Auth account or RTDB data. Existing ID tokens may remain valid until expiry; the proposed Rules require the Admin claim and verified email, but token revocation propagation must still be tested.
- These are migration-branch source changes only. The Functions have not been deployed and the new Rules have not been applied to production.


### Additional Rules hardening

The proposed RTDB Rules now require `auth.token.email_verified === true` for **both** the confirmed primary UID and every custom-claim Admin path. This avoids an unverified session for the legacy primary UID bypassing the email-verification condition. Anonymous operational vehicle updates remain a separate narrowly scoped branch and retain their existing conditions.


## RTDB Emulator validation completed (2026-11-19)

- GitHub Actions run #113 for commit `c1e489ec0630c2c8d375594ccba98580dea69265` completed successfully.
- All 9 RTDB Rules Emulator authorization tests passed. Coverage includes unauthenticated vs Anonymous Auth reads, primary UID, verified additional Admin custom claim, ordinary/revoked Admin denial, unverified primary and additional Admin denial, Anonymous odometer update restrictions, verified Admin vehicle master updates, notification-token ownership/deletion behavior, and legacy Telegram config read compatibility.
- The emulator ran with demo project ID `demo-uns-fleet-service`; it did not connect to production.
- Typecheck, Node tests, Vite build, Functions install, and Functions syntax validation also passed in the same workflow run.
- The exact latest branch commit now includes rollout documentation; its own CI run must also be checked before describing the branch head as fully green.


## Owner decision — Telegram compatibility (2026-11-19)

The owner has chosen to retain the currently working Telegram integration unchanged. The critical token-exposure finding remains present and must not be described as fixed. Telegram configuration access, client listener, token handling, and message delivery are out of scope for this hardening pass. See `docs/TELEGRAM_COMPATIBILITY_DECISION.md`. Other Admin and database authorization work may proceed independently.


## Latest branch CI confirmation (2026-11-19)

- GitHub Actions run #123 for commit `643294a5de24ffbf3063db68d778be808c4510e0` completed successfully.
- All workflow steps passed: dependency installation, TypeScript typecheck, Node tests, RTDB Rules Emulator tests, Vite production build, Functions dependency installation, and Functions lint/syntax check.
- The RTDB Emulator uses the isolated demo project `demo-uns-fleet-service`; no production Firebase project was accessed.
- This confirms branch validation only. It does not deploy Functions, apply RTDB Rules, or change production data/services.



## Application-operation cross-check — follow-up (2026-11-19)

Scope: reviewed the migration branch's actual RTDB repositories and the legacy application call sites against `database.rules.proposed.json`. This remains a static source review; no live database or production service was accessed.

### Confirmed compatibility

- The app's primary data root is `artifacts/uns-fleet-service/public/data_v2`.
- Fleet listeners read `vehicles`, `drivers`, and `logs`; the corresponding Rules permit authenticated reads, including the Anonymous Auth sessions used by the app.
- Vehicle operational sync writes `currentKm`, `isUnderService`, `targetWorkshop`, `inServiceDate`, `inServiceNotes`, and `damageNotes`. The current Anonymous vehicle rule preserves the existing identity/master/service-baseline fields and prevents odometer rollback.
- Master vehicle edits and vehicle/log deletions are routed through the Admin UI and are intended to require a verified primary UID or verified Admin custom claim.
- Driver and service-log writes are likewise Admin-only in the proposed Rules.
- Settings writes and the settings listener are only used in the verified Admin flow.
- The FCM token save payload includes `uid`, `token`, `app`, `platform`, and `updatedAt`, satisfying the required-child validation; the UID is taken from the current Firebase Auth user.
- The application repository currently has a token-save operation but no token-read or token-delete operation.

### New findings requiring a deliberate Rules decision

- **High — Anonymous sessions can change vehicle visibility:** the anonymous vehicle write condition does not compare `isHidden` with its existing value. The application has a dedicated visibility toggle, which should be treated as Admin/master-data functionality. As written, an Anonymous session can potentially change `isHidden` while satisfying the other unchanged-field checks.
- **High — Anonymous vehicle writes are not an explicit field allowlist:** the condition protects selected identity/master/service-baseline fields and enforces non-decreasing `currentKm`, but does not reject arbitrary additional fields. The current client operational sync uses the six fields listed above; the Rules should be designed around a verified full record schema and an explicit operational-field allowlist. Do not add a blanket wildcard denial until legacy records and sibling apps have been checked for additional fields.
- **High — FCM token list is readable by every authenticated session:** `notificationTokens/.read` is `auth != null`, but no read operation for this node was found in the migration app. This exposes all stored device tokens to every Anonymous/authenticated client. Confirm whether another app depends on client-side reads; if not, narrow this read permission (preferably deny client reads and use trusted server-side access).
- **Medium — FCM token deletion is denied:** the token write rule requires `newData.child('uid') == auth.uid`; deletion has null `newData`. The migration app currently does not delete tokens, so this does not block a discovered app flow. Add a UID-bound delete rule only if token cleanup is required.
- **Telegram remains unchanged by owner decision:** the current app reads the Telegram config on every authenticated session and calls Telegram Bot API directly. Preserve this flow in this work; its credential exposure remains an accepted risk, not a fixed issue.

### Safe remediation proposal (not yet applied)

1. Tighten Anonymous vehicle updates so `isHidden` and every other master/administrative field must remain unchanged. Preserve only the required operational updates.
2. Define and test a complete vehicle record schema before rejecting unknown fields. Preserve compatibility with existing records and other apps sharing this RTDB path.
3. Verify whether any sibling app reads `notificationTokens`. If not, remove broad client read access; keep owner-bound token writes.
4. Add Emulator tests for Anonymous attempts to change `isHidden`, add unknown fields, and update each allowed operational field; also test token-list read denial for Anonymous and ordinary authenticated users.
5. Do not change Telegram configuration permissions or delivery behavior.
6. Obtain explicit approval before applying any proposed Rules to production.


### Branch-only targeted fix — Anonymous vehicle visibility (2026-11-19)

- Updated the proposed Anonymous vehicle write condition to require `isHidden` to remain equal to its existing value. This closes the specific visibility-toggle gap found in the static review while preserving the existing Admin path.
- Updated the static Rules assertion and RTDB Emulator tests to check that Anonymous sessions cannot change `isHidden`, while retaining the operational fields currently written by the app (`currentKm`, `isUnderService`, `targetWorkshop`, `inServiceDate`, `inServiceNotes`, and `damageNotes`).
- This change is on `migration/vue3-typescript-vite` only. CI for the resulting commits is pending. No production Rules were changed.
- The broader unknown-field issue remains open: this targeted change does not establish a complete allowlist for every vehicle property. Inventory all legacy and sibling-app vehicle fields before attempting that hardening.
- The broad `notificationTokens/.read = auth != null` permission also remains unchanged pending confirmation that no sibling app relies on client-side reads. Telegram remains unchanged per the owner's explicit compatibility decision.
