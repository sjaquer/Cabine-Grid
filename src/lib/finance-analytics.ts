import type { Station, PaymentMethod, Sale, SoldProduct } from "@/lib/types";
import type { Timestamp } from "firebase/firestore";

export type ReportFilters = {
  startDate: string;
  endDate: string;
  locationId?: string;
  operatorId?: string;
  paymentMethod?: PaymentMethod | "all";
};

export type ProductMixItem = {
  productName: string;
  quantity: number;
  revenue: number;
  ratio: number;
};

export type HourlySalesItem = {
  hour: number;
  label: string;
  revenue: number;
  tickets: number;
};

export type ExecutiveLocationSummary = {
  locationId: string;
  salesCount: number;
  revenue: number;
  avgTicket: number;
  avgServiceMinutes: number;
  estimatedMargin: number;
  estimatedMarginPercent: number;
  occupancyPercent: number;
  productsMix: ProductMixItem[];
  hourlySales: HourlySalesItem[];
};

export type ComparisonBlock = {
  title: string;
  currentValue: number;
  previousValue: number;
  variationPercent: number;
};

export type OperatorProductivity = {
  operatorId: string;
  operatorEmail: string;
  salesCount: number;
  revenue: number;
  averageAttentionMinutes: number;
  errorsCount: number;
  inconsistenciesCount: number;
};

export type LocalComparison = {
  locationId: string;
  revenue: number;
  salesCount: number;
  avgTicket: number;
  marginPercent: number;
};

type ShiftClosureLike = {
  locationId?: string | null;
  totalSales?: number;
  expectedCash?: number;
  countedCash?: number;
  cashDifference?: number;
  salesCount?: number;
};

export type ConsolidatedClosure = {
  locationId: string;
  totalSales: number;
  expectedCash: number;
  countedCash: number;
  cashDifference: number;
  salesCount: number;
};

export type AuditLogLike = {
  action?: string;
  target?: string;
  locationId?: string | null;
  createdAt?: Timestamp;
  createdAtMs?: number;
  severity?: "low" | "medium" | "high" | "critical";
  anomalyScore?: number;
  riskTags?: string[];
  actor?: {
    id?: string | null;
  };
  details?: Record<string, unknown>;
};

function toDate(value: Timestamp | Date | number): Date {
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  return value.toDate();
}

function startOfDay(input: Date): Date {
  const d = new Date(input);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(input: Date): Date {
  const d = new Date(input);
  d.setHours(23, 59, 59, 999);
  return d;
}

function weekStartMonday(input: Date): Date {
  const d = startOfDay(input);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function safeDivide(a: number, b: number): number {
  if (!b) return 0;
  return a / b;
}

function paymentMatches(filter: ReportFilters["paymentMethod"], method: PaymentMethod): boolean {
  if (!filter || filter === "all") return true;
  return method === filter;
}

export function parseFiltersRange(filters: ReportFilters): { start: Date; end: Date } {
  const start = startOfDay(new Date(`${filters.startDate}T00:00:00`));
  const end = endOfDay(new Date(`${filters.endDate}T00:00:00`));
  return { start, end };
}

export function filterSalesByReportFilters(sales: Sale[], filters: ReportFilters): Sale[] {
  const { start, end } = parseFiltersRange(filters);
  return sales.filter((sale) => {
    const endTime = toDate(sale.endTime as Timestamp);
    if (endTime < start || endTime > end) return false;
    if (filters.locationId && filters.locationId !== "all" && sale.locationId !== filters.locationId) return false;
    if (filters.operatorId && filters.operatorId !== "all" && sale.operator?.id !== filters.operatorId) return false;
    if (!paymentMatches(filters.paymentMethod, sale.paymentMethod)) return false;
    return true;
  });
}

function estimateSaleMargin(sale: Sale): number {
  const serviceRevenue = Math.max(0, sale.amount - (sale.soldProducts ?? []).reduce((sum, p) => sum + p.quantity * p.unitPrice, 0));
  const serviceCost = serviceRevenue * 0.35;
  const productsCost = (sale.soldProducts ?? []).reduce((sum, p) => sum + p.quantity * p.unitPrice * 0.65, 0);
  const estimatedCost = serviceCost + productsCost;
  return Math.max(0, sale.amount - estimatedCost);
}

function buildHourlySales(sales: Sale[]): HourlySalesItem[] {
  const hours = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: `${String(hour).padStart(2, "0")}:00`,
    revenue: 0,
    tickets: 0,
  }));

  sales.forEach((sale) => {
    const hour = toDate(sale.endTime as Timestamp).getHours();
    hours[hour].revenue += sale.amount;
    hours[hour].tickets += 1;
  });

  return hours.filter((row) => row.revenue > 0 || row.tickets > 0);
}

