import test from "node:test";
import assert from "node:assert/strict";
import { createNotificationTokenRepository } from "../src/repositories/notification-token-repository.js";

test("notification token repository writes to existing RTDB node with unchanged payload", async () => {
  const calls = [];
  const database = { name: "rtdb" };
  const repository = createNotificationTokenRepository({
    database,
    ref: (db, path) => ({ db, path }),
    set: async (reference, payload) => { calls.push({ reference, payload }); return "saved"; },
    dataPath: (...parts) => "artifacts/uns-fleet-service/public/data_v2/" + parts.join("/")
  });
  const payload = {
    token: "fcm-token",
    uid: "user-1",
    app: "automan",
    platform: "android",
    deviceName: "Google Pixel 8",
    updatedAt: 123,
    enabled: true
  };
  assert.equal(await repository.saveToken("token-hash", payload), "saved");
  assert.deepEqual(calls, [{
    reference: {
      db: database,
      path: "artifacts/uns-fleet-service/public/data_v2/notificationTokens/token-hash"
    },
    payload
  }]);
});
