import {
  Firestore,
  runTransaction,
  doc,
  collection,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import type { Customer, Station, Session, Sale, SoldProduct, PaymentMethod, StockMovement } from './types';
import { logAuditAction, logAuditFailure } from './audit-log';
import { logInventoryMovement } from './services/inventory-log';

export interface CloseSessionPayload {
  stationId: string;
  station: Station;
  session: Session;
  amount: number;
  paymentMethod: PaymentMethod;
  markAsUnpaid?: boolean;
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
 */
export async function closeSession(
  firestore: Firestore,
  payload: CloseSessionPayload,
): Promise<CloseSessionResult> {
  const {
    stationId,
    station,
    session,
    amount,
    paymentMethod,
    markAsUnpaid = false,
    locationId,
    operatorId,
    operatorEmail,
    operatorRole,
    shiftId,
    receiptNumber = 'MANUAL',
    soldProducts,
  } = payload;

  const endTime = Date.now();
  const isUnpaid = markAsUnpaid || paymentMethod === 'deuda';
  const effectivePaymentMethod: PaymentMethod = isUnpaid ? 'deuda' : paymentMethod;
  const totalMinutes = Math.ceil((endTime - session.startTime) / (1000 * 60));
  const visitDate = new Date(session.startTime);
  const weekdayKey = String(visitDate.getDay());
  const hourKey = String(visitDate.getHours());
  const totalProductsBought = soldProducts.reduce((sum, product) => sum + product.quantity, 0);
  const discountAmount = Math.max(0, Math.round((session.discount?.amount ?? 0) * 100) / 100);
  const grossAmount = Math.round((amount + discountAmount) * 100) / 100;
  const netAmount = Math.round(amount * 100) / 100;
  const discountReason = session.discount?.reason?.trim() || undefined;

  // Build the Sale document
  const operator = {
    ...(operatorId ? { id: operatorId } : {}),
    ...(operatorEmail ? { email: operatorEmail } : {}),
  };

  const newSale: Omit<Sale, 'id'> = {
    machineName: station.name, // keeping machineName in Sale interface for db compatibility
    clientName: session.client || 'Ocasional',
    ...(session.clientId ? { customerId: session.clientId } : {}),
    ...(session.clientCode ? { customerCode: session.clientCode } : {}),
    ...(locationId ? { locationId } : {}),
    receiptNumber,
    ...(shiftId ? { shiftId } : {}),
    startTime: Timestamp.fromMillis(session.startTime),
    endTime: Timestamp.fromMillis(endTime),
    totalMinutes,
    grossAmount,
    discountAmount,
    ...(discountReason ? { discountReason } : {}),
    netAmount,
    amount,
    ...(typeof session.hourlyRate === 'number' ? { hourlyRate: session.hourlyRate } : {}),
    paymentMethod: effectivePaymentMethod,
    isUnpaid,
    extraMinutes: session.extraMinutes ?? 0,
    appliedCards: session.appliedCards ?? [],
    soldProducts,
    ...(Object.keys(operator).length > 0 ? { operator } : {}),
  };

  const inventoryAdjustments: Array<{
    productId: string;
    productName: string;
    quantity: number;
    currentStock: number;
    newStock: number;
    inventoryDocId: string;
  }> = [];

  try {
    const result = await runTransaction(firestore, async (transaction) => {
      // 1. Validate station exists in this transaction
      const stationRef = doc(firestore, 'stations', stationId);
      const stationSnap = await transaction.get(stationRef);
      if (!stationSnap.exists()) {
        throw new Error(`Station ${stationId} not found`);
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

      if (isUnpaid && !session.clientId) {
        throw new Error('No se puede registrar deuda sin cliente asociado.');
      }

      // 2. Read all inventory docs before any write


      if (locationId && soldProducts.length > 0) {
        const inventoryCollection = collection(firestore, 'inventory');

        for (const product of soldProducts) {
          if (!product.productId) continue;

          const inventoryDocId = `${locationId}_${product.productId}`;
          const inventoryRef = doc(inventoryCollection, inventoryDocId);
          const inventorySnap = await transaction.get(inventoryRef);

          let currentStock = 0;
          if (inventorySnap.exists()) {
            currentStock = Number(inventorySnap.data().currentStock ?? 0);
          } else {
            const productRef = doc(firestore, 'products', product.productId);
            const productSnap = await transaction.get(productRef);
            if (productSnap.exists()) {
              currentStock = Number(productSnap.data().stock ?? 0);
            }
          }

          const newStock = currentStock - product.quantity;
          if (newStock < 0) {
            throw new Error(`Stock insuficiente para ${product.productName}. Disponible: ${currentStock}, Solicitado: ${product.quantity}`);
          }

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
            reason: `Sale from Station ${station.name}`,
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

      // 4. Clear station session and mark as available
      transaction.update(stationRef, {
        status: 'available',
        session: null,
      });

      // 5. Update customer CRM metrics for this finished session
      if (session.clientId && customerRef && customerData) {
        const currentMetrics = customerData.metrics;
        const currentMachineUsage = currentMetrics?.machineUsage ?? {};
        const currentVisitsByWeekday = currentMetrics?.visitsByWeekday ?? {};
        const currentVisitHours = currentMetrics?.visitHours ?? {};

        const currentDebt = Number(customerData.debt ?? 0);

        transaction.set(customerRef, {
          metrics: {
            totalSessions: (currentMetrics?.totalSessions ?? 0) + 1,
            totalMinutesRented: (currentMetrics?.totalMinutesRented ?? 0) + totalMinutes,
            totalProductsBought: (currentMetrics?.totalProductsBought ?? 0) + totalProductsBought,
            totalSpent: (currentMetrics?.totalSpent ?? 0) + (isUnpaid ? 0 : amount),
            machineUsage: {
              ...currentMachineUsage,
              [station.name]: (currentMachineUsage[station.name] ?? 0) + 1,
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
          ...(isUnpaid ? { debt: Math.round((currentDebt + amount) * 100) / 100 } : {}),
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }

      return {
        saleId: saleRef.id,
        receiptNumber: receiptNumber,
        stockMovements: stockMovementIds,
      };
    });

    // Fase 4: Registro de Kardex de Movimientos para Ventas POS
    if (locationId && inventoryAdjustments.length > 0) {
      for (const adjustment of inventoryAdjustments) {
        await logInventoryMovement(firestore, {
          locationId,
          locationName: `Local ${locationId}`,
          productId: adjustment.productId,
          productName: adjustment.productName,
          type: 'sale',
          quantity: adjustment.quantity,
          previousStock: adjustment.currentStock,
          currentStock: adjustment.newStock,
          note: `Venta automática en POS (Estación: ${station.name})`,
          operator: {
            id: operatorId || null,
            email: operatorEmail || null,
            role: operatorRole || null,
          },
          source: 'pos',
        });
      }
    }

    await logAuditAction(firestore, {
      action: 'session.close',
      target: 'stations',
      targetId: stationId,
      locationId,
      actor: { id: operatorId, email: operatorEmail, role: operatorRole },
      details: {
        stationName: station.name,
        amount,
        grossAmount,
        discountAmount,
        discountReason: discountReason ?? null,
        paymentMethod: effectivePaymentMethod,
        isUnpaid,
        receiptNumber: result.receiptNumber,
        productsCount: soldProducts.length,
      },
    });

    if (isUnpaid) {
      await logAuditAction(firestore, {
        action: 'session.debt.close',
        target: 'customers',
        targetId: session.clientId,
        locationId,
        severity: 'high',
        actor: { id: operatorId, email: operatorEmail, role: operatorRole },
        details: {
          message: `Cierre de deuda por S/${amount.toFixed(2)} - Cliente: ${session.client || 'Sin nombre'}`,
          stationName: station.name,
          amount,
          clientName: session.client || null,
          customerId: session.clientId || null,
        },
      });
    }

    return result;
  } catch (error) {
    console.error('Failed to close session:', error);
    await logAuditFailure(firestore, {
      action: 'session.close.error',
      target: 'stations',
      targetId: stationId,
      locationId,
      actor: { id: operatorId, email: operatorEmail, role: operatorRole },
      error,
      details: {
        stationName: station.name,
        amount,
      },
    });
    throw error;
  }
}
