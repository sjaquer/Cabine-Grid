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
import type { Machine, Sale, UserProfile } from '@/lib/types';
import { useMemoFirebase } from '../provider';
import { useDoc } from '../firestore/use-doc';
import { buildShiftReportPdf } from '@/lib/shift-report';
import { clearShiftLocation, clearShiftStart, ensureShiftStart, getShiftId, getShiftLocation, getShiftStart } from '@/lib/shift-session';
import { logAuditAction, logAuditFailure } from '@/lib/audit-log';
import { getActiveShift, closeShift } from '@/lib/shift-management';

export interface AuthContextValue {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  logout: (payload?: {
    countedCash?: number;
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

  useEffect(() => {
    if (!user || !userProfile) return;
    if (userProfile.role === 'operator' || userProfile.role === 'manager') {
      ensureShiftStart(user.uid);
    }
  }, [user, userProfile]);

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
      if (!payload.inventoryChecked) {
        throw new Error('Debes confirmar el conteo de inventario antes de cerrar turno.');
      }

      try {
        // Get shift info from localStorage (for now, until we fully migrate)
        const shiftStartMs = getShiftStart(user.uid) ?? Date.now();
        const shiftLocationId = getShiftLocation(user.uid);
        const shiftId = getShiftId(user.uid) ?? `${shiftLocationId || 'global'}_${user.uid}_${shiftStartMs}`;

        // Get sales for this shift
        const salesRef = collection(firestore, 'sales');
        const salesQuery = query(
          salesRef,
          where('endTime', '>=', Timestamp.fromMillis(shiftStartMs)),
          where('endTime', '<=', Timestamp.fromMillis(Date.now()))
        );
        const salesSnap = await getDocs(salesQuery);
        const allShiftSales: Sale[] = salesSnap.docs.map((snapshot) => ({
          id: snapshot.id,
          ...(snapshot.data() as Omit<Sale, 'id'>),
        }));

        // Filter sales by operator and location
        const operatorShiftSales = allShiftSales.filter((sale) => {
          if (sale.operator?.id !== user.uid) return false;
          if (!shiftLocationId) return true;
          return sale.locationId === shiftLocationId;
        });

        // Calculate expected cash from cash payments
        const expectedCash = operatorShiftSales
          .filter((sale) => sale.paymentMethod === 'efectivo')
          .reduce((sum, sale) => sum + sale.amount, 0);
        const countedCash = Math.round(payload.countedCash * 100) / 100;
        const cashDifference = Math.round((countedCash - expectedCash) * 100) / 100;

        // Validate cash difference
        if (cashDifference !== 0 && !payload.discrepancyReason?.trim()) {
          throw new Error('Existe diferencia en caja. Debes ingresar un motivo para cerrar turno.');
        }

        // Get open machines
        const machinesRef = collection(firestore, 'machines');
        const machinesQuery = query(machinesRef, where('status', 'in', ['occupied', 'warning']));
        const machinesSnap = await getDocs(machinesQuery);
        const allOpenMachines: Machine[] = machinesSnap.docs.map((snapshot) => ({
          id: snapshot.id,
          ...(snapshot.data() as Omit<Machine, 'id'>),
        }));

        const openMachines = shiftLocationId
          ? allOpenMachines.filter((machine) => machine.locationId === shiftLocationId)
          : allOpenMachines;

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
          discrepancyReason: payload.discrepancyReason?.trim() || null,
          inventoryChecked: true,
          salesCount: operatorShiftSales.length,
          totalSales: operatorShiftSales.reduce((sum: number, sale) => sum + sale.amount, 0),
          status: 'closed',
          createdAt: serverTimestamp(),
        });

        // Log shift closure
        await logAuditAction(firestore, {
          action: 'shift.close',
          target: 'shiftClosures',
          targetId: shiftId,
          locationId: shiftLocationId || undefined,
          severity: Math.abs(cashDifference) >= 20 ? 'critical' : cashDifference !== 0 ? 'high' : 'medium',
          anomalyScore: Math.abs(cashDifference) >= 50 ? 90 : Math.abs(cashDifference) >= 20 ? 75 : cashDifference !== 0 ? 55 : 10,
          riskTags: cashDifference !== 0 ? ['cash-difference'] : [],
          actor: { id: user.uid, email: user.email, role: userProfile.role },
          details: {
            expectedCash,
            countedCash,
            cashDifference,
            salesCount: operatorShiftSales.length,
          },
        });

        // Log logout
        await logAuditAction(firestore, {
          action: 'auth.logout',
          target: 'users',
          targetId: user.uid,
          actor: { id: user.uid, email: user.email, role: userProfile.role },
          details: {
            shiftId,
            locationId: shiftLocationId || null,
          },
        });

        // Generate PDF report
        buildShiftReportPdf({
          userProfile,
          sales: operatorShiftSales,
          shiftStartMs,
          shiftEndMs: Date.now(),
          openMachines,
        });

        // Clear localStorage shift data
        clearShiftLocation(user.uid);
        clearShiftStart(user.uid);
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

  const value = { 
    user, 
    userProfile: userProfile as UserProfile | null, 
    loading: loading || isProfileLoading, 
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
