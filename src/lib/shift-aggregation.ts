import {
  Firestore,
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import type { Sale, Station } from '@/lib/types';
import { getActiveShift, type FirestoreShift } from '@/lib/shift-management';

/**
 * Shared shift sales aggregation logic.
 * Used by both getShiftClosurePreview() and logout() to eliminate code duplication.
 * 
 * Phase 2: Now reads shift data from Firestore (shifts collection) as primary source of truth,
 * falling back to localStorage only for backward compatibility.
 */

export interface ShiftSalesAggregation {
  shiftId: string;
  shiftStartMs: number;
  shiftLocationId: string | undefined;
  operatorShiftSales: Sale[];
  paidShiftSales: Sale[];
  expectedCash: number;
  expectedYape: number;
  expectedOther: number;
  totalExpected: number;
  debtsGenerated: number;
  grossSales: number;
  theoreticalIncome: number;
  openMachines: Station[];
  /** The Firestore shift document, if found */
  firestoreShift: FirestoreShift | null;
}

/**
 * Fetches and aggregates all shift data for a given operator.
 * This is the single source of truth for shift calculation logic.
 * 
 * Priority order for shift data:
 * 1. Firestore `shifts` collection (Phase 2 source of truth)
 * 2. localStorage fallback (backward compatibility)
 */
export async function aggregateShiftSales(
  firestore: Firestore,
  operatorUid: string,
  locationIdHint?: string,
): Promise<ShiftSalesAggregation> {
  // Phase 2: Try Firestore shifts collection first
  let firestoreShift: FirestoreShift | null = null;
  let shiftStartMs: number;
  let shiftLocationId: string | undefined;
  let shiftId: string;

  // Try to find active shift in Firestore
  const effectiveLocationId = locationIdHint || getLocalStorageShiftLocation(operatorUid);
  
  if (effectiveLocationId) {
    firestoreShift = await getActiveShift(firestore, operatorUid, effectiveLocationId);
  }

  if (!firestoreShift) {
    // Try without location filter — get any active shift for this operator
    const shiftsRef = collection(firestore, 'shifts');
    const q = query(
      shiftsRef,
      where('operatorId', '==', operatorUid),
      where('status', '==', 'active'),
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const doc = snap.docs[0];
      firestoreShift = { id: doc.id, ...doc.data() } as FirestoreShift;
    }
  }

  if (firestoreShift) {
    // Use Firestore shift as source of truth
    shiftId = firestoreShift.id || `${firestoreShift.locationId}_${operatorUid}_unknown`;
    shiftStartMs = firestoreShift.startTime instanceof Timestamp
      ? firestoreShift.startTime.toMillis()
      : Date.now();
    shiftLocationId = firestoreShift.locationId || undefined;
  } else {
    // Fallback to localStorage for backward compatibility
    const { getShiftStart, getShiftLocation, getShiftId } = await import('@/lib/shift-session');
    shiftStartMs = getShiftStart(operatorUid) ?? Date.now();
    shiftLocationId = getShiftLocation(operatorUid) || undefined;
    shiftId = getShiftId(operatorUid) ?? `${shiftLocationId || 'global'}_${operatorUid}_${shiftStartMs}`;
  }

  // Fetch sales within shift time range
  const salesRef = collection(firestore, 'sales');
  const salesQuery = query(
    salesRef,
    where('endTime', '>=', Timestamp.fromMillis(shiftStartMs)),
    where('endTime', '<=', Timestamp.fromMillis(Date.now())),
  );
  const salesSnap = await getDocs(salesQuery);
  const allShiftSales: Sale[] = salesSnap.docs.map((snapshot) => ({
    id: snapshot.id,
    ...(snapshot.data() as Omit<Sale, 'id'>),
  }));

  // Filter by operator and location
  const operatorShiftSales = allShiftSales.filter((sale) => {
    if (sale.operator?.id !== operatorUid) return false;
    if (!shiftLocationId) return true;
    return sale.locationId === shiftLocationId;
  });

  const paidShiftSales = operatorShiftSales.filter(
    (sale) => !sale.isUnpaid && sale.paymentMethod !== 'deuda'
  );

  // Aggregate by payment method
  const expectedCash = paidShiftSales
    .filter((sale) => sale.paymentMethod === 'efectivo')
    .reduce((sum, sale) => sum + sale.amount, 0);
  const expectedYape = paidShiftSales
    .filter((sale) => sale.paymentMethod === 'yape')
    .reduce((sum, sale) => sum + sale.amount, 0);
  const expectedOther = paidShiftSales
    .filter((sale) => sale.paymentMethod === 'otro')
    .reduce((sum, sale) => sum + sale.amount, 0);
  const debtsGenerated = operatorShiftSales
    .filter((sale) => sale.isUnpaid || sale.paymentMethod === 'deuda')
    .reduce((sum, sale) => sum + sale.amount, 0);
  const grossSales = operatorShiftSales.reduce((sum, sale) => sum + sale.amount, 0);
  const theoreticalIncome = Math.round((grossSales - debtsGenerated) * 100) / 100;
  const totalExpected = Math.round((expectedCash + expectedYape + expectedOther) * 100) / 100;

  // Fetch open machines
  const machinesRef = collection(firestore, 'stations');
  const machinesQuery = query(machinesRef, where('status', 'in', ['occupied', 'warning']));
  const machinesSnap = await getDocs(machinesQuery);
  const allOpenMachines: Station[] = machinesSnap.docs.map((snapshot) => ({
    id: snapshot.id,
    ...(snapshot.data() as Omit<Station, 'id'>),
  }));

  const openMachines = shiftLocationId
    ? allOpenMachines.filter((machine) => machine.locationId === shiftLocationId)
    : allOpenMachines;

  return {
    shiftId,
    shiftStartMs,
    shiftLocationId,
    operatorShiftSales,
    paidShiftSales,
    expectedCash: Math.round(expectedCash * 100) / 100,
    expectedYape: Math.round(expectedYape * 100) / 100,
    expectedOther: Math.round(expectedOther * 100) / 100,
    totalExpected,
    debtsGenerated: Math.round(debtsGenerated * 100) / 100,
    grossSales: Math.round(grossSales * 100) / 100,
    theoreticalIncome,
    openMachines,
    firestoreShift,
  };
}

// Helper to read localStorage without importing the full module at top level
function getLocalStorageShiftLocation(uid: string): string | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(`cabine-grid.shift.location.${uid}`);
  return raw?.trim() || null;
}
