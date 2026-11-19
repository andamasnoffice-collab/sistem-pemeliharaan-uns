import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  initializeAuth,
  inMemoryPersistence,
  type Auth
} from "firebase/auth";
import { getDatabase, type Database } from "firebase/database";

export const appId = "uns-fleet-service";

export const rawFirebaseConfig = {
  apiKey: "AIzaSyAi0Ucng_tl7jSC9gZtr0JItCBUtkt-vvU",
  authDomain: "uns-fleet-service.firebaseapp.com",
  databaseURL: "https://uns-fleet-service-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "uns-fleet-service",
  storageBucket: "uns-fleet-service.firebasestorage.app",
  messagingSenderId: "881806830475",
  appId: "1:881806830475:web:8dcf991ec95ae93b625d8e",
  measurementId: "G-REWR64QLNH"
};

export let app: FirebaseApp | undefined;
export let db: Database | undefined;
export let auth: Auth | undefined;

try {
  app = initializeApp(rawFirebaseConfig);
  db = getDatabase(app);
  auth = initializeAuth(app, { persistence: inMemoryPersistence });
} catch (error) {
  console.error("Firebase bootstrap error:", error);
}
