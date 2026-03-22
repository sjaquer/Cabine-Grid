import { addDoc, collection, serverTimestamp, type Firestore } from "firebase/firestore";

type AuditActor = {
  id?: string | null;
  email?: string | null;
  role?: string | null;
};

type AuditSeverity = "low" | "medium" | "high" | "critical";

type AuditPayload = {
  action: string;
  target: string;
  targetId?: string;
  locationId?: string;
  details?: Record<string, unknown>;
  actor?: AuditActor;
  severity?: AuditSeverity;
  riskTags?: string[];
  anomalyScore?: number;
  outcome?: "success" | "failure";
};

function inferAuditSeverity(payload: AuditPayload): AuditSeverity {
  if (payload.severity) return payload.severity;

  const action = payload.action.toLowerCase();
  const details = payload.details ?? {};
  const cashDifference = Math.abs(Number(details.cashDifference ?? 0));

  if (payload.outcome === "failure") return "high";
  if (action.includes("delete") || action.includes("deactivate") || action.includes("reopen")) return "high";
  if (cashDifference >= 20) return "critical";
  if (cashDifference > 0) return "high";
  if (action.includes("create") || action.includes("update") || action.includes("close")) return "medium";
  return "low";
}

function inferAnomalyScore(payload: AuditPayload): number {
  if (typeof payload.anomalyScore === "number") {
    return Math.max(0, Math.min(100, Math.round(payload.anomalyScore)));
  }

  const action = payload.action.toLowerCase();
  const details = payload.details ?? {};
  const cashDifference = Math.abs(Number(details.cashDifference ?? 0));
  const inventoryDifference = Math.abs(Number(details.difference ?? 0));
  let score = 0;

  if (payload.outcome === "failure") score += 50;
  if (action.includes("delete")) score += 35;
  if (action.includes("discrepancy") || action.includes("anomaly")) score += 30;
  if (action.includes("role") || action.includes("permission")) score += 20;
  if (cashDifference >= 50) score += 45;
  else if (cashDifference >= 20) score += 35;
  else if (cashDifference > 0) score += 15;

  if (inventoryDifference >= 15) score += 30;
  else if (inventoryDifference >= 5) score += 18;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function inferRiskTags(payload: AuditPayload): string[] {
  const explicit = payload.riskTags ?? [];
  const tags = new Set<string>(explicit);
  const action = payload.action.toLowerCase();
  const details = payload.details ?? {};
  const cashDifference = Math.abs(Number(details.cashDifference ?? 0));
  const inventoryDifference = Math.abs(Number(details.difference ?? 0));

  if (payload.outcome === "failure") tags.add("operation-failure");
  if (action.includes("delete")) tags.add("destructive-action");
  if (action.includes("discrepancy") || inventoryDifference !== 0) tags.add("inventory-inconsistency");
  if (cashDifference !== 0) tags.add("cash-difference");
  if (action.includes("role") || action.includes("permission")) tags.add("privilege-change");

  return Array.from(tags);
}

function getClientContext(): Record<string, unknown> {
  if (typeof window === "undefined") {
    return {
      path: null,
      userAgent: null,
      timezone: null,
    };
  }

  return {
    path: window.location.pathname,
    userAgent: window.navigator.userAgent,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

export async function logAuditAction(
  firestore: Firestore,
  payload: AuditPayload
): Promise<void> {
  const severity = inferAuditSeverity(payload);
  const anomalyScore = inferAnomalyScore(payload);
  const riskTags = inferRiskTags(payload);

  try {
    await addDoc(collection(firestore, "auditLogs"), {
      action: payload.action,
      target: payload.target,
      targetId: payload.targetId ?? null,
      locationId: payload.locationId ?? null,
      details: payload.details ?? {},
      severity,
      anomalyScore,
      riskTags,
      outcome: payload.outcome ?? "success",
      actor: {
        id: payload.actor?.id ?? null,
        email: payload.actor?.email ?? null,
        role: payload.actor?.role ?? null,
      },
      context: getClientContext(),
      searchableText: [
        payload.action,
        payload.target,
        payload.targetId ?? "",
        payload.actor?.email ?? "",
        riskTags.join(" "),
        JSON.stringify(payload.details ?? {}),
      ].join(" "),
      createdAtMs: Date.now(),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error registrando bitacora:", error);
  }
}

export async function logAuditFailure(
  firestore: Firestore,
  payload: Omit<AuditPayload, "outcome"> & { error?: unknown }
): Promise<void> {
  const errorMessage = payload.error instanceof Error ? payload.error.message : String(payload.error ?? "unknown");
  await logAuditAction(firestore, {
    ...payload,
    outcome: "failure",
    details: {
      ...(payload.details ?? {}),
      errorMessage,
    },
  });
}
