const SHIFT_STORAGE_PREFIX = "cabine-grid.shift.start";

function getShiftStorageKey(uid: string): string {
  return `${SHIFT_STORAGE_PREFIX}.${uid}`;
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
