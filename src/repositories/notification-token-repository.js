/**
 * Firebase repository for device notification tokens.
 * Keeps the existing RTDB path and payload contract unchanged.
 */
export function createNotificationTokenRepository({ database, ref, set, dataPath }) {
  return {
    saveToken(tokenId, payload) {
      const tokenRef = ref(database, dataPath("notificationTokens", tokenId));
      return set(tokenRef, payload);
    }
  };
}
