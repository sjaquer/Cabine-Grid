'use client';
import {
  createContext,
  useContext,
  useEffect,
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
import { logAuditAction } from '@/lib/audit-log';

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

  const logout = async (payload?: {
    countedCash?: number;
    inventoryChecked?: boolean;
    discrepancyReason?: string;
  }) => {
    if (user && userProfile && (userProfile.role === 'operator' || userProfile.role === 'manager')) {
      const shiftStartMs = getShiftStart(user.uid) ?? Date.now();
      const shiftEndMs = Date.now();
      const shiftLocationId = getShiftLocation(user.uid);
      const shiftId = getShiftId(user.uid) ?? `${shiftLocationId || 'global'}_${user.uid}_${shiftStartMs}`;

      if (!payload || typeof payload.countedCash !== 'number' || payload.countedCash < 0) {
        throw new Error('Debes registrar el conteo de caja antes de cerrar turno.');
      }
      if (!payload.inventoryChecked) {
        throw new Error('Debes confirmar el conteo de inventario antes de cerrar turno.');
      }

      try {
        const salesRef = collection(firestore, 'sales');
        const salesQuery = query(
          salesRef,
          where('endTime', '>=', Timestamp.fromMillis(shiftStartMs)),
          where('endTime', '<=', Timestamp.fromMillis(shiftEndMs))
        );
        const salesSnap = await getDocs(salesQuery);
        const allShiftSales: Sale[] = salesSnap.docs.map((snapshot) => ({
          id: snapshot.id,
          ...(snapshot.data() as Omit<Sale, 'id'>),
        }));

        // Evita mezclar ventas entre operadores en el mismo lapso.
        const operatorShiftSales = allShiftSales.filter((sale) => {
          if (sale.operator?.id !== user.uid) return false;
          if (!shiftLocationId) return true;
          return sale.locationId === shiftLocationId;
        });

        const expectedCash = operatorShiftSales
          .filter((sale) => sale.paymentMethod === 'efectivo')
          .reduce((sum, sale) => sum + sale.amount, 0);
        const countedCash = Math.round(payload.countedCash * 100) / 100;
        const cashDifference = Math.round((countedCash - expectedCash) * 100) / 100;

        if (cashDifference !== 0 && !payload.discrepancyReason?.trim()) {
          throw new Error('Existe diferencia en caja. Debes ingresar un motivo para cerrar turno.');
        }

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

        await addDoc(collection(firestore, 'shiftClosures'), {
          shiftId,
          locationId: shiftLocationId || null,
          operator: {
            id: user.uid,
            email: user.email,
            role: userProfile.role,
          },
          shiftStart: Timestamp.fromMillis(shiftStartMs),
          shiftEnd: Timestamp.fromMillis(shiftEndMs),
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

        if (Math.abs(cashDifference) >= 20) {
          await addDoc(collection(firestore, 'fraudAlerts'), {
            type: 'cash-difference',
            severity: Math.abs(cashDifference) >= 100 ? 'high' : 'medium',
            locationId: shiftLocationId || null,
            shiftId,
            operator: {
              id: user.uid,
              email: user.email,
            },
            details: {
              expectedCash,
              countedCash,
              cashDifference,
              reason: payload.discrepancyReason?.trim() || null,
            },
            status: 'open',
            createdAt: serverTimestamp(),
          });
        }

        await logAuditAction(firestore, {
          action: 'shift.close',
          target: 'shiftClosures',
          targetId: shiftId,
          locationId: shiftLocationId || undefined,
          actor: { id: user.uid, email: user.email, role: userProfile.role },
          details: {
            expectedCash,
            countedCash,
            cashDifference,
            salesCount: operatorShiftSales.length,
          },
        });

        buildShiftReportPdf({
          userProfile,
          sales: operatorShiftSales,
          shiftStartMs,
          shiftEndMs,
          openMachines,
        });
      } catch (error) {
        console.error('Error generando cierre de turno:', error);
      }

      clearShiftLocation(user.uid);
      clearShiftStart(user.uid);
    }

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
