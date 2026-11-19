import { appId } from "./firebase";

/**
 * Central path builder for the existing RTDB schema.
 * This does not change the database project or node layout.
 */
export const DATA_ROOT = `artifacts/${appId}/public/data_v2`;

export function dataPath(...segments) {
  const clean = segments
    .map(segment => String(segment ?? "").trim().replace(/^\/+|\/+$/g, ""))
    .filter(Boolean);
  return clean.length ? `${DATA_ROOT}/${clean.join("/")}` : DATA_ROOT;
}
