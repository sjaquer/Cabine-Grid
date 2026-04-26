import { Firestore, doc, runTransaction } from "firebase/firestore";
import type { Session, SoldProduct } from "@/lib/types";

/**
 * Updates the products attached to an active station session using a transaction.
 */
export const updateSessionProducts = async (
  firestore: Firestore,
  stationId: string,
  products: SoldProduct[]
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
