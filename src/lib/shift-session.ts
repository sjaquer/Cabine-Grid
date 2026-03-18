const SHIFT_STORAGE_PREFIX = "cabine-grid.shift.start";
const SHIFT_LOCATION_STORAGE_PREFIX = "cabine-grid.shift.location";

function getShiftStorageKey(uid: string): string {
  return `${SHIFT_STORAGE_PREFIX}.${uid}`;
}

function getShiftLocationStorageKey(uid: string): string {
  return `${SHIFT_LOCATION_STORAGE_PREFIX}.${uid}`;
}

export function getShiftStart(uid: string): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(getShiftStorageKey(uid));
  if (!raw) return null;

  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed <= 0) {
    window.localStorage.removeItem(getShiftStorageKey(uid));
    return null;
  }

  return parsed;
}

export function ensureShiftStart(uid: string): number {
  if (typeof window === "undefined") return Date.now();
  const existing = getShiftStart(uid);
  if (existing) return existing;

  const now = Date.now();
  window.localStorage.setItem(getShiftStorageKey(uid), String(now));
  return now;
}

export function clearShiftStart(uid: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(getShiftStorageKey(uid));
}

export function getShiftLocation(uid: string): string | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(getShiftLocationStorageKey(uid));
  if (!raw) return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function setShiftLocation(uid: string, locationId: string): void {
  if (typeof window === "undefined") return;
  const normalized = locationId.trim();
  if (!normalized) {
    window.localStorage.removeItem(getShiftLocationStorageKey(uid));
    return;
  }
  window.localStorage.setItem(getShiftLocationStorageKey(uid), normalized);
}

export function clearShiftLocation(uid: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(getShiftLocationStorageKey(uid));
}
