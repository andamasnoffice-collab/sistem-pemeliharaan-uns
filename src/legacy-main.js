import { createApp } from "vue";
import * as XLSX from "xlsx";
import { getServiceInterval } from "./domain/service-rules.js";
import { mapVehicleRecord, mapDriverRecord, mapServiceLogRecord } from "./domain/record-mappers.js";
import { trackSubscription, disposeSubscriptions } from "./services/subscription-registry.js";
import { dataPath } from "./services/paths.js";
import { createFleetRepository } from "./repositories/fleet-repository.js";
import { createSettingsRepository } from "./repositories/settings-repository.js";
import { appId, db, auth } from "./services/firebase";
import {
  signInWithEmailAndPassword,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updatePassword
} from "firebase/auth";
import { createAuthService } from "./services/auth-service.js";
import { createNotificationTokenRepository } from "./repositories/notification-token-repository.js";
import {
  ref,
  set,
  remove,
  onValue,
  onChildAdded,
  onChildChanged,
  onChildRemoved,
  update
} from "firebase/database";
