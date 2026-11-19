import test from "node:test";
import assert from "node:assert/strict";
import { getServiceInterval } from "../src/domain/service-rules.js";

test("Nasmoco uses 10,000 KM interval (case-insensitive)", () => {
  assert.deepEqual(getServiceInterval("Nasmoco"), {
    intervalKm: 10000,
    intervalRule: "Nasmoco = 10.000 KM"
  });
  assert.equal(getServiceInterval("NASMOCO Solo").intervalKm, 10000);
});

test("other workshops use 7,000 KM interval", () => {
  assert.deepEqual(getServiceInterval("Bengkel Umum"), {
    intervalKm: 7000,
    intervalRule: "Selain Nasmoco = 7.000 KM"
  });
});

test("empty or missing workshop safely falls back to 7,000 KM", () => {
  assert.equal(getServiceInterval("").intervalKm, 7000);
  assert.equal(getServiceInterval(null).intervalKm, 7000);
  assert.equal(getServiceInterval(undefined).intervalKm, 7000);
});
