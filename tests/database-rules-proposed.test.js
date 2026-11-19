import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const rulesDocument = JSON.parse(
  await readFile(new URL("../database.rules.proposed.json", import.meta.url), "utf8")
);
const rules = rulesDocument.rules;
const adminUid = "cCEggFojkdNXlDneD3p3zHdreIg1";
const adminClaim = "auth.token.admin === true";

test("proposed RTDB Rules keep root access closed", () => {
  assert.equal(rules[".read"], false);
  assert.equal(rules[".write"], false);
});

test("privileged nodes accept custom-claim Admin and retain the legacy primary UID", () => {
  const nodes = rules.artifacts["uns-fleet-service"].public.data_v2;
  const privileged = ["drivers", "logs", "settings", "serviceAlertState", "notifications", "keyStats", "meta", "telegramConfig"];
  for (const nodeName of privileged) {
    const node = nodes[nodeName];
    const expressions = [node[".write"], node["$driverId"]?.[".write"], node["$logId"]?.[".write"], node["$stateId"]?.[".write"], node["$notificationId"]?.[".write"]].filter(Boolean);
    assert.ok(expressions.some(expression => expression.includes(adminClaim)), nodeName + " must accept admin claim");
    assert.ok(expressions.some(expression => expression.includes(adminUid)), nodeName + " must retain legacy primary UID");
  }
  assert.ok(nodes.settings[".read"].includes(adminClaim));
  assert.ok(nodes.keyStats[".read"].includes(adminClaim));
  assert.ok(nodes.meta[".read"].includes(adminClaim));
});

test("vehicle anonymous operational update restrictions remain unchanged", () => {
  const expression = rules.artifacts["uns-fleet-service"].public.data_v2.vehicles["$vehicleId"][".write"];
  for (const field of ["id", "plate", "model", "driver", "category", "lastServiceKm", "lastServiceDate", "currentKm"]) {
    assert.ok(expression.includes("child('" + field + "')"), "missing vehicle guard for " + field);
  }
  assert.ok(expression.includes("sign_in_provider === 'anonymous'"));
  assert.ok(expression.includes(adminClaim));
});

test("notification tokens remain restricted to their owning UID", () => {
  const token = rules.artifacts["uns-fleet-service"].public.data_v2.notificationTokens["$tokenId"];
  assert.equal(token[".write"], "auth != null && newData.child('uid').val() == auth.uid");
  assert.ok(token[".validate"].includes("token"));
  assert.ok(token[".validate"].includes("updatedAt"));
});

test("telegram config remains readable during the legacy client migration", () => {
  assert.equal(
    rules.artifacts["uns-fleet-service"].public.data_v2.telegramConfig[".read"],
    "auth != null"
  );
});
