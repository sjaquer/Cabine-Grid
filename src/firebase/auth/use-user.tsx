'use client';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { addDoc, collection, doc, getDocs, query, Timestamp, where, serverTimestamp } from 'firebase/firestore';

import { useFirebaseAuthInstance, useFirestore } from '../provider';
import type { Station, Sale, UserProfile } from '@/lib/types';
import { useMemoFirebase } from '../provider';
import { useDoc } from '../firestore/use-doc';
import { buildShiftReportPdf } from '@/lib/shift-report';
import { clearShiftLocation, clearShiftStart, ensureShiftStart, getShiftLocation, getShiftStart, setShiftLocation } from '@/lib/shift-session';
import { logAuditAction, logAuditFailure } from '@/lib/audit-log';
import { aggregateShiftSales } from '@/lib/shift-aggregation';
import { createShift, closeShift as closeFirestoreShift, getActiveShiftsForOperator } from '@/lib/shift-management';

export interface AuthContextValue {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  getShiftClosurePreview: () => Promise<{
    shiftId: string;
    shiftStartMs: number;
    shiftLocationId?: string;
    salesCount: number;
    expectedCash: number;
    expectedYape: number;
    expectedOther: number;
    totalExpected: number;
    debtsGenerated: number;
    grossSales: number;
    theoreticalIncome: number;
    openMachinesCount: number;
  } | null>;
  logout: (payload?: {
    countedCash?: number;
    countedYape?: number;
    countedOther?: number;
    inventoryChecked?: boolean;
    discrepancyReason?: string;
  }) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useFirebaseAuthInstance();
  const firestore = useFirestore();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const loginAuditSentRef = useRef<string | null>(null);

  // Subscribe to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth]);

