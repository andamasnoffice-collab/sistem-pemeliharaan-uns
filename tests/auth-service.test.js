import test from "node:test";
import assert from "node:assert/strict";
import { createAuthService } from "../src/services/auth-service.js";

test("auth service forwards admin sign-in credentials and auth instance", async () => {
  const calls = [];
  const auth = { name: "auth" };
  const service = createAuthService({
    auth,
    signInWithEmailAndPassword: (...args) => { calls.push(args); return "admin-session"; },
    signInAnonymously: () => null,
    signOut: () => null,
    sendPasswordResetEmail: () => null,
    updatePassword: () => null
  });
  assert.equal(await service.signInWithEmailAndPassword("admin@example.test", "secret"), "admin-session");
  assert.deepEqual(calls, [[auth, "admin@example.test", "secret"]]);
});

test("auth service forwards anonymous sign-in, sign-out and password reset", () => {
  const calls = [];
  const auth = { name: "auth" };
  const service = createAuthService({
    auth,
    signInWithEmailAndPassword: () => null,
    signInAnonymously: value => { calls.push(["anonymous", value]); return "guest"; },
    signOut: value => { calls.push(["signOut", value]); return "signed-out"; },
    sendPasswordResetEmail: (value, email) => { calls.push(["reset", value, email]); return "sent"; },
    updatePassword: (user, password) => { calls.push(["password", user, password]); return "updated"; }
  });
  assert.equal(service.signInAnonymously(), "guest");
  assert.equal(service.signOut(), "signed-out");
  assert.equal(service.sendPasswordResetEmail("user@example.test"), "sent");
  const user = { uid: "u1" };
  assert.equal(service.updatePassword(user, "new-password"), "updated");
  assert.deepEqual(calls, [
    ["anonymous", auth],
    ["signOut", auth],
    ["reset", auth, "user@example.test"],
    ["password", user, "new-password"]
  ]);
});
