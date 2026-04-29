import { Firestore, doc, runTransaction, Timestamp } from "firebase/firestore";
import type { Session, SoldProduct } from "@/lib/types";
import { calculateSessionCost } from "@/lib/session-cost";
import { logAuditAction } from "@/lib/audit-log";

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

      // Calculate current gross total using session-cost helper
      const calc = calculateSessionCost(session, 5);
      const grossTotal = calc.finalCost;

      let discountAmount = 0;
      const updatedSession: any = {
        ...session,
        appliedCards: [...(session.appliedCards || []), card.id],
      };

      if (card.type === 'discount' && typeof card.value === 'number') {
        // treat value as percentage
        discountAmount = Math.round((grossTotal * (card.value / 100)) * 100) / 100;
        updatedSession.discount = { amount: discountAmount, reason: `Carta: ${card.name}` };
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
