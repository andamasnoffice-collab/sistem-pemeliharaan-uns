/**
 * Pure Firebase record mappers. Keep RTDB keys as _fbKey so incremental
 * child listeners can update/remove one record without re-reading collections.
 */
export function mapVehicleRecord(key, value, normalizeDamageNotes = notes => notes) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return {
    ...value,
    id: value.id || key,
    _fbKey: key,
    damageNotes: normalizeDamageNotes(value.damageNotes)
  };
}

export function mapDriverRecord(key, value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return { ...value, id: value.id || key, _fbKey: key };
}

export function mapServiceLogRecord(key, value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return { ...value, id: value.id || key, _fbKey: key };
}
