import { addDoc, collection, serverTimestamp, type Firestore } from "firebase/firestore";

type AuditActor = {
  id?: string | null;
  email?: string | null;
  role?: string | null;
};

type AuditPayload = {
  action: string;
  target: string;
  targetId?: string;
  locationId?: string;
  details?: Record<string, unknown>;
  actor?: AuditActor;
};

export async function logAuditAction(
  firestore: Firestore,
  payload: AuditPayload
): Promise<void> {
  try {
    await addDoc(collection(firestore, "auditLogs"), {
      action: payload.action,
      target: payload.target,
      targetId: payload.targetId ?? null,
      locationId: payload.locationId ?? null,
      details: payload.details ?? {},
      actor: {
        id: payload.actor?.id ?? null,
        email: payload.actor?.email ?? null,
        role: payload.actor?.role ?? null,
      },
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error registrando bitacora:", error);
  }
}
