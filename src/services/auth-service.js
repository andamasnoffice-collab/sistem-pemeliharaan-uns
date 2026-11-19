/**
 * Thin Firebase Auth adapter. Keeping SDK calls behind this service makes
 * authentication operations independently testable without changing auth flow.
 */
export function createAuthService({
  auth,
  signInWithEmailAndPassword,
  signInAnonymously,
  signOut,
  sendPasswordResetEmail,
  updatePassword
}) {
  return {
    signInWithEmailAndPassword(email, password) {
      return signInWithEmailAndPassword(auth, email, password);
    },
    signInAnonymously() {
      return signInAnonymously(auth);
    },
    signOut() {
      return signOut(auth);
    },
    sendPasswordResetEmail(email) {
      return sendPasswordResetEmail(auth, email);
    },
    updatePassword(user, newPassword) {
      return updatePassword(user, newPassword);
    }
  };
}
