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
