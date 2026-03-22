import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import type { PaymentMethod, Sale } from "@/lib/types";
import type { Timestamp } from "firebase/firestore";
import { formatCurrency } from "@/lib/utils";
import type { ExecutiveLocationSummary, OperatorProductivity, ReportFilters } from "@/lib/finance-analytics";

function toDate(value: Timestamp | Date | number): Date {
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  return value.toDate();
}

function paymentLabel(method: PaymentMethod): string {
  if (method === "efectivo") return "Efectivo";
  if (method === "yape") return "Yape/Plin";
  return "Tarjeta/Otro";
}

export function exportFinancePdf(params: {
  sales: Sale[];
  filters: ReportFilters;
  locationsMap: Map<string, string>;
  executiveByLocation: ExecutiveLocationSummary[];
  operatorProductivity: OperatorProductivity[];
}): void {
  const { sales, filters, locationsMap, executiveByLocation, operatorProductivity } = params;
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  doc.setFontSize(18);
  doc.text("Cabine Grid - Reporte Financiero", 36, 36);

  const locationLabel = filters.locationId && filters.locationId !== "all"
    ? (locationsMap.get(filters.locationId) || filters.locationId)
    : "Todos";
  const operatorLabel = filters.operatorId && filters.operatorId !== "all" ? filters.operatorId : "Todos";
  const paymentLabelText = filters.paymentMethod && filters.paymentMethod !== "all"
    ? paymentLabel(filters.paymentMethod)
    : "Todos";

  doc.setFontSize(10);
  doc.text(`Rango: ${filters.startDate} a ${filters.endDate}`, 36, 58);
  doc.text(`Local: ${locationLabel} | Operador: ${operatorLabel} | Pago: ${paymentLabelText}`, 36, 72);

  autoTable(doc, {
    startY: 90,
    head: [["Local", "Ingresos", "Ventas", "Ticket Prom.", "Margen Est.", "% Margen", "% Ocupación"]],
    body: executiveByLocation.map((row) => [
      locationsMap.get(row.locationId) || row.locationId,
      formatCurrency(row.revenue),
      String(row.salesCount),
      formatCurrency(row.avgTicket),
      formatCurrency(row.estimatedMargin),
      `${row.estimatedMarginPercent.toFixed(1)}%`,
      `${row.occupancyPercent.toFixed(1)}%`,
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [17, 24, 39] },
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 14,
    head: [["Operador", "Ingresos", "Ventas", "T. Atención", "Errores", "Incongruencias"]],
    body: operatorProductivity.map((row) => [
      row.operatorEmail,
      formatCurrency(row.revenue),
      String(row.salesCount),
      `${row.averageAttentionMinutes.toFixed(1)} min`,
      String(row.errorsCount),
      String(row.inconsistenciesCount),
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 64, 175] },
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 14,
    head: [["Fecha", "Local", "Boleta", "Cabina", "Cliente", "Pago", "Monto"]],
    body: sales.map((sale) => [
      toDate(sale.endTime as Timestamp).toLocaleString("es-PE"),
      locationsMap.get(sale.locationId || "") || sale.locationId || "Sin local",
      sale.receiptNumber || "-",
      sale.machineName,
      sale.clientName || "Ocasional",
      paymentLabel(sale.paymentMethod),
      formatCurrency(sale.amount),
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [55, 65, 81] },
  });

  const safeDate = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  doc.save(`reporte-financiero-${safeDate}.pdf`);
}

export function exportFinanceExcel(params: {
  sales: Sale[];
  filters: ReportFilters;
  locationsMap: Map<string, string>;
  executiveByLocation: ExecutiveLocationSummary[];
  operatorProductivity: OperatorProductivity[];
}): void {
  const { sales, filters, locationsMap, executiveByLocation, operatorProductivity } = params;

  const wb = XLSX.utils.book_new();

  const resumenRows = executiveByLocation.map((row) => ({
    Local: locationsMap.get(row.locationId) || row.locationId,
    Ingresos: row.revenue,
    Ventas: row.salesCount,
    TicketPromedio: row.avgTicket,
    MargenEstimado: row.estimatedMargin,
    MargenPorcentaje: Number(row.estimatedMarginPercent.toFixed(2)),
    OcupacionPorcentaje: Number(row.occupancyPercent.toFixed(2)),
  }));

  const productividadRows = operatorProductivity.map((row) => ({
    Operador: row.operatorEmail,
    Ingresos: row.revenue,
    Ventas: row.salesCount,
    TiempoAtencionMin: Number(row.averageAttentionMinutes.toFixed(2)),
    Errores: row.errorsCount,
    Incongruencias: row.inconsistenciesCount,
  }));

  const detalleRows = sales.map((sale) => ({
    Fecha: toDate(sale.endTime as Timestamp).toISOString(),
    Local: locationsMap.get(sale.locationId || "") || sale.locationId || "Sin local",
    Operador: sale.operator?.email || "No identificado",
    Cabina: sale.machineName,
    Cliente: sale.clientName || "Ocasional",
    MetodoPago: paymentLabel(sale.paymentMethod),
    Boleta: sale.receiptNumber || "-",
    DuracionMin: sale.totalMinutes,
    Monto: sale.amount,
  }));

  const filtrosRows = [
    { Campo: "FechaInicio", Valor: filters.startDate },
    { Campo: "FechaFin", Valor: filters.endDate },
    {
      Campo: "Local",
      Valor: filters.locationId && filters.locationId !== "all"
        ? (locationsMap.get(filters.locationId) || filters.locationId)
        : "Todos",
    },
    { Campo: "Operador", Valor: filters.operatorId && filters.operatorId !== "all" ? filters.operatorId : "Todos" },
    {
      Campo: "MetodoPago",
      Valor: filters.paymentMethod && filters.paymentMethod !== "all"
        ? paymentLabel(filters.paymentMethod)
        : "Todos",
    },
  ];

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filtrosRows), "Filtros");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumenRows), "ResumenEjecutivo");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(productividadRows), "Productividad");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detalleRows), "DetalleVentas");

  const safeDate = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  XLSX.writeFile(wb, `reporte-financiero-${safeDate}.xlsx`);
}
