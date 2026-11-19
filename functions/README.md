# Admin management backend

This folder contains callable Firebase Functions for managing Firebase Authentication Admin custom claims. It does not read or write Realtime Database and does not change the existing RTDB schema.

## Important safety gates

- The designated primary account is configured server-side as the Functions parameter `BOOTSTRAP_ADMIN_EMAIL`; it is not trusted from browser input.
- The primary account must already exist in Firebase Authentication and have a verified email.
- Only that exact verified account can run the one-time bootstrap, and bootstrap refuses to initialize if another Admin claim already exists.
- Subsequent Admin creation/revocation/listing requires a verified caller with the server-issued `admin: true` custom claim.
- Revocation removes only the Admin claim. It does not delete the Firebase Auth account or application data.
- Admin callable endpoints currently rely on verified Firebase Auth ID tokens and server-issued custom claims. App Check is not enforced yet because the current frontend has no App Check initialization; add and validate it before enabling enforcement.
- Do not deploy until the primary account has been confirmed in Firebase Authentication and the function source has passed review.

## Project setup (not executed)

1. Confirm the Firebase project is `uns-fleet-service` and the primary account `Kala@gmail.com` exists in Firebase Authentication with email verification complete.
2. Use a trusted operator workstation with Firebase CLI authenticated to the intended project.
4. Install dependencies in this folder with `npm install`.
5. Deploy only Functions using an explicit project selector, never RTDB Rules:
   `firebase deploy --only functions --project uns-fleet-service`
6. When prompted for `BOOTSTRAP_ADMIN_EMAIL`, set it to the confirmed primary account email.
7. Sign in as the primary account and invoke `bootstrapPrimaryAdmin` once. Refresh the ID token after the claim is set.
8. Verify Admin UI authorization and callable permissions with the primary account and a non-admin test account before enabling Admin management UI.

Firebase Functions deployment may require the project to use the Blaze billing plan. Confirm costs and quotas before deployment.

## Callable functions

- `bootstrapPrimaryAdmin()`: bootstrap the configured, verified primary account only when no Admin claim exists.
- `createAdmin({ email, password })`: creates a new Auth account and grants the Admin claim. Password must be at least 12 characters.
- `listAdmins()`: returns Admin UID, email, disabled state, and email-verification state.
- `revokeAdmin({ uid })`: removes the Admin claim, without deleting the account or application data. The caller cannot revoke itself; the last Admin cannot be revoked.

## Not yet connected

The existing frontend still uses its legacy `isAdmin = !user.isAnonymous` UI flag. Do not deploy these functions as a complete security fix until the frontend verifies the Admin custom claim and the production RTDB Rules independently enforce the intended UID/claim authorization. The RTDB Rules are not present in this repository and were not modified.
