import test from "node:test";
import assert from "node:assert/strict";
import { createFleetRepository } from "../src/repositories/fleet-repository.js";

function createHarness() {
  const calls = [];
  const database = { name: "test-db" };
  const adapters = {
    ref(db, path) {
      assert.equal(db, database);
      return { db, path };
    },
    update(reference, payload) {
      calls.push({ operation: "update", path: reference.path, payload });
      return Promise.resolve();
    },
    remove(reference) {
      calls.push({ operation: "remove", path: reference.path });
      return Promise.resolve();
    },
    dataPath: (...segments) => ["root", ...segments].join("/")
  };
  return {
    calls,
    repository: createFleetRepository({ database, ...adapters })
  };
}

test("updates only the operational vehicle record at the existing RTDB path", async () => {
  const { calls, repository } = createHarness();
  const patch = { currentKm: 12345, isUnderService: true };
  await repository.updateVehicleOperational("vehicle-1", patch);
  assert.deepEqual(calls, [{
    operation: "update",
    path: "root/vehicles/vehicle-1",
    payload: patch
  }]);
});

test("deletes a vehicle at the existing RTDB path", async () => {
  const { calls, repository } = createHarness();
  await repository.deleteVehicle("vehicle-2");
  assert.deepEqual(calls, [{ operation: "remove", path: "root/vehicles/vehicle-2" }]);
});

test("updates a service log without changing its payload contract", async () => {
  const { calls, repository } = createHarness();
  const log = { id: "log-1", vehicleId: "vehicle-1", km: 12345 };
  await repository.updateServiceLog("log-1", log);
  assert.deepEqual(calls, [{
    operation: "update",
    path: "root/logs/log-1",
    payload: log
  }]);
});

test("deletes a service log at the existing RTDB path", async () => {
  const { calls, repository } = createHarness();
  await repository.deleteServiceLog("log-2");
  assert.deepEqual(calls, [{ operation: "remove", path: "root/logs/log-2" }]);
});

test("rejects incomplete Firebase adapters", () => {
  assert.throws(() => createFleetRepository({}), /requires database and Firebase RTDB adapters/);
});
