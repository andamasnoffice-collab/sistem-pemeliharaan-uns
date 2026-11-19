import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "./firebase";

const functions = app ? getFunctions(app, "asia-southeast1") : null;

function callable(name) {
  if (!functions) throw new Error("Firebase Functions belum terinisialisasi.");
  return httpsCallable(functions, name);
}

export async function bootstrapPrimaryAdmin() {
  return (await callable("bootstrapPrimaryAdmin")({})).data;
}

export async function createAdminAccount(email, password) {
  return (await callable("createAdmin")({ email, password })).data;
}

export async function listAdminAccounts() {
  return (await callable("listAdmins")({})).data;
}

export async function revokeAdminAccess(uid) {
  return (await callable("revokeAdmin")({ uid })).data;
}
