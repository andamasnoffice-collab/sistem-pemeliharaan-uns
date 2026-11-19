/**
 * Tracks Firebase unsubscribe callbacks without changing subscription semantics.
 * A failed subscription setup is not registered; cleanup is idempotent for callers.
 */
export function trackSubscription(subscriptions, subscribe, ...args) {
  const unsubscribe = subscribe(...args);
  if (typeof unsubscribe === "function") subscriptions.push(unsubscribe);
  return unsubscribe;
}

export function disposeSubscriptions(subscriptions, onError = () => {}) {
  if (!Array.isArray(subscriptions)) return;
  const pending = subscriptions.splice(0);
  for (const unsubscribe of pending) {
    if (typeof unsubscribe !== "function") continue;
    try {
      unsubscribe();
    } catch (error) {
      try { onError(error); } catch { /* Cleanup continues even if logging fails. */ }
    }
  }
}
