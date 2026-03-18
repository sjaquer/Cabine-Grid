import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Machine, PaymentMethod, Sale, UserProfile } from "@/lib/types";
import { formatCurrency, formatDateTime, formatDuration } from "@/lib/utils";
import type { Timestamp } from "firebase/firestore";

function paymentLabel(method: PaymentMethod): string {
  if (method === "efectivo") return "Efectivo";
  if (method === "yape") return "Yape/Plin";
  return "Tarjeta/Otro";
}

function safeTimestampToDate(value: Timestamp): Date {
  return value.toDate();
}

type BuildShiftReportPdfParams = {
  userProfile: UserProfile | null;
  sales: Sale[];
  shiftStartMs: number;
  shiftEndMs: number;
  openMachines: Machine[];
};

export function buildShiftReportPdf({
  userProfile,
  sales,
  shiftStartMs,
  shiftEndMs,
  openMachines,
}: BuildShiftReportPdfParams): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

  const operatorName = userProfile?.name || userProfile?.email || "Operador";
  const shiftStart = new Date(shiftStartMs);
  const shiftEnd = new Date(shiftEndMs);

  const totalSales = sales.reduce((sum, sale) => sum + sale.amount, 0);
  const totalCash = sales
    .filter((sale) => sale.paymentMethod === "efectivo")
    .reduce((sum, sale) => sum + sale.amount, 0);
  const totalYape = sales
    .filter((sale) => sale.paymentMethod === "yape")
    .reduce((sum, sale) => sum + sale.amount, 0);
  const totalOther = sales
    .filter((sale) => sale.paymentMethod === "otro")
    .reduce((sum, sale) => sum + sale.amount, 0);

  const productsTotal = sales.reduce((sum, sale) => {
    const sub = sale.soldProducts?.reduce((acc, p) => acc + p.quantity * p.unitPrice, 0) ?? 0;
    return sum + sub;
  }, 0);

  const soldProductsByName = new Map<string, { quantity: number; amount: number }>();
  sales.forEach((sale) => {
    (sale.soldProducts ?? []).forEach((item) => {
      const current = soldProductsByName.get(item.productName) ?? { quantity: 0, amount: 0 };
      soldProductsByName.set(item.productName, {
        quantity: current.quantity + item.quantity,
        amount: current.amount + item.quantity * item.unitPrice,
      });
    });
  });
  const totalProductUnits = Array.from(soldProductsByName.values()).reduce((sum, item) => sum + item.quantity, 0);

  doc.setFontSize(18);
  doc.text("Cabine Grid - Cierre de Turno", 40, 40);

  doc.setFontSize(11);
  doc.text(`Operador: ${operatorName}`, 40, 62);
  doc.text(`Rol: ${userProfile?.role ?? "N/A"}`, 40, 78);
  doc.text(`Inicio de turno: ${formatDateTime(shiftStart)}`, 40, 94);
  doc.text(`Fin de turno: ${formatDateTime(shiftEnd)}`, 40, 110);

  autoTable(doc, {
    startY: 128,
    head: [["Resumen", "Valor"]],
    body: [
      ["Sesiones terminadas", String(sales.length)],
      ["Total vendido", formatCurrency(totalSales)],
      ["Debe entregar en efectivo", formatCurrency(totalCash)],
      ["Debe coincidir en Yape/Plin", formatCurrency(totalYape)],
      ["Pagos con tarjeta/otro", formatCurrency(totalOther)],
      ["Total en productos", formatCurrency(productsTotal)],
      ["Unidades TPV vendidas", String(totalProductUnits)],
      ["Cabinas que quedan activas", String(openMachines.length)],
    ],
    styles: { fontSize: 10 },
    headStyles: { fillColor: [31, 41, 55] },
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 16,
    head: [["Boleta", "Fecha fin", "Cabina", "Cliente", "Metodo", "Duracion", "Monto"]],
    body: sales.map((sale) => [
      sale.receiptNumber || "-",
      formatDateTime(safeTimestampToDate(sale.endTime as Timestamp)),
      sale.machineName,
      sale.clientName || "Ocasional",
      paymentLabel(sale.paymentMethod),
      formatDuration(sale.totalMinutes),
      formatCurrency(sale.amount),
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [17, 24, 39] },
    didDrawPage: () => {
      doc.setFontSize(9);
      doc.text("Reporte generado automaticamente al cerrar sesion.", 40, doc.internal.pageSize.getHeight() - 20);
    },
  });

  if (soldProductsByName.size > 0) {
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 16,
      head: [["Producto TPV", "Cantidad vendida", "Monto"]],
      body: Array.from(soldProductsByName.entries())
        .sort((a, b) => b[1].quantity - a[1].quantity)
        .map(([name, values]) => [name, String(values.quantity), formatCurrency(values.amount)]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 64, 175] },
    });
  }

  if (openMachines.length > 0) {
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 16,
      head: [["Cabinas activas para siguiente turno", "Estado", "Cliente", "Inicio sesion"]],
      body: openMachines.map((machine) => [
        machine.name,
        machine.status === "warning" ? "Alerta" : "En uso",
        machine.session?.client || "Ocasional",
        machine.session?.startTime ? formatDateTime(new Date(machine.session.startTime)) : "-",
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [55, 65, 81] },
    });
  }

  const safeDate = shiftEnd.toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const filename = `cierre-turno-${(userProfile?.uid || "usuario")}-${safeDate}.pdf`;
  doc.save(filename);
}