  // Create a memoized reference to the user's profile document
  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  
  // Use the useDoc hook to get the user profile in real-time
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  // Phase 2: Create Firestore shift on login (source of truth)
  const shiftCreatedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user || !userProfile || !firestore) return;
    if (!(userProfile.role === 'operator' || userProfile.role === 'manager')) return;
    if (shiftCreatedRef.current === user.uid) return;

    shiftCreatedRef.current = user.uid;

    // Keep localStorage for backward compat
    ensureShiftStart(user.uid);

    // Create Firestore shift (or reuse existing active one)
    const initShift = async () => {
      try {
        const locationId = getShiftLocation(user.uid) || userProfile.locationIds?.[0] || 'default';
        const existingShifts = await getActiveShiftsForOperator(firestore, user.uid);
        if (existingShifts.length === 0) {
          const newShiftId = await createShift(
            firestore,
            user.uid,
            user.email || '',
            locationId,
          );
          // Store the Firestore shift ID in localStorage as bridge
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(`cabine-grid.shift.firestoreId.${user.uid}`, newShiftId);
          }
        }
      } catch (e) {
        console.error('Failed to create Firestore shift:', e);
      }
    };
    void initShift();
  }, [user, userProfile, firestore]);

  useEffect(() => {
    if (!user || !userProfile || !firestore) return;
    if (loginAuditSentRef.current === user.uid) return;

    loginAuditSentRef.current = user.uid;
    void logAuditAction(firestore, {
      action: 'auth.login',
      target: 'users',
      targetId: user.uid,
      actor: { id: user.uid, email: user.email, role: userProfile.role },
      details: {
        role: userProfile.role,
      },
    });
  }, [user, userProfile, firestore]);

  const logout = async (payload?: {
    countedCash?: number;
    countedYape?: number;
    countedOther?: number;
    inventoryChecked?: boolean;
    discrepancyReason?: string;
  }) => {
    if (!user || !userProfile || !firestore) {
      await signOut(auth);
      return;
    }

    // Only require shift closure validation for operators and managers
    if (userProfile.role === 'operator' || userProfile.role === 'manager') {
      if (!payload || typeof payload.countedCash !== 'number' || payload.countedCash < 0) {
        throw new Error('Debes registrar el conteo de caja antes de cerrar turno.');
      }
      if (typeof payload.countedYape !== 'number' || payload.countedYape < 0) {
        throw new Error('Debes registrar el conteo de Yape antes de cerrar turno.');
      }
      if (typeof payload.countedOther !== 'number' || payload.countedOther < 0) {
        throw new Error('Debes registrar el conteo de otros medios antes de cerrar turno.');
      }
      if (!payload.inventoryChecked) {
        throw new Error('Debes confirmar el conteo de inventario antes de cerrar turno.');
      }

      try {
        const agg = await aggregateShiftSales(firestore, user.uid);
        const {
          shiftId, shiftStartMs, shiftLocationId,
          operatorShiftSales, expectedCash, expectedYape, expectedOther,
          debtsGenerated, grossSales, theoreticalIncome, openMachines,
        } = agg;

        const countedCash = Math.round(payload.countedCash * 100) / 100;
        const countedYape = Math.round(payload.countedYape * 100) / 100;
        const countedOther = Math.round(payload.countedOther * 100) / 100;

        const cashDifference = Math.round((countedCash - expectedCash) * 100) / 100;
        const yapeDifference = Math.round((countedYape - expectedYape) * 100) / 100;
        const otherDifference = Math.round((countedOther - expectedOther) * 100) / 100;
        const totalDifference = Math.round((cashDifference + yapeDifference + otherDifference) * 100) / 100;

        // Validate cash difference
        if ((cashDifference !== 0 || yapeDifference !== 0 || otherDifference !== 0) && !payload.discrepancyReason?.trim()) {
          throw new Error('Existe diferencia en caja. Debes ingresar un motivo para cerrar turno.');
        }

        // Create shift closure record
        await addDoc(collection(firestore, 'shiftClosures'), {
          shiftId,
          locationId: shiftLocationId || null,
          operator: {
            id: user.uid,
            email: user.email,
            role: userProfile.role,
          },
          shiftStart: Timestamp.fromMillis(shiftStartMs),
          shiftEnd: Timestamp.now(),
          expectedCash,
          countedCash,
          cashDifference,
          expectedYape,
          countedYape,
          yapeDifference,
          expectedOther,
          countedOther,
          otherDifference,
          debtsGenerated: Math.round(debtsGenerated * 100) / 100,
          grossSales: Math.round(grossSales * 100) / 100,
          theoreticalIncome,
          totalDifference,
          discrepancyReason: payload.discrepancyReason?.trim() || null,
          inventoryChecked: true,
          salesCount: operatorShiftSales.length,
          totalSales: Math.round(grossSales * 100) / 100,
          status: 'closed',
          createdAt: serverTimestamp(),
        });

        // Log shift closure
        await logAuditAction(firestore, {
          action: 'shift.close',
          target: 'shiftClosures',
          targetId: shiftId,
          locationId: shiftLocationId || undefined,
          severity: Math.abs(totalDifference) >= 20 ? 'critical' : totalDifference !== 0 ? 'high' : 'medium',
          anomalyScore: Math.abs(totalDifference) >= 50 ? 90 : Math.abs(totalDifference) >= 20 ? 75 : totalDifference !== 0 ? 55 : 10,
          riskTags: totalDifference !== 0 ? ['cash-difference'] : [],
          actor: { id: user.uid, email: user.email, role: userProfile.role },
          details: {
            expectedCash,
            countedCash,
            cashDifference,
            expectedYape,
            countedYape,
            yapeDifference,
            expectedOther,
            countedOther,
            otherDifference,
            debtsGenerated,
            grossSales,
            theoreticalIncome,
            totalDifference,
            salesCount: operatorShiftSales.length,
          },
        });

        // auth.logout audit log removed as redundant with shift.close

        // Generate PDF report
        buildShiftReportPdf({
          userProfile,
          sales: operatorShiftSales,
          shiftStartMs,
          shiftEndMs: Date.now(),
          openMachines,
        });

        // Phase 2: Close Firestore shift
        if (agg.firestoreShift?.id) {
          try {
            await closeFirestoreShift(firestore, agg.firestoreShift.id);
          } catch (e) {
            console.error('Failed to close Firestore shift:', e);
          }
        }

        // Clear localStorage shift data (kept for backward compat)
        clearShiftLocation(user.uid);
        clearShiftStart(user.uid);
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(`cabine-grid.shift.firestoreId.${user.uid}`);
        }
      } catch (error) {
        console.error('Error generando cierre de turno:', error);
        await logAuditFailure(firestore, {
          action: 'shift.close.error',
          target: 'shifts',
          targetId: user.uid,
          locationId: getShiftLocation(user.uid) || undefined,
          actor: { id: user.uid, email: user.email, role: userProfile.role },
          error,
        });
        throw error; // Re-throw so user sees the error
      }
    }

    // Sign out
    await signOut(auth);
  };

  const getShiftClosurePreview = async () => {
    if (!user || !userProfile || !firestore) return null;
    if (!(userProfile.role === 'operator' || userProfile.role === 'manager')) return null;

    const agg = await aggregateShiftSales(firestore, user.uid);

    return {
      shiftId: agg.shiftId,
      shiftStartMs: agg.shiftStartMs,
      shiftLocationId: agg.shiftLocationId,
      salesCount: agg.operatorShiftSales.length,
      expectedCash: agg.expectedCash,
      expectedYape: agg.expectedYape,
      expectedOther: agg.expectedOther,
      totalExpected: agg.totalExpected,
      debtsGenerated: agg.debtsGenerated,
      grossSales: agg.grossSales,
      theoreticalIncome: agg.theoreticalIncome,
      openMachinesCount: agg.openMachines.length,
    };
  };

  const value = { 
    user, 
    userProfile: userProfile as UserProfile | null, 
    loading: loading || isProfileLoading, 
    getShiftClosurePreview,
    logout 
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
