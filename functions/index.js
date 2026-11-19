const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineString } = require("firebase-functions/params");

initializeApp();

const REGION = "asia-southeast1";
const bootstrapAdminEmail = defineString("BOOTSTRAP_ADMIN_EMAIL");

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function requireVerifiedEmail(request) {
  const email = normalizeEmail(request.auth && request.auth.token && request.auth.token.email);
  const verified = Boolean(request.auth && request.auth.token && request.auth.token.email_verified);
  if (!request.auth || !email || !verified) {
    throw new HttpsError("unauthenticated", "Login dengan email terverifikasi diperlukan.");
  }
  return email;
}

function requireAdmin(request) {
  if (!request.auth || request.auth.token.admin !== true || request.auth.token.email_verified !== true) {
    throw new HttpsError("permission-denied", "Akses khusus Admin dengan email terverifikasi.");
  }
  return request.auth.uid;
}

async function countAdmins() {
  let nextPageToken;
  let count = 0;
  do {
    const page = await getAuth().listUsers(1000, nextPageToken);
    count += page.users.filter((user) => user.customClaims && user.customClaims.admin === true).length;
    nextPageToken = page.pageToken;
  } while (nextPageToken);
  return count;
}

/**
 * One-time bootstrap for the designated primary administrator.
 * The account must already exist in Firebase Authentication and have a verified email.
 * The configured email is stored as a Functions environment parameter, never in the client.
 */
exports.bootstrapPrimaryAdmin = onCall({ region: REGION }, async (request) => {
  const email = requireVerifiedEmail(request);
  const configuredEmail = normalizeEmail(bootstrapAdminEmail.value());
  if (!configuredEmail || email !== configuredEmail) {
    throw new HttpsError("permission-denied", "Akun ini bukan Admin utama yang ditetapkan.");
  }

  const user = await getAuth().getUser(request.auth.uid);
  if (normalizeEmail(user.email) !== configuredEmail || !user.emailVerified) {
    throw new HttpsError("permission-denied", "Verifikasi email Admin utama belum valid.");
  }

  const adminCount = await countAdmins();
  if (adminCount > 0 && !(user.customClaims && user.customClaims.admin === true)) {
    throw new HttpsError("failed-precondition", "Bootstrap ditutup karena klaim Admin sudah ada.");
  }

  await getAuth().setCustomUserClaims(user.uid, {
    ...(user.customClaims || {}),
    admin: true
  });
  return { ok: true, uid: user.uid, role: "admin" };
});

/** Create a new email/password account and grant the Admin custom claim. */
exports.createAdmin = onCall({ region: REGION }, async (request) => {
  requireAdmin(request);
  const email = normalizeEmail(request.data && request.data.email);
  const password = String((request.data && request.data.password) || "");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpsError("invalid-argument", "Format email tidak valid.");
  }
  if (password.length < 12) {
    throw new HttpsError("invalid-argument", "Password sementara minimal 12 karakter.");
  }

  try {
    const user = await getAuth().createUser({
      email,
      password,
      emailVerified: false,
      disabled: false
    });
    await getAuth().setCustomUserClaims(user.uid, { admin: true });
    return { ok: true, uid: user.uid, email: user.email };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    if (error && error.code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", "Email sudah terdaftar.");
    }
    throw new HttpsError("internal", "Akun Admin gagal dibuat.");
  }
});

/** Remove Admin privilege without deleting the Firebase account or application data. */
exports.revokeAdmin = onCall({ region: REGION }, async (request) => {
  const callerUid = requireAdmin(request);
  const targetUid = String((request.data && request.data.uid) || "").trim();
  if (!targetUid) throw new HttpsError("invalid-argument", "UID target wajib diisi.");
  if (targetUid === callerUid) {
    throw new HttpsError("failed-precondition", "Admin tidak dapat mencabut hak Admin milik sendiri.");
  }

  const target = await getAuth().getUser(targetUid);
  if (!(target.customClaims && target.customClaims.admin === true)) {
    return { ok: true, changed: false };
  }
  if ((await countAdmins()) <= 1) {
    throw new HttpsError("failed-precondition", "Admin terakhir tidak dapat dinonaktifkan.");
  }

  const claims = { ...(target.customClaims || {}) };
  delete claims.admin;
  await getAuth().setCustomUserClaims(targetUid, claims);
  await getAuth().revokeRefreshTokens(targetUid);
  return { ok: true, changed: true, uid: targetUid };
});

/** List only Admin account metadata; never returns passwords or private credentials. */
exports.listAdmins = onCall({ region: REGION }, async (request) => {
  requireAdmin(request);
  const admins = [];
  let nextPageToken;
  do {
    const page = await getAuth().listUsers(1000, nextPageToken);
    for (const user of page.users) {
      if (user.customClaims && user.customClaims.admin === true) {
        admins.push({
          uid: user.uid,
          email: user.email || "",
          disabled: user.disabled,
          emailVerified: user.emailVerified
        });
      }
    }
    nextPageToken = page.pageToken;
  } while (nextPageToken);
  return { admins };
});
