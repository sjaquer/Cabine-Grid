import { Firestore, doc, setDoc, serverTimestamp, collection } from "firebase/firestore";

export interface InventoryLogEntry {
  locationId: string;
  locationName: string;
  productId: string;
  productName: string;
  type: "entry" | "exit" | "discrepancy" | "sale";
  quantity: number;
  previousStock: number;
  currentStock: number;
  note?: string;
  operator?: {
    id: string | null;
    email: string | null;
    role?: string | null;
  };
  source: "manual" | "pos" | "audit";
}

export async function logInventoryMovement(
  firestore: Firestore,
  entry: InventoryLogEntry
) {
  try {
    const logRef = doc(collection(firestore, "inventory_movements"));
    await setDoc(logRef, {
      ...entry,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error recording inventory movement log:", error);
  }
}
