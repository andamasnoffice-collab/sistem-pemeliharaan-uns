/**
 * Firebase Realtime Database repository for fleet operational records.
 *
 * Dependencies are injected so the repository can be tested without connecting
 * to the production Firebase project. Keep database paths and payload contracts
 * compatible with the legacy application during the staged migration.
 */
export function createFleetRepository({ database, ref, update, remove, dataPath }) {
  if (!database || typeof ref !== "function" || typeof update !== "function" ||
      typeof remove !== "function" || typeof dataPath !== "function") {
    throw new TypeError("createFleetRepository requires database and Firebase RTDB adapters");
  }

  return {
    updateVehicleOperational(key, patch) {
      return update(ref(database, dataPath("vehicles", key)), patch);
    },
    updateVehicleVisibility(key, isHidden) {
      return update(ref(database, dataPath("vehicles", key)), { isHidden: Boolean(isHidden) });
    },
    updateVehicleMaster(key, patch) {
      return update(ref(database, dataPath("vehicles", key)), patch);
    },
    deleteVehicle(key) {
      return remove(ref(database, dataPath("vehicles", key)));
    },
    updateServiceLog(key, log) {
      return update(ref(database, dataPath("logs", key)), log);
    },
    deleteServiceLog(key) {
      return remove(ref(database, dataPath("logs", key)));
    }
  };
}
