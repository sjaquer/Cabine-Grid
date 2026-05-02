import { Firestore, doc, collection, runTransaction, Timestamp, serverTimestamp } from "firebase/firestore";
import type { Session, SoldProduct, PaymentMethod, Sale, Customer, StockMovement } from "@/lib/types";
import { calculateSessionCost } from "@/lib/session-cost";
import { logAuditAction } from "@/lib/audit-log";
import { logInventoryMovement } from "@/lib/services/inventory-log";

/**
 * Updates the products attached to an active station session using a transaction.
 */
export const updateSessionProducts = async (
  firestore: Firestore,
  stationId: string,
  products: SoldProduct[],
) => {
  const stationRef = doc(firestore, "stations", stationId);

  try {
    await runTransaction(firestore, async (transaction) => {
      const stationDoc = await transaction.get(stationRef);
      if (!stationDoc.exists()) {
        throw new Error("La estación no existe.");
      }

      const stationData = stationDoc.data();
      const currentSession = stationData.session;
      if (!currentSession) {
        throw new Error("No hay una sesión activa en esta estación.");
      }

      transaction.update(stationRef, {
        session: {
          ...currentSession,
          soldProducts: products,
        },
      });
    });
    return true;
  } catch (error) {
    console.error("Fallo al actualizar productos de sesión:", error);
    throw error;
  }
};

/**
 * Starts a station session using a transaction to prevent concurrency issues.
 */
export const startMachineSession = async (
  firestore: Firestore,
  stationId: string,
  session: Session,
  rateId: string,
  selectedLocationId?: string
) => {
  const stationRef = doc(firestore, "stations", stationId);

  try {
    await runTransaction(firestore, async (transaction) => {
      const stationDoc = await transaction.get(stationRef);
      if (!stationDoc.exists()) {
        throw new Error("La estación no existe.");
      }

      const stationData = stationDoc.data();
      if (stationData.status === "occupied") {
        throw new Error("La estación ya está ocupada por otra sesión.");
      }

      transaction.update(stationRef, {
        status: "occupied",
        session: session,
        rateId: rateId,
        ...(!stationData.locationId && selectedLocationId ? { locationId: selectedLocationId } : {}),
      });
    });
    return true;
  } catch (error) {
    console.error("Fallo al iniciar sesión:", error);
    throw error;
  }
};

/**
 * Processes a standalone sale, adjusting stock atomically.
 */
export const processSale = async (
  firestore: Firestore,
  productId: string,
  quantity: number
) => {
  const productRef = doc(firestore, "products", productId);

  try {
    await runTransaction(firestore, async (transaction) => {
      const productDoc = await transaction.get(productRef);
      if (!productDoc.exists()) {
        throw new Error("¡El producto no existe!");
      }

      const currentStock = productDoc.data().stock ?? 0;
      const newStock = currentStock - quantity;
      if (newStock < 0) {
        throw new Error("Stock insuficiente");
      }

      transaction.update(productRef, { stock: newStock });
    });
    return true;
  } catch (error) {
    console.error("Fallo en la venta:", error);
    return false;
  }
};

export interface StandaloneSalePayload {
  amount: number;
  paymentMethod: PaymentMethod;
  soldProducts: SoldProduct[];
  markAsUnpaid?: boolean;
  locationId?: string;
  operatorId?: string;
  operatorEmail?: string;
  operatorRole?: string;
  receiptNumber?: string;
  customerId?: string;
  customerName?: string;
  customerCode?: string;
  machineName?: string;
}

/**
 * Registers a standalone POS sale outside of an active station session.
 */
