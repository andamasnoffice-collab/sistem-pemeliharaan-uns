import test from "node:test";
import assert from "node:assert/strict";
import { mapVehicleRecord, mapDriverRecord, mapServiceLogRecord } from "../src/domain/record-mappers.js";

test("vehicle mapper preserves fields and attaches Firebase key and normalized damage notes", () => {
  const mapped = mapVehicleRecord("fb-1", { plate: "AD 1234 X", damageNotes: "raw" }, value => `normalized:${value}`);
  assert.deepEqual(mapped, { plate: "AD 1234 X", id: "fb-1", _fbKey: "fb-1", damageNotes: "normalized:raw" });
});

test("vehicle mapper preserves explicit id and rejects invalid records", () => {
  assert.equal(mapVehicleRecord("fb-1", null), null);
  assert.equal(mapVehicleRecord("fb-1", [], x => x), null);
  assert.equal(mapVehicleRecord("fb-1", { id: "vehicle-9" }).id, "vehicle-9");
});

test("driver and service log mappers attach fallback ids and Firebase keys", () => {
  assert.deepEqual(mapDriverRecord("driver-1", { name: "Driver" }), { name: "Driver", id: "driver-1", _fbKey: "driver-1" });
  assert.deepEqual(mapServiceLogRecord("log-1", { date: "2026-11-19" }), { date: "2026-11-19", id: "log-1", _fbKey: "log-1" });
  assert.equal(mapDriverRecord("driver-1", "invalid"), null);
  assert.equal(mapServiceLogRecord("log-1", null), null);
});
