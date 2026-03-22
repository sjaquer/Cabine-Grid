import {
  Firestore,
  runTransaction,
  doc,
  collection,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import type { Machine, Session, Sale, SoldProduct, PaymentMethod, StockMovement } from './types';
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

  // Build the Sale document
  const operator = {
    ...(operatorId ? { id: operatorId } : {}),
    ...(operatorEmail ? { email: operatorEmail } : {}),
  };

  const newSale: Omit<Sale, 'id'> = {
    machineName: machine.name,
    clientName: session.client || 'Ocasional',
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

      // 2. Create Sale document
      const salesCollection = collection(firestore, 'sales');
      const saleRef = doc(salesCollection);
      transaction.set(saleRef, newSale);

      const stockMovementIds: string[] = [];

      // 3. Update inventory and create stock movements for each product
      if (locationId && soldProducts.length > 0) {
        const inventoryCollection = collection(firestore, 'inventory');
        const stockMovementsCollection = collection(firestore, 'stockMovements');

        for (const product of soldProducts) {
          if (!product.productId) continue;

          // Get current inventory
          const inventoryDocId = `${locationId}_${product.productId}`;
          const inventoryRef = doc(inventoryCollection, inventoryDocId);
          const inventorySnap = await transaction.get(inventoryRef);

          const currentStock = inventorySnap.exists()
            ? Number(inventorySnap.data().currentStock ?? 0)
            : 0;

          const newStock = Math.max(0, currentStock - product.quantity);

          // Update inventory
          transaction.set(
            inventoryRef,
            {
              locationId,
              productId: product.productId,
              productName: product.productName,
              currentStock: newStock,
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          );

          // Create stock movement audit entry
          const stockMovementRef = doc(stockMovementsCollection);
          const stockMovement: Omit<StockMovement, 'id'> = {
            locationId,
            productId: product.productId,
            productName: product.productName,
            type: 'sale',
            quantity: product.quantity,
            quantityBefore: currentStock,
            quantityAfter: newStock,
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
