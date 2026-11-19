import test from "node:test";
import assert from "node:assert/strict";
import { createSettingsRepository } from "../src/repositories/settings-repository.js";

function harness() {
  const calls = [];
  const database = {};
  const repository = createSettingsRepository({
    database,
    ref: (db, path) => ({ db, path }),
    update: (reference, payload) => {
      calls.push({ path: reference.path, payload });
      return Promise.resolve();
    },
    dataPath: (...parts) => ["root", ...parts].join("/")
  });
  return { calls, repository };
}

test("writes application settings to the existing settings node", async () => {
  const { calls, repository } = harness();
  const settings = { waNumber: "628000000000", autoSyncSheets: true };
  await repository.updateSettings(settings);
  assert.deepEqual(calls, [{ path: "root/settings", payload: settings }]);
});

test("writes Telegram settings to the existing telegramConfig node", async () => {
  const { calls, repository } = harness();
  const config = { botToken: "test-token", chatId: "test-chat", enabled: true };
  await repository.updateTelegramConfig(config);
  assert.deepEqual(calls, [{ path: "root/telegramConfig", payload: config }]);
});

test("rejects incomplete Firebase adapters", () => {
  assert.throws(() => createSettingsRepository({}), /requires database and Firebase RTDB adapters/);
});
