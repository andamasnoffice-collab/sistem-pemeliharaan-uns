import test, { after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds
} from "@firebase/rules-unit-testing";
import { ref, set, get, update, remove } from "firebase/database";

const projectId = "demo-uns-fleet-service";
const primaryUid = "cCEggFojkdNXlDneD3p3zHdreIg1";
const root = "artifacts/uns-fleet-service/public/data_v2";
const sharedDataPath = "artifacts/uns-fleet-service/public/data";
const rules = await readFile(new URL("../database.rules.proposed.json", import.meta.url), "utf8");

const env = await initializeTestEnvironment({
  projectId,
  database: {
    host: "127.0.0.1",
    port: 9000,
    rules
  }
});

after(async () => {
  await env.cleanup();
});

const unauth = env.unauthenticatedContext().database();
const anonymous = env.authenticatedContext("anonymous-session", {
  firebase: { sign_in_provider: "anonymous" }
}).database();
const primary = env.authenticatedContext(primaryUid, {
  email_verified: true
}).database();
const unverifiedPrimary = env.authenticatedContext(primaryUid, {
  email_verified: false
}).database();
const additionalAdmin = env.authenticatedContext("additional-admin", {
  admin: true,
  email_verified: true
}).database();
const unverifiedAdmin = env.authenticatedContext("unverified-admin", {
  admin: true,
  email_verified: false
}).database();
const ordinary = env.authenticatedContext("ordinary-user", {
  email_verified: true
}).database();
const revokedAdmin = env.authenticatedContext("revoked-admin", {
  email_verified: true
}).database();
const otherUser = env.authenticatedContext("other-user", {
  email_verified: true
}).database();

await env.withSecurityRulesDisabled(async (context) => {
  const db = context.database();
  await set(ref(db, root + "/vehicles/vehicle-1"), {
    id: "vehicle-1",
    plate: "AD 1234 AB",
    model: "Toyota Innova",
    driver: "Driver A",
    category: "Operasional",
    lastServiceKm: 10000,
    lastServiceDate: "2026-01-01",
    currentKm: 25000,
    isUnderService: false,
    isHidden: false
  });
  await set(ref(db, root + "/telegramConfig"), {
    botToken: "emulator-dummy-token",
    chatId: "emulator-dummy-chat"
  });
});

test("unauthenticated sessions cannot read protected vehicle data; Anonymous Auth can read", async () => {
  await assertFails(get(ref(unauth, root + "/vehicles")));
  await assertSucceeds(get(ref(anonymous, root + "/vehicles/vehicle-1")));
});

test("primary UID retains verified legacy Admin access without requiring a custom claim", async () => {
  await assertSucceeds(get(ref(primary, root + "/settings")));
  await assertSucceeds(set(ref(primary, root + "/drivers/primary-driver"), {
    name: "Primary Admin"
  }));
});

test("verified additional Admin custom claim can read and write privileged nodes", async () => {
  await assertSucceeds(get(ref(additionalAdmin, root + "/settings")));
  await assertSucceeds(set(ref(additionalAdmin, root + "/drivers/additional-driver"), {
    name: "Additional Admin"
  }));
  await assertSucceeds(set(ref(additionalAdmin, root + "/logs/admin-log"), {
    id: "admin-log",
    date: "2026-11-19"
  }));
  await assertSucceeds(set(ref(additionalAdmin, root + "/notifications/admin-notification"), {
    message: "test"
  }));
  await assertSucceeds(set(ref(additionalAdmin, root + "/serviceAlertState/admin-state"), {
    state: "test"
  }));
  await assertSucceeds(set(ref(additionalAdmin, root + "/keyStats/test"), {
    count: 1
  }));
  await assertSucceeds(set(ref(additionalAdmin, root + "/meta/test"), {
    version: 1
  }));
  await assertSucceeds(set(ref(additionalAdmin, sharedDataPath + "/test"), {
    value: "admin"
  }));
});

test("ordinary and revoked Admin sessions cannot read settings or write privileged nodes", async () => {
  for (const [index, db] of [ordinary, revokedAdmin, anonymous].entries()) {
    await assertFails(get(ref(db, root + "/settings")));
    await assertFails(set(ref(db, root + "/drivers/denied-" + index), {
      name: "Denied"
    }));
  }
  await assertFails(set(ref(ordinary, sharedDataPath + "/ordinary"), { value: "denied" }));
});

test("unverified primary and unverified custom-claim Admin are denied privileged access", async () => {
  await assertFails(get(ref(unverifiedPrimary, root + "/settings")));
  await assertFails(set(ref(unverifiedPrimary, root + "/drivers/unverified-primary"), {
    name: "Denied"
  }));
  await assertFails(get(ref(unverifiedAdmin, root + "/settings")));
  await assertFails(set(ref(unverifiedAdmin, root + "/drivers/unverified-admin"), {
    name: "Denied"
  }));
});

test("Anonymous Auth can increase the existing odometer without changing master or visibility fields", async () => {
  await assertSucceeds(update(ref(anonymous, root + "/vehicles/vehicle-1"), {
    currentKm: 25100
  }));
  await assertFails(update(ref(anonymous, root + "/vehicles/vehicle-1"), {
    plate: "AD 9999 ZZ"
  }));
  await assertFails(update(ref(anonymous, root + "/vehicles/vehicle-1"), {
    isHidden: true
  }));
  await assertFails(update(ref(anonymous, root + "/vehicles/vehicle-1"), {
    currentKm: 24000
  }));
  await assertFails(set(ref(anonymous, root + "/vehicles/new-vehicle"), {
    id: "new-vehicle",
    plate: "AD 5555 ZZ",
    currentKm: 1
  }));
});

test("Anonymous Auth retains the operational vehicle fields currently written by the app", async () => {
  await assertSucceeds(update(ref(anonymous, root + "/vehicles/vehicle-1"), {
    isUnderService: true,
    targetWorkshop: "Nasmoco",
    inServiceDate: "2026-11-19",
    inServiceNotes: "Pemeriksaan berkala",
    damageNotes: [{ id: "note-1", text: "Bumper" }]
  }));
});

test("verified Admin can update vehicle master data; unverified Admin cannot", async () => {
  await assertSucceeds(update(ref(additionalAdmin, root + "/vehicles/vehicle-1"), {
    plate: "AD 2222 XY"
  }));
  await assertFails(update(ref(unverifiedAdmin, root + "/vehicles/vehicle-1"), {
    plate: "AD 3333 XY"
  }));
});

test("notification token writes are owner-bound and deletes remain denied by the supplied policy", async () => {
  const tokenPath = root + "/notificationTokens/token-owner";
  const token = {
    token: "emulator-fcm-token",
    uid: "ordinary-user",
    app: "automan",
    platform: "android",
    updatedAt: 1795080000000
  };
  await assertSucceeds(set(ref(ordinary, tokenPath), token));
  await assertFails(set(ref(otherUser, root + "/notificationTokens/token-other"), {
    ...token,
    uid: "ordinary-user"
  }));
  await assertFails(remove(ref(ordinary, tokenPath)));
});

test("telegramConfig remains readable to authenticated Anonymous sessions pending backend migration", async () => {
  await assertSucceeds(get(ref(anonymous, root + "/telegramConfig")));
  await assertFails(get(ref(unauth, root + "/telegramConfig")));
});
