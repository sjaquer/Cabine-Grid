import type { Session } from './types';

export interface SessionCostCalculation {
  elapsedSeconds: number;
  elapsedMinutes: number;
  billedMinutes: number;
  billedHours: number;
  sessionCost: number;
  productsTotal: number;
  finalCost: number;
  chargeDescription: string;
}

/**
 * Calculates the total cost for a session including machine usage and products.
 * 
 * Rules:
 * - Up to fractionMinutes: charge actual time used in minutes
 * - Beyond fractionMinutes: charge full hour (rounded up)
 * - Add cost of all products sold
 * 
 * @param session The session object with startTime, hourlyRate, and soldProducts
 * @param fractionMinutes Grace period in minutes (default 5)
 * @returns Complete cost breakdown
 */
export function calculateSessionCost(
  session: Session,
  fractionMinutes: number = 5,
): SessionCostCalculation {
  const hourlyRate = session.hourlyRate || 0;
  const now = Date.now();
  const elapsedSeconds = Math.max(0, (now - session.startTime) / 1000);
  const elapsedMinutes = Math.max(0, Math.ceil(elapsedSeconds / 60));
  const extraMinutes = Math.max(0, session.extraMinutes ?? 0);
  const effectiveElapsedMinutes = Math.max(0, elapsedMinutes - extraMinutes);
  const graceMinutes = Math.max(1, Math.floor(fractionMinutes));

  // Calculate billable minutes:
  // - 0 minutes = 0 charge
  // - Up to grace period = charge exact time
  // - Beyond grace period = round up to next full hour
  const billedMinutes =
    effectiveElapsedMinutes === 0
      ? 0
      : effectiveElapsedMinutes <= graceMinutes
        ? effectiveElapsedMinutes
        : Math.ceil(effectiveElapsedMinutes / 60) * 60;

  const billedHours = billedMinutes / 60;
  const sessionCostRaw = billedHours * hourlyRate;
  let sessionCost = Math.round(sessionCostRaw * 100) / 100;

  // Monto Mínimo: Si la sesión dura menos de 10 minutos, cobrar S/ 0.50
  if (elapsedMinutes > 0 && elapsedMinutes < 10) {
    sessionCost = 0.50;
  }

  // Cost of products
  const soldProducts = session.soldProducts ?? [];
  const productsTotal = soldProducts.reduce(
    (total, p) => total + p.quantity * p.unitPrice,
    0,
  );

  // Charge description for UI
  const chargeDescription =
    session.usageMode === 'prepaid' && session.prepaidHours
      ? `(prepago ${session.prepaidHours}h, prórroga ${graceMinutes} min; luego hora completa)`
      : `(prórroga ${graceMinutes} min; luego hora completa)`;

  const finalCost = sessionCost + productsTotal;

  return {
    elapsedSeconds,
    elapsedMinutes: effectiveElapsedMinutes,
    billedMinutes,
    billedHours,
    sessionCost,
    productsTotal,
    finalCost,
    chargeDescription,
  };
}

/**
 * Format a cost calculation for display in reports/PDFs
 */
export function formatSessionCostForReport(
  calculation: SessionCostCalculation,
): {
  sessionCost: string;
  productsTotal: string;
  finalCost: string;
  billedTime: string;
} {
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
    }).format(amount);
  };

  const formatDuration = (minutes: number): string => {
    if (minutes === 0) return '0 min';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0 && mins > 0) {
      return `${hours}h ${mins}m`;
    }
    if (hours > 0) {
      return `${hours}h`;
    }
    return `${mins}m`;
  };

  return {
    sessionCost: formatCurrency(calculation.sessionCost),
    productsTotal: formatCurrency(calculation.productsTotal),
    finalCost: formatCurrency(calculation.finalCost),
    billedTime: formatDuration(calculation.billedMinutes),
  };
}
