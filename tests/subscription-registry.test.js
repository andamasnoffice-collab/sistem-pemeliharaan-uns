import test from "node:test";
import assert from "node:assert/strict";
import { trackSubscription, disposeSubscriptions } from "../src/services/subscription-registry.js";

test("trackSubscription registers and returns Firebase unsubscribe callback", () => {
  const subscriptions = [];
  const unsubscribe = () => {};
  const returned = trackSubscription(subscriptions, () => unsubscribe);
  assert.equal(returned, unsubscribe);
  assert.deepEqual(subscriptions, [unsubscribe]);
});

test("trackSubscription does not register non-function results", () => {
  const subscriptions = [];
  assert.equal(trackSubscription(subscriptions, () => undefined), undefined);
  assert.deepEqual(subscriptions, []);
});

test("disposeSubscriptions calls each callback once and clears registry", () => {
  const calls = [];
  const subscriptions = [() => calls.push("a"), () => calls.push("b")];
  disposeSubscriptions(subscriptions);
  disposeSubscriptions(subscriptions);
  assert.deepEqual(calls, ["a", "b"]);
  assert.deepEqual(subscriptions, []);
});

test("disposeSubscriptions continues after an unsubscribe throws", () => {
  const calls = [];
  const errors = [];
  const subscriptions = [
    () => { calls.push("first"); throw new Error("unsubscribe failed"); },
    () => calls.push("second")
  ];
  disposeSubscriptions(subscriptions, error => errors.push(error.message));
  assert.deepEqual(calls, ["first", "second"]);
  assert.deepEqual(errors, ["unsubscribe failed"]);
  assert.deepEqual(subscriptions, []);
});
