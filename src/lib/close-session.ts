import {
  Firestore,
  runTransaction,
  doc,
  collection,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import type { Customer, Machine, Session, Sale, SoldProduct, PaymentMethod, StockMovement } from './types';
import { logAuditAction, logAuditFailure } from './audit-log';

export interface CloseSessionPayload {
  machineId: string;
  machine: Machine;
  session: Session;
  amount: number;
  paymentMethod: PaymentMethod;
  locationId?: string;
  operatorId?: string;
  operatorEmail?: string;
  operatorRole?: string;
  shiftId?: string;
  receiptNumber?: string;
  soldProducts: SoldProduct[];
}

export interface CloseSessionResult {
  saleId: string;
  receiptNumber: string;
  stockMovements: string[];
}

/**
 * Atomically closes a session with full transaction support.
 * This function ensures that:
 * 1. Sale document is created
 * 2. Inventory is updated for each sold product
 * 3. Stock movement audit logs are created
 * 4. Machine is marked as available
 * 5. All changes are committed atomically or all fail
 */
export async function closeSession(
  firestore: Firestore,
  payload: CloseSessionPayload,
): Promise<CloseSessionResult> {
  const {
    machineId,
    machine,
    session,
    amount,
    paymentMethod,
    locationId,
    operatorId,
    operatorEmail,
    operatorRole,
    shiftId,
    receiptNumber = 'MANUAL',
    soldProducts,
  } = payload;

  const endTime = Date.now();
  const totalMinutes = Math.ceil((endTime - session.startTime) / (1000 * 60));
  const visitDate = new Date(session.startTime);
  const weekdayKey = String(visitDate.getDay());
  const hourKey = String(visitDate.getHours());
  const totalProductsBought = soldProducts.reduce((sum, product) => sum + product.quantity, 0);

  // Build the Sale document
  const operator = {
    ...(operatorId ? { id: operatorId } : {}),
    ...(operatorEmail ? { email: operatorEmail } : {}),
  };

  const newSale: Omit<Sale, 'id'> = {
    machineName: machine.name,
    clientName: session.client || 'Ocasional',
    ...(session.clientId ? { customerId: session.clientId } : {}),
    ...(session.clientCode ? { customerCode: session.clientCode } : {}),
    ...(locationId ? { locationId } : {}),
    receiptNumber,
    ...(shiftId ? { shiftId } : {}),
    startTime: Timestamp.fromMillis(session.startTime),
    endTime: Timestamp.fromMillis(endTime),
    totalMinutes,
    amount,
    ...(typeof session.hourlyRate === 'number' ? { hourlyRate: session.hourlyRate } : {}),
    paymentMethod,
    soldProducts,
    ...(Object.keys(operator).length > 0 ? { operator } : {}),
  };

  try {
    const result = await runTransaction(firestore, async (transaction) => {
      // 1. Validate machine exists in this transaction
      const machineRef = doc(firestore, 'machines', machineId);
      const machineSnap = await transaction.get(machineRef);
      if (!machineSnap.exists()) {
        throw new Error(`Machine ${machineId} not found`);
      }

      // Read customer document before writes if this session is linked to a customer.
      let customerRef;
      let customerData: Customer | null = null;
      if (session.clientId) {
        customerRef = doc(firestore, 'customers', session.clientId);
        const customerSnap = await transaction.get(customerRef);
        if (!customerSnap.exists()) {
          throw new Error('The selected customer no longer exists.');
        }
        customerData = {
          ...(customerSnap.data() as Customer),
          id: customerSnap.id,
        };
      }

      // 2. Read all inventory docs before any write (Firestore requirement)
      const inventoryAdjustments: Array<{
        productId: string;
        productName: string;
        quantity: number;
        currentStock: number;
        newStock: number;
        inventoryDocId: string;
      }> = [];

      if (locationId && soldProducts.length > 0) {
        const inventoryCollection = collection(firestore, 'inventory');

        for (const product of soldProducts) {
          if (!product.productId) continue;

          const inventoryDocId = `${locationId}_${product.productId}`;
          const inventoryRef = doc(inventoryCollection, inventoryDocId);
          const inventorySnap = await transaction.get(inventoryRef);

          const currentStock = inventorySnap.exists()
            ? Number(inventorySnap.data().currentStock ?? 0)
            : 0;

          const newStock = Math.max(0, currentStock - product.quantity);

          inventoryAdjustments.push({
            productId: product.productId,
            productName: product.productName,
            quantity: product.quantity,
            currentStock,
            newStock,
            inventoryDocId,
          });
        }
      }

      // 3. Create sale and apply writes
      const salesCollection = collection(firestore, 'sales');
      const saleRef = doc(salesCollection);
      transaction.set(saleRef, newSale);

      const stockMovementIds: string[] = [];

      if (locationId && inventoryAdjustments.length > 0) {
        const inventoryCollection = collection(firestore, 'inventory');
        const stockMovementsCollection = collection(firestore, 'stockMovements');

        for (const adjustment of inventoryAdjustments) {
          const inventoryRef = doc(inventoryCollection, adjustment.inventoryDocId);

          // Update inventory
          transaction.set(
            inventoryRef,
            {
              locationId,
              productId: adjustment.productId,
              productName: adjustment.productName,
              currentStock: adjustment.newStock,
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          );

          // Create stock movement audit entry
          const stockMovementRef = doc(stockMovementsCollection);
          const stockMovement: Omit<StockMovement, 'id'> = {
            locationId,
            productId: adjustment.productId,
            productName: adjustment.productName,
            type: 'sale',
            quantity: adjustment.quantity,
            quantityBefore: adjustment.currentStock,
            quantityAfter: adjustment.newStock,
            reason: `Sale from ${machine.name}`,
            saleId: saleRef.id,
            shiftId: shiftId || undefined,
            approvedBy: {
              id: operatorId,
              email: operatorEmail,
            },
            createdAt: Timestamp.now(),
          };
          transaction.set(stockMovementRef, stockMovement);
          stockMovementIds.push(stockMovementRef.id);
        }
      }

      // 4. Clear machine session and mark as available
      transaction.update(machineRef, {
        status: 'available',
        session: null,
      });

      // 5. Update customer CRM metrics for this finished session
      if (session.clientId && customerRef && customerData) {
        const currentMetrics = customerData.metrics;
        const currentMachineUsage = currentMetrics?.machineUsage ?? {};
        const currentVisitsByWeekday = currentMetrics?.visitsByWeekday ?? {};
        const currentVisitHours = currentMetrics?.visitHours ?? {};

        transaction.set(customerRef, {
          metrics: {
            totalSessions: (currentMetrics?.totalSessions ?? 0) + 1,
            totalMinutesRented: (currentMetrics?.totalMinutesRented ?? 0) + totalMinutes,
            totalProductsBought: (currentMetrics?.totalProductsBought ?? 0) + totalProductsBought,
            totalSpent: (currentMetrics?.totalSpent ?? 0) + amount,
            machineUsage: {
              ...currentMachineUsage,
              [machine.name]: (currentMachineUsage[machine.name] ?? 0) + 1,
            },
            visitsByWeekday: {
              ...currentVisitsByWeekday,
              [weekdayKey]: (currentVisitsByWeekday[weekdayKey] ?? 0) + 1,
            },
            visitHours: {
              ...currentVisitHours,
              [hourKey]: (currentVisitHours[hourKey] ?? 0) + 1,
            },
            lastVisitAt: Timestamp.fromMillis(endTime),
          },
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }

      return {
        saleId: saleRef.id,
        receiptNumber: receiptNumber,
        stockMovements: stockMovementIds,
      };
    });

    // Log success
    await logAuditAction(firestore, {
      action: 'session.close',
      target: 'sales',
      targetId: result.saleId,
      locationId,
      actor: {
        id: operatorId,
        email: operatorEmail,
        role: operatorRole,
      },
      details: {
        machineId,
        machineName: machine.name,
        amount,
        paymentMethod,
        receiptNumber,
        shiftId: shiftId || null,
        productsCount: soldProducts.reduce((sum, p) => sum + p.quantity, 0),
      },
    });

    return result;
  } catch (error) {
    // Log failure
    await logAuditFailure(firestore, {
      action: 'session.close.error',
      target: 'sales',
      targetId: machineId,
      locationId,
      actor: {
        id: operatorId,
        email: operatorEmail,
        role: operatorRole,
      },
      error,
      details: {
        machineId,
        amount,
        paymentMethod,
        receiptNumber,
      },
    });

    throw error;
  }
}