export const createStandaloneSale = async (
  firestore: Firestore,
  payload: StandaloneSalePayload,
) => {
  const {
    amount,
    paymentMethod,
    soldProducts,
    markAsUnpaid = false,
    locationId,
    operatorId,
    operatorEmail,
    operatorRole,
    receiptNumber = "MANUAL",
    customerId,
    customerName,
    customerCode,
    machineName = "Venta libre",
  } = payload;

  const endTime = Date.now();
  const isUnpaid = markAsUnpaid || paymentMethod === "deuda";
  const effectivePaymentMethod: PaymentMethod = isUnpaid ? "deuda" : paymentMethod;
  const totalProductsBought = soldProducts.reduce((sum, product) => sum + product.quantity, 0);
  const operator = {
    ...(operatorId ? { id: operatorId } : {}),
    ...(operatorEmail ? { email: operatorEmail } : {}),
  };

  if (isUnpaid && !customerId) {
    throw new Error("No se puede registrar deuda sin cliente asociado.");
  }

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
      let customerRef = null;
      let customerData: Customer | null = null;

      if (customerId) {
        customerRef = doc(firestore, "customers", customerId);
        const customerSnap = await transaction.get(customerRef);
        if (!customerSnap.exists()) {
          throw new Error("El cliente seleccionado ya no existe.");
        }
        customerData = {
          ...(customerSnap.data() as Customer),
          id: customerSnap.id,
        };
      }

      if (locationId && soldProducts.length > 0) {
        const inventoryCollection = collection(firestore, "inventory");

        for (const product of soldProducts) {
          if (!product.productId) continue;

          const inventoryDocId = `${locationId}_${product.productId}`;
          const inventoryRef = doc(inventoryCollection, inventoryDocId);
          const inventorySnap = await transaction.get(inventoryRef);

          let currentStock = 0;
          if (inventorySnap.exists()) {
            currentStock = Number(inventorySnap.data().currentStock ?? 0);
          } else {
            const productRef = doc(firestore, "products", product.productId);
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

      const saleRef = doc(collection(firestore, "sales"));
      const customerDisplayName = customerData?.fullName || customerName || "Ocasional";
      const customerDisplayCode = customerData?.customerCode || customerCode || undefined;
      const newSale: Omit<Sale, "id"> = {
        machineName,
        clientName: customerDisplayName,
        ...(customerId ? { customerId } : {}),
        ...(customerDisplayCode ? { customerCode: customerDisplayCode } : {}),
        ...(locationId ? { locationId } : {}),
        receiptNumber,
        startTime: Timestamp.fromMillis(endTime),
        endTime: Timestamp.fromMillis(endTime),
        totalMinutes: 0,
        grossAmount: amount,
        discountAmount: 0,
        netAmount: amount,
        amount,
        paymentMethod: effectivePaymentMethod,
        isUnpaid,
        soldProducts,
        ...(Object.keys(operator).length > 0 ? { operator } : {}),
      };

      transaction.set(saleRef, newSale);

      if (locationId && inventoryAdjustments.length > 0) {
        const inventoryCollection = collection(firestore, "inventory");
        const stockMovementsCollection = collection(firestore, "stockMovements");

        for (const adjustment of inventoryAdjustments) {
          const inventoryRef = doc(inventoryCollection, adjustment.inventoryDocId);
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

          const stockMovementRef = doc(stockMovementsCollection);
          const stockMovement: Omit<StockMovement, "id"> = {
            locationId,
            productId: adjustment.productId,
            productName: adjustment.productName,
            type: "sale",
            quantity: adjustment.quantity,
            quantityBefore: adjustment.currentStock,
            quantityAfter: adjustment.newStock,
            reason: `Sale from standalone POS`,
            saleId: saleRef.id,
            approvedBy: {
              id: operatorId,
              email: operatorEmail,
            },
            createdAt: Timestamp.now(),
          };
          transaction.set(stockMovementRef, stockMovement);
        }
      }

      if (customerRef && customerData && isUnpaid) {
        const currentDebt = Number(customerData.debt ?? 0);
        transaction.set(customerRef, {
          debt: Math.round((currentDebt + amount) * 100) / 100,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }

      return {
        saleId: saleRef.id,
        receiptNumber,
        stockMovements: inventoryAdjustments.map((adjustment) => adjustment.inventoryDocId),
      };
    });

    if (locationId && inventoryAdjustments.length > 0) {
      for (const adjustment of inventoryAdjustments) {
        await logInventoryMovement(firestore, {
          locationId,
          locationName: `Local ${locationId}`,
          productId: adjustment.productId,
          productName: adjustment.productName,
          type: "sale",
          quantity: adjustment.quantity,
          previousStock: adjustment.currentStock,
          currentStock: adjustment.newStock,
          note: `Venta POS independiente (${machineName})`,
          operator: {
            id: operatorId || null,
            email: operatorEmail || null,
            role: operatorRole || null,
          },
          source: "pos",
        });
      }
    }

    await logAuditAction(firestore, {
      action: "sale.create",
      target: "sales",
      targetId: result.saleId,
      locationId,
      actor: { id: operatorId, email: operatorEmail, role: operatorRole },
      details: {
        machineName,
        amount,
        paymentMethod: effectivePaymentMethod,
        isUnpaid,
        receiptNumber: result.receiptNumber,
        productsCount: soldProducts.length,
        customerId: customerId ?? null,
        customerName: customerName ?? null,
      },
    });

    return result;
  } catch (error) {
    console.error("Failed to create standalone sale:", error);
    throw error;
  }
};

/**
 * Moves an active session from one station to another in a single transaction.
 */
export const moveStationSession = async (
  firestore: Firestore,
  originStationId: string,
  destinationStationId: string
) => {
  if (originStationId === destinationStationId) {
    throw new Error("La estación de origen y destino no pueden ser la misma.");
  }

  const originRef = doc(firestore, "stations", originStationId);
  const destinationRef = doc(firestore, "stations", destinationStationId);

  try {
    await runTransaction(firestore, async (transaction) => {
      const originSnap = await transaction.get(originRef);
      const destinationSnap = await transaction.get(destinationRef);

      if (!originSnap.exists() || !destinationSnap.exists()) {
        throw new Error("Una de las estaciones no existe.");
      }

      const originData = originSnap.data();
      const destinationData = destinationSnap.data();

      const originSession = originData.session;
      if (!originSession) {
        throw new Error("La estación de origen no tiene una sesión activa.");
      }

      if (destinationData.status !== "available" || destinationData.session) {
        throw new Error("La estación de destino no está disponible.");
      }

      // Destination takes full active session.
      transaction.update(destinationRef, {
        status: "occupied",
        session: originSession,
      });

      // Origin is fully released.
      transaction.update(originRef, {
        status: "available",
        session: null,
      });
    });

    return true;
  } catch (error) {
    console.error("Fallo al mover sesión de estación:", error);
    throw error;
  }
};

/**
 * Applies a customer's card to the active session on a station.
 * - Validates card exists and is unused
 * - Updates station.session.appliedCards and session.discount when applicable
 * - Marks the card as used in the customer's inventory
 */
export const applyCardToSession = async (
  firestore: Firestore,
  stationId: string,
  customerId: string,
  cardId: string,
) => {
  const stationRef = doc(firestore, 'stations', stationId);
  const customerRef = doc(firestore, 'customers', customerId);

  try {
    await runTransaction(firestore, async (transaction) => {
      const stationSnap = await transaction.get(stationRef);
      const customerSnap = await transaction.get(customerRef);

      if (!stationSnap.exists()) throw new Error('Station not found');
      if (!customerSnap.exists()) throw new Error('Customer not found');

      const stationData = stationSnap.data();
      const customerData = customerSnap.data();

      const session: Session | null = stationData.session ?? null;
      if (!session) throw new Error('No active session on station');
      if (session.clientId !== customerId) throw new Error('Session is not linked to this customer');

      const inventoryCards: any[] = customerData.inventoryCards || [];
      const card = inventoryCards.find((c) => c.id === cardId);
      if (!card) throw new Error('Card not found in customer inventory');
      if (card.isUsed) throw new Error('Card already used');

      // Validate card expiration
      if (card.expiresAt) {
        const expiresAtMs = typeof card.expiresAt.toMillis === 'function'
          ? card.expiresAt.toMillis()
          : typeof card.expiresAt === 'number' ? card.expiresAt : 0;
        if (expiresAtMs > 0 && Date.now() > expiresAtMs) {
          throw new Error('Esta carta ha expirado y no puede ser utilizada.');
        }
      }

      // Calculate current gross total using session-cost helper
      const calc = calculateSessionCost(session, 5);
      const grossTotal = calc.finalCost;

      let discountAmount = 0;
      const updatedSession: any = {
        ...session,
        appliedCards: [...(session.appliedCards || []), card.id],
      };

      if (card.type === 'discount' && typeof card.value === 'number') {
        // treat value as percentage, capped at 50% to prevent abuse
        const cappedPercent = Math.min(card.value, 50);
        discountAmount = Math.round((grossTotal * (cappedPercent / 100)) * 100) / 100;
        updatedSession.discount = { amount: discountAmount, reason: `Carta: ${card.name} (${cappedPercent}%)` };
      }

      if (card.type === 'time' && typeof card.value === 'number') {
        // card.value is minutes to add
        const addMinutes = Math.max(0, Math.floor(card.value));
        updatedSession.extraMinutes = (session.extraMinutes ?? 0) + addMinutes;
      }

      // mark card used
      const updatedCards = inventoryCards.map((c) => c.id === card.id ? { ...c, isUsed: true, usedAt: Timestamp.fromMillis(Date.now()) } : c);

      transaction.update(stationRef, { session: updatedSession });
      transaction.update(customerRef, { inventoryCards: updatedCards });
    });
    // Audit the card usage
    try {
      await logAuditAction(firestore, {
        action: 'customer.card.use',
        target: 'customers',
        targetId: customerId,
        details: { cardId, stationId },
      });
    } catch (e) {
      console.error('Failed to log audit for card use', e);
    }

    return true;
  } catch (error) {
    console.error('Failed to apply card to session:', error);
    throw error;
  }
};
