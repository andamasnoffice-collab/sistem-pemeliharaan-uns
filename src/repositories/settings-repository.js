/**
 * Firebase RTDB repository for application and notification settings.
 * This preserves the legacy RTDB node names and payload structure.
 */
export function createSettingsRepository({ database, ref, update, dataPath }) {
  if (!database || typeof ref !== "function" || typeof update !== "function" ||
      typeof dataPath !== "function") {
    throw new TypeError("createSettingsRepository requires database and Firebase RTDB adapters");
  }

  return {
    updateSettings(settings) {
      return update(ref(database, dataPath("settings")), settings);
    },
    updateTelegramConfig(config) {
      return update(ref(database, dataPath("telegramConfig")), config);
    }
  };
}
