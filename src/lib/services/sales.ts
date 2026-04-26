import { Firestore, doc, runTransaction } from "firebase/firestore";
import type { Session, SoldProduct } from "@/lib/types";

/**
 * Updates the products attached to an active machine session using a transaction.
 */
export const updateSessionProducts = async (
  firestore: Firestore,
  machineId: string,
  products: SoldProduct[]
) => {
  const machineRef = doc(firestore, "machines", machineId);

  try {
    await runTransaction(firestore, async (transaction) => {
      const machineDoc = await transaction.get(machineRef);
      if (!machineDoc.exists()) {
        throw new Error("La máquina no existe.");
      }

      const machineData = machineDoc.data();
      const currentSession = machineData.session;
      if (!currentSession) {
        throw new Error("No hay una sesión activa en esta máquina.");
      }

      transaction.update(machineRef, {
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
 * Starts a machine session using a transaction to prevent concurrency issues.
 */
export const startMachineSession = async (
  firestore: Firestore,
  machineId: string,
  session: Session,
  rateId: string,
  selectedLocationId?: string
) => {
  const machineRef = doc(firestore, "machines", machineId);

  try {
    await runTransaction(firestore, async (transaction) => {
      const machineDoc = await transaction.get(machineRef);
      if (!machineDoc.exists()) {
        throw new Error("La máquina no existe.");
      }

      const machineData = machineDoc.data();
      if (machineData.status === "occupied") {
        throw new Error("La máquina ya está ocupada por otra sesión.");
      }

      transaction.update(machineRef, {
        status: "occupied",
        session: session,
        rateId: rateId,
        ...(!machineData.locationId && selectedLocationId ? { locationId: selectedLocationId } : {}),
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
