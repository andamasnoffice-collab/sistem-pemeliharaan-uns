import test from "node:test";
import assert from "node:assert/strict";
import { createRealtimeReferences } from "../src/repositories/realtime-references.js";

test("creates references for the unchanged shared RTDB nodes", () => {
  const database = { name: "shared-database" };
  const calls = [];
  const refs = createRealtimeReferences({
    database,
    ref: (db, path) => {
      calls.push({ db, path });
      return { db, path };
    },
    dataPath: (...parts) => ["artifacts/app/public/data_v2", ...parts].join("/")
  });

  assert.deepEqual(Object.keys(refs), [
    "vehicles", "drivers", "logs", "settings", "telegramConfig", "connected"
  ]);
  assert.deepEqual(calls.map(call => call.path), [
    "artifacts/app/public/data_v2/vehicles",
    "artifacts/app/public/data_v2/drivers",
    "artifacts/app/public/data_v2/logs",
    "artifacts/app/public/data_v2/settings",
    "artifacts/app/public/data_v2/telegramConfig",
    ".info/connected"
  ]);
  assert.ok(calls.every(call => call.db === database));
});

test("rejects incomplete Firebase adapters", () => {
  assert.throws(() => createRealtimeReferences({}), /requires database, ref, and dataPath/);
});
