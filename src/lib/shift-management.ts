import {
  Firestore,
  collection,
  doc,
  getDocs,
  query,
  where,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  QueryConstraint,
} from 'firebase/firestore';

export interface FirestoreShift {
  id?: string;
  operatorId: string;
  operatorEmail: string;
  locationId: string;
  startTime: Timestamp;
  endTime?: Timestamp | null;
  status: 'active' | 'closed';
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

/**
 * Creates a new shift for an operator at a specific location.
 * Returns the shift ID.
 */
export async function createShift(
  firestore: Firestore,
  operatorId: string,
  operatorEmail: string,
  locationId: string,
): Promise<string> {
  const shiftsCollection = collection(firestore, 'shifts');
  
  // Use operator ID + timestamp as unique identifier
  const shiftId = `${locationId}_${operatorId}_${Date.now()}`;
  const shiftRef = doc(shiftsCollection, shiftId);

  await setDoc(shiftRef, {
    operatorId,
    operatorEmail,
    locationId,
    startTime: serverTimestamp() as any,
    endTime: null,
    status: 'active',
    createdAt: serverTimestamp() as any,
    updatedAt: serverTimestamp() as any,
  });

  return shiftId;
}

/**
 * Gets the active shift for an operator at a specific location.
 * Returns null if no active shift exists.
 */
export async function getActiveShift(
  firestore: Firestore,
  operatorId: string,
  locationId: string,
): Promise<FirestoreShift | null> {
  const shiftsCollection = collection(firestore, 'shifts');
  const shiftsQuery = query(
    shiftsCollection,
    where('operatorId', '==', operatorId),
    where('locationId', '==', locationId),
    where('status', '==', 'active'),
  );

  const snapshot = await getDocs(shiftsQuery);
  
  if (snapshot.empty) {
    return null;
  }

  // Return the most recent active shift
  const shifts = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  } as FirestoreShift));

  return shifts.sort((a, b) => {
    const aTime = (a.startTime as Timestamp).toMillis();
    const bTime = (b.startTime as Timestamp).toMillis();
    return bTime - aTime;
  })[0] || null;
}

/**
 * Gets a shift by ID.
 */
export async function getShiftById(
  firestore: Firestore,
  shiftId: string,
): Promise<FirestoreShift | null> {
  const shiftRef = doc(firestore, 'shifts', shiftId);
  const snapshot = await getDoc(shiftRef);
  
  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  } as FirestoreShift;
}

/**
 * Closes an active shift.
 */
export async function closeShift(
  firestore: Firestore,
  shiftId: string,
): Promise<void> {
  const shiftRef = doc(firestore, 'shifts', shiftId);
  
  await updateDoc(shiftRef, {
    endTime: serverTimestamp() as any,
    status: 'closed',
    updatedAt: serverTimestamp() as any,
  });
}

/**
 * Gets all active shifts for an operator.
 */
export async function getActiveShiftsForOperator(
  firestore: Firestore,
  operatorId: string,
): Promise<FirestoreShift[]> {
  const shiftsCollection = collection(firestore, 'shifts');
  const shiftsQuery = query(
    shiftsCollection,
    where('operatorId', '==', operatorId),
    where('status', '==', 'active'),
  );

  const snapshot = await getDocs(shiftsQuery);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  } as FirestoreShift));
}

/**
 * Checks if there's an active shift for the operator in a different location.
 * Useful for preventing multiple simultaneous shifts across different locations.
 */
export async function hasOtherActiveShift(
  firestore: Firestore,
  operatorId: string,
  currentLocationId: string,
): Promise<FirestoreShift | null> {
  const shifts = await getActiveShiftsForOperator(firestore, operatorId);
  
  const otherShift = shifts.find(s => s.locationId !== currentLocationId);
  return otherShift || null;
}
