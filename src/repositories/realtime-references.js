/**
 * Creates references for the existing read/listener nodes.
 * Keep these node names stable: other applications share this RTDB schema.
 */
export function createRealtimeReferences({ database, ref, dataPath }) {
  if (!database || typeof ref !== "function" || typeof dataPath !== "function") {
    throw new Error("createRealtimeReferences requires database, ref, and dataPath");
  }

  return {
    vehicles: ref(database, dataPath("vehicles")),
    drivers: ref(database, dataPath("drivers")),
    logs: ref(database, dataPath("logs")),
    settings: ref(database, dataPath("settings")),
    telegramConfig: ref(database, dataPath("telegramConfig")),
    connected: ref(database, ".info/connected")
  };
}