function buildProductsMix(sales: Sale[]): ProductMixItem[] {
  const map = new Map<string, { quantity: number; revenue: number }>();
  let totalProductsRevenue = 0;

  sales.forEach((sale) => {
    (sale.soldProducts ?? []).forEach((product: SoldProduct) => {
      const current = map.get(product.productName) ?? { quantity: 0, revenue: 0 };
      const subtotal = product.quantity * product.unitPrice;
      totalProductsRevenue += subtotal;
      map.set(product.productName, {
        quantity: current.quantity + product.quantity,
        revenue: current.revenue + subtotal,
      });
    });
  });

  return Array.from(map.entries())
    .map(([productName, value]) => ({
      productName,
      quantity: value.quantity,
      revenue: value.revenue,
      ratio: safeDivide(value.revenue, totalProductsRevenue),
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);
}

function countMachinesByLocation(machines: Station[]): Map<string, number> {
  const map = new Map<string, number>();
  machines.forEach((machine) => {
    const key = machine.locationId || "sin-local";
    map.set(key, (map.get(key) ?? 0) + 1);
  });
  return map;
}

function occupiedMinutesByLocation(sales: Sale[]): Map<string, number> {
  const map = new Map<string, number>();
  sales.forEach((sale) => {
    const key = sale.locationId || "sin-local";
    map.set(key, (map.get(key) ?? 0) + Math.max(0, sale.totalMinutes || 0));
  });
  return map;
}

function comparison(current: number, previous: number): number {
  if (!previous && !current) return 0;
  if (!previous) return 100;
  return ((current - previous) / previous) * 100;
}

function overlapsRange(date: Date, start: Date, end: Date): boolean {
  return date >= start && date <= end;
}

export function buildFinanceAnalytics(params: {
  sales: Sale[];
  machines: Station[];
  filters: ReportFilters;
  auditLogs: AuditLogLike[];
  closures: ShiftClosureLike[];
}): {
  filteredSales: Sale[];
  executiveByLocation: ExecutiveLocationSummary[];
  todayVsYesterday: ComparisonBlock[];
  weekVsPreviousWeek: ComparisonBlock[];
  localComparison: LocalComparison[];
  operatorProductivity: OperatorProductivity[];
  consolidatedClosures: ConsolidatedClosure[];
} {
  const { sales, machines, filters, auditLogs, closures } = params;
  const filteredSales = filterSalesByReportFilters(sales, filters);
  const machineCountMap = countMachinesByLocation(machines);
  const occupiedMinutes = occupiedMinutesByLocation(filteredSales);
  const { start, end } = parseFiltersRange(filters);
  const totalPeriodMinutes = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));

  const salesByLocation = new Map<string, Sale[]>();
  filteredSales.forEach((sale) => {
    const key = sale.locationId || "sin-local";
    const current = salesByLocation.get(key) ?? [];
    current.push(sale);
    salesByLocation.set(key, current);
  });

  const executiveByLocation: ExecutiveLocationSummary[] = Array.from(salesByLocation.entries())
    .map(([locationId, locationSales]) => {
      const revenue = locationSales.reduce((sum, sale) => sum + sale.amount, 0);
      const salesCount = locationSales.length;
      const avgTicket = safeDivide(revenue, salesCount);
      const totalMinutes = locationSales.reduce((sum, sale) => sum + Math.max(0, sale.totalMinutes || 0), 0);
      const avgServiceMinutes = safeDivide(totalMinutes, salesCount);
      const estimatedMargin = locationSales.reduce((sum, sale) => sum + estimateSaleMargin(sale), 0);
      const estimatedMarginPercent = safeDivide(estimatedMargin, revenue) * 100;
      const locationMachines = machineCountMap.get(locationId) ?? 0;
      const occupancyPercent = Math.min(
        100,
        safeDivide(occupiedMinutes.get(locationId) ?? 0, Math.max(1, locationMachines * totalPeriodMinutes)) * 100
      );

      return {
        locationId,
        salesCount,
        revenue,
        avgTicket,
        avgServiceMinutes,
        estimatedMargin,
        estimatedMarginPercent,
        occupancyPercent,
        productsMix: buildProductsMix(locationSales),
        hourlySales: buildHourlySales(locationSales),
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const yesterdayStart = startOfDay(new Date(now.getTime() - 86400000));
  const yesterdayEnd = endOfDay(new Date(now.getTime() - 86400000));
  const currentWeekStart = weekStartMonday(now);
  const currentWeekEnd = todayEnd;
  const previousWeekEnd = endOfDay(new Date(currentWeekStart.getTime() - 86400000));
  const previousWeekStart = weekStartMonday(previousWeekEnd);

  const todaySales = sales.filter((sale) => overlapsRange(toDate(sale.endTime as Timestamp), todayStart, todayEnd));
  const yesterdaySales = sales.filter((sale) => overlapsRange(toDate(sale.endTime as Timestamp), yesterdayStart, yesterdayEnd));
  const currentWeekSales = sales.filter((sale) => overlapsRange(toDate(sale.endTime as Timestamp), currentWeekStart, currentWeekEnd));
  const previousWeekSales = sales.filter((sale) => overlapsRange(toDate(sale.endTime as Timestamp), previousWeekStart, previousWeekEnd));

  const todayRevenue = todaySales.reduce((sum, sale) => sum + sale.amount, 0);
  const yesterdayRevenue = yesterdaySales.reduce((sum, sale) => sum + sale.amount, 0);

  const todayVsYesterday: ComparisonBlock[] = [
    {
      title: "Ingresos",
      currentValue: todayRevenue,
      previousValue: yesterdayRevenue,
      variationPercent: comparison(todayRevenue, yesterdayRevenue),
    },
    {
      title: "Ticket promedio",
      currentValue: safeDivide(todayRevenue, todaySales.length),
      previousValue: safeDivide(yesterdayRevenue, yesterdaySales.length),
      variationPercent: comparison(
        safeDivide(todayRevenue, todaySales.length),
        safeDivide(yesterdayRevenue, yesterdaySales.length)
      ),
    },
    {
      title: "Sesiones",
      currentValue: todaySales.length,
      previousValue: yesterdaySales.length,
      variationPercent: comparison(todaySales.length, yesterdaySales.length),
    },
  ];

  const currentWeekRevenue = currentWeekSales.reduce((sum, sale) => sum + sale.amount, 0);
  const previousWeekRevenue = previousWeekSales.reduce((sum, sale) => sum + sale.amount, 0);

  const weekVsPreviousWeek: ComparisonBlock[] = [
    {
      title: "Ingresos",
      currentValue: currentWeekRevenue,
      previousValue: previousWeekRevenue,
      variationPercent: comparison(currentWeekRevenue, previousWeekRevenue),
    },
    {
      title: "Margen estimado",
      currentValue: currentWeekSales.reduce((sum, sale) => sum + estimateSaleMargin(sale), 0),
      previousValue: previousWeekSales.reduce((sum, sale) => sum + estimateSaleMargin(sale), 0),
      variationPercent: comparison(
        currentWeekSales.reduce((sum, sale) => sum + estimateSaleMargin(sale), 0),
        previousWeekSales.reduce((sum, sale) => sum + estimateSaleMargin(sale), 0)
      ),
    },
    {
      title: "Sesiones",
      currentValue: currentWeekSales.length,
      previousValue: previousWeekSales.length,
      variationPercent: comparison(currentWeekSales.length, previousWeekSales.length),
    },
  ];

  const localComparison: LocalComparison[] = executiveByLocation.map((item) => ({
    locationId: item.locationId,
    revenue: item.revenue,
    salesCount: item.salesCount,
    avgTicket: item.avgTicket,
    marginPercent: item.estimatedMarginPercent,
  }));

  const operatorMap = new Map<string, OperatorProductivity>();
  filteredSales.forEach((sale) => {
    const operatorId = sale.operator?.id || "sin-operador";
    const operatorEmail = sale.operator?.email || "No identificado";
    const current = operatorMap.get(operatorId) ?? {
      operatorId,
      operatorEmail,
      salesCount: 0,
      revenue: 0,
      averageAttentionMinutes: 0,
      errorsCount: 0,
      inconsistenciesCount: 0,
    };

    current.salesCount += 1;
    current.revenue += sale.amount;
    current.averageAttentionMinutes += Math.max(0, sale.totalMinutes || 0);
    operatorMap.set(operatorId, current);
  });

  auditLogs.forEach((log) => {
    const operatorId = log.actor?.id || "sin-operador";
    const current = operatorMap.get(operatorId);
    if (!current) return;

    const action = log.action || "";
    if (action.includes("error") || action.includes("fail") || action.includes("delete")) {
      current.errorsCount += 1;
    }
    if (action.includes("discrepancy") || action.includes("anomaly")) {
      current.inconsistenciesCount += 1;
    }

    const details = log.details ?? {};
    const cashDiff = Number(details.cashDifference ?? 0);
    if (Number.isFinite(cashDiff) && cashDiff !== 0) {
      current.inconsistenciesCount += 1;
    }
  });

  const operatorProductivity = Array.from(operatorMap.values())
    .map((operator) => ({
      ...operator,
      averageAttentionMinutes: safeDivide(operator.averageAttentionMinutes, operator.salesCount),
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const consolidatedMap = new Map<string, ConsolidatedClosure>();
  closures.forEach((closure) => {
    const key = closure.locationId || "sin-local";
    const current = consolidatedMap.get(key) ?? {
      locationId: key,
      totalSales: 0,
      expectedCash: 0,
      countedCash: 0,
      cashDifference: 0,
      salesCount: 0,
    };

    current.totalSales += Number(closure.totalSales ?? 0);
    current.expectedCash += Number(closure.expectedCash ?? 0);
    current.countedCash += Number(closure.countedCash ?? 0);
    current.cashDifference += Number(closure.cashDifference ?? 0);
    current.salesCount += Number(closure.salesCount ?? 0);
    consolidatedMap.set(key, current);
  });

  const consolidatedClosures = Array.from(consolidatedMap.values()).sort((a, b) => b.totalSales - a.totalSales);

  return {
    filteredSales,
    executiveByLocation,
    todayVsYesterday,
    weekVsPreviousWeek,
    localComparison,
    operatorProductivity,
    consolidatedClosures,
  };
}
