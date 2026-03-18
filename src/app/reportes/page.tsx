"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, subWeeks } from "date-fns";
import { es } from "date-fns/locale";
import type { Timestamp } from "firebase/firestore";
import { collection, query } from "firebase/firestore";
import { Bar, BarChart, CartesianGrid, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import RoleGuard from "@/components/auth/RoleGuard";
import { useAuth, useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { formatCurrency, formatDuration } from "@/lib/utils";
import type { Sale, Machine, Location } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, FileSpreadsheet, FileText, Filter, TrendingUp, BarChart3, Users, Store } from "lucide-react";

type InventoryDiscrepancy = {
  id: string;
  locationId?: string;
  createdAt?: Timestamp;
  reportedBy?: {
    id?: string;
    email?: string;
  };
};

type ShiftClosure = {
  id: string;
  locationId?: string | null;
  shiftEnd?: Timestamp;
  cashDifference?: number;
  status?: "closed" | "reopened";
  operator?: {
    id?: string;
    email?: string;
  };
};

function toDate(value: Timestamp | Date | number | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  if (typeof (value as Timestamp).toDate === "function") return (value as Timestamp).toDate();
  return null;
}

function percentChange(current: number, previous: number): number {
  if (previous === 0 && current === 0) return 0;
  if (previous === 0) return 100;
  return ((current - previous) / previous) * 100;
}

export default function ReportesPage() {
  const firestore = useFirestore();

  const { userProfile } = useAuth();
  const canAccessReports = userProfile?.role === "admin" || userProfile?.role === "manager";

  const [startDate, setStartDate] = useState(format(subDays(new Date(), 6), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [locationFilter, setLocationFilter] = useState("all");
  const [operatorFilter, setOperatorFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");

  const salesQuery = useMemoFirebase(
    () => (canAccessReports ? query(collection(firestore, "sales")) : null),
    [firestore, canAccessReports]
  );
  const locationsQuery = useMemoFirebase(
    () => (canAccessReports ? query(collection(firestore, "locations")) : null),
    [firestore, canAccessReports]
  );
  const machinesQuery = useMemoFirebase(
    () => (canAccessReports ? query(collection(firestore, "machines")) : null),
    [firestore, canAccessReports]
  );
  const discrepanciesQuery = useMemoFirebase(
    () => (canAccessReports ? query(collection(firestore, "inventoryDiscrepancies")) : null),
    [firestore, canAccessReports]
  );
  const closuresQuery = useMemoFirebase(
    () => (canAccessReports ? query(collection(firestore, "shiftClosures")) : null),
    [firestore, canAccessReports]
  );

  const { data: salesData } = useCollection<Omit<Sale, "id">>(salesQuery);
  const { data: locationsData } = useCollection<Omit<Location, "id">>(locationsQuery);
  const { data: machinesData } = useCollection<Omit<Machine, "id">>(machinesQuery);
  const { data: discrepanciesData } = useCollection<Omit<InventoryDiscrepancy, "id">>(discrepanciesQuery);
  const { data: closuresData } = useCollection<Omit<ShiftClosure, "id">>(closuresQuery);

  const sales = useMemo(() => (salesData ?? []) as Sale[], [salesData]);
  const locations = useMemo(() => (locationsData ?? []) as Location[], [locationsData]);
  const machines = useMemo(() => (machinesData ?? []) as Machine[], [machinesData]);
  const discrepancies = useMemo(() => (discrepanciesData ?? []) as InventoryDiscrepancy[], [discrepanciesData]);
  const closures = useMemo(() => (closuresData ?? []) as ShiftClosure[], [closuresData]);

  const operators = useMemo(() => {
    const map = new Map<string, string>();
    sales.forEach((sale) => {
      const id = sale.operator?.id;
      const email = sale.operator?.email;
      if (id && email) map.set(id, email);
    });
    return Array.from(map.entries()).map(([id, email]) => ({ id, email }));
  }, [sales]);

  const start = useMemo(() => startOfDay(new Date(`${startDate}T00:00:00`)), [startDate]);
  const end = useMemo(() => endOfDay(new Date(`${endDate}T23:59:59`)), [endDate]);

  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      const endTime = toDate(sale.endTime as Timestamp);
      if (!endTime) return false;
      if (endTime < start || endTime > end) return false;
      if (locationFilter !== "all" && sale.locationId !== locationFilter) return false;
      if (operatorFilter !== "all" && sale.operator?.id !== operatorFilter) return false;
      if (paymentFilter !== "all" && sale.paymentMethod !== paymentFilter) return false;
      return true;
    });
  }, [sales, start, end, locationFilter, operatorFilter, paymentFilter]);

  const filteredDiscrepancies = useMemo(() => {
    return discrepancies.filter((item) => {
      const createdAt = toDate(item.createdAt);
      if (!createdAt) return false;
      if (createdAt < start || createdAt > end) return false;
      if (locationFilter !== "all" && item.locationId !== locationFilter) return false;
      return true;
    });
  }, [discrepancies, start, end, locationFilter]);

  const filteredClosures = useMemo(() => {
    return closures.filter((item) => {
      const shiftEnd = toDate(item.shiftEnd);
      if (!shiftEnd) return false;
      if (shiftEnd < start || shiftEnd > end) return false;
      if (locationFilter !== "all" && item.locationId !== locationFilter) return false;
      return true;
    });
  }, [closures, start, end, locationFilter]);

  const totalRevenue = filteredSales.reduce((sum, sale) => sum + sale.amount, 0);
  const totalSessions = filteredSales.length;
  const avgTicket = totalSessions > 0 ? totalRevenue / totalSessions : 0;
  const productsRevenue = filteredSales.reduce((sum, sale) => {
    const prod = sale.soldProducts?.reduce((acc, p) => acc + p.quantity * p.unitPrice, 0) ?? 0;
    return sum + prod;
  }, 0);
  const cabinRevenue = totalRevenue - productsRevenue;
  const grossMargin = totalRevenue; // Margen bruto basado en ingresos al no tener costo de compra configurado.

  const occupancy = useMemo(() => {
    const visibleMachines = locationFilter === "all"
      ? machines
      : machines.filter((machine) => machine.locationId === locationFilter);
    if (visibleMachines.length === 0) return 0;
    const occupied = visibleMachines.filter((machine) => machine.status === "occupied" || machine.status === "warning").length;
    return (occupied / visibleMachines.length) * 100;
  }, [machines, locationFilter]);

  const hourlyData = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, h) => ({ hour: `${String(h).padStart(2, "0")}:00`, ventas: 0 }));
    filteredSales.forEach((sale) => {
      const date = toDate(sale.endTime as Timestamp);
      if (!date) return;
      buckets[date.getHours()].ventas += sale.amount;
    });
    return buckets.filter((x) => x.ventas > 0);
  }, [filteredSales]);

  const productMix = useMemo(() => {
    const map = new Map<string, { qty: number; amount: number }>();
    filteredSales.forEach((sale) => {
      (sale.soldProducts ?? []).forEach((item) => {
        const current = map.get(item.productName) ?? { qty: 0, amount: 0 };
        map.set(item.productName, {
          qty: current.qty + item.quantity,
          amount: current.amount + item.quantity * item.unitPrice,
        });
      });
    });
    const totalMixAmount = Array.from(map.values()).reduce((s, x) => s + x.amount, 0);
    return Array.from(map.entries())
      .map(([name, value]) => ({
        name,
        qty: value.qty,
        amount: value.amount,
        share: totalMixAmount > 0 ? (value.amount / totalMixAmount) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);
  }, [filteredSales]);

  const productivityByOperator = useMemo(() => {
    const map = new Map<string, {
      operator: string;
      sales: number;
      total: number;
      totalMinutes: number;
      errors: number;
    }>();

    filteredSales.forEach((sale) => {
      const key = sale.operator?.id || "sin-operador";
      const label = sale.operator?.email || "Sin operador";
      const current = map.get(key) ?? { operator: label, sales: 0, total: 0, totalMinutes: 0, errors: 0 };
      current.sales += 1;
      current.total += sale.amount;
      current.totalMinutes += sale.totalMinutes;
      map.set(key, current);
    });

    filteredDiscrepancies.forEach((item) => {
      const key = item.reportedBy?.id || "sin-operador";
      if (!map.has(key)) return;
      map.get(key)!.errors += 1;
    });

    filteredClosures.forEach((closure) => {
      const key = closure.operator?.id || "sin-operador";
      if (!map.has(key)) return;
      if (Math.abs(Number(closure.cashDifference ?? 0)) > 0) {
        map.get(key)!.errors += 1;
      }
    });

    return Array.from(map.values())
      .map((row) => ({
        ...row,
        avgTicket: row.sales > 0 ? row.total / row.sales : 0,
        avgAttention: row.sales > 0 ? row.totalMinutes / row.sales : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredSales, filteredDiscrepancies, filteredClosures]);

  const byLocation = useMemo(() => {
    const map = new Map<string, { location: string; total: number; sessions: number; occupancy: number }>();
    locations.forEach((location) => {
      const baseMachines = machines.filter((m) => m.locationId === location.id);
      const occupied = baseMachines.filter((m) => m.status === "occupied" || m.status === "warning").length;
      map.set(location.id, {
        location: location.name,
        total: 0,
        sessions: 0,
        occupancy: baseMachines.length > 0 ? (occupied / baseMachines.length) * 100 : 0,
      });
    });

    sales.forEach((sale) => {
      const endTime = toDate(sale.endTime as Timestamp);
      if (!endTime || endTime < start || endTime > end) return;
      if (!sale.locationId || !map.has(sale.locationId)) return;
      const row = map.get(sale.locationId)!;
      row.total += sale.amount;
      row.sessions += 1;
    });

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [locations, machines, sales, start, end]);

  const comparative = useMemo(() => {
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());
    const yesterdayStart = startOfDay(subDays(new Date(), 1));
    const yesterdayEnd = endOfDay(subDays(new Date(), 1));

    const thisWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const thisWeekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
    const prevWeekStart = startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 });
    const prevWeekEnd = endOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 });

    const baseFilter = (sale: Sale, from: Date, to: Date) => {
      const endTime = toDate(sale.endTime as Timestamp);
      if (!endTime || endTime < from || endTime > to) return false;
      if (locationFilter !== "all" && sale.locationId !== locationFilter) return false;
      if (operatorFilter !== "all" && sale.operator?.id !== operatorFilter) return false;
      if (paymentFilter !== "all" && sale.paymentMethod !== paymentFilter) return false;
      return true;
    };

    const today = sales.filter((sale) => baseFilter(sale, todayStart, todayEnd)).reduce((sum, s) => sum + s.amount, 0);
    const yesterday = sales.filter((sale) => baseFilter(sale, yesterdayStart, yesterdayEnd)).reduce((sum, s) => sum + s.amount, 0);
    const thisWeek = sales.filter((sale) => baseFilter(sale, thisWeekStart, thisWeekEnd)).reduce((sum, s) => sum + s.amount, 0);
    const prevWeek = sales.filter((sale) => baseFilter(sale, prevWeekStart, prevWeekEnd)).reduce((sum, s) => sum + s.amount, 0);

    return {
      today,
      yesterday,
      todayDiff: percentChange(today, yesterday),
      thisWeek,
      prevWeek,
      weekDiff: percentChange(thisWeek, prevWeek),
    };
  }, [sales, locationFilter, operatorFilter, paymentFilter]);

  const closureConsolidated = useMemo(() => {
    const grouped = new Map<string, { location: string; closed: number; reopened: number; cashDiff: number }>();

    filteredClosures.forEach((closure) => {
      const locationName = locations.find((l) => l.id === closure.locationId)?.name || "Sin local";
      const key = closure.locationId || "sin-local";
      const current = grouped.get(key) ?? { location: locationName, closed: 0, reopened: 0, cashDiff: 0 };
      if (closure.status === "reopened") current.reopened += 1;
      else current.closed += 1;
      current.cashDiff += Number(closure.cashDifference || 0);
      grouped.set(key, current);
    });

    return Array.from(grouped.values()).sort((a, b) => b.closed - a.closed);
  }, [filteredClosures, locations]);

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.setFontSize(16);
    doc.text("Cabine Grid - Reporte Ejecutivo", 40, 36);
    doc.setFontSize(10);
    doc.text(`Rango: ${startDate} a ${endDate}`, 40, 54);
    doc.text(`Local: ${locationFilter === "all" ? "Todos" : (locations.find((l) => l.id === locationFilter)?.name || locationFilter)}`, 40, 68);

    autoTable(doc, {
      startY: 84,
      head: [["KPI", "Valor"]],
      body: [
        ["Ingresos totales", formatCurrency(totalRevenue)],
        ["Sesiones", String(totalSessions)],
        ["Ticket promedio", formatCurrency(avgTicket)],
        ["Ingresos cabinas", formatCurrency(cabinRevenue)],
        ["Ingresos TPV", formatCurrency(productsRevenue)],
        ["Margen bruto", formatCurrency(grossMargin)],
        ["Ocupación", `${occupancy.toFixed(1)}%`],
      ],
      styles: { fontSize: 9 },
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 14,
      head: [["Operador", "Ventas", "Total", "Ticket", "Atención Prom.", "Errores"]],
      body: productivityByOperator.map((row) => [
        row.operator,
        String(row.sales),
        formatCurrency(row.total),
        formatCurrency(row.avgTicket),
        formatDuration(row.avgAttention),
        String(row.errors),
      ]),
      styles: { fontSize: 8 },
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 14,
      head: [["Local", "Ingresos", "Sesiones", "Ocupación"]],
      body: byLocation.map((row) => [
        row.location,
        formatCurrency(row.total),
        String(row.sessions),
        `${row.occupancy.toFixed(1)}%`,
      ]),
      styles: { fontSize: 8 },
    });

    doc.save(`reporte-ejecutivo-${startDate}-${endDate}.pdf`);
  };

  const exportExcel = () => {
    const workbook = XLSX.utils.book_new();

    const resumenSheet = XLSX.utils.json_to_sheet([
      {
        rango_desde: startDate,
        rango_hasta: endDate,
        ingresos_totales: totalRevenue,
        sesiones: totalSessions,
        ticket_promedio: avgTicket,
        ingresos_cabinas: cabinRevenue,
        ingresos_tpv: productsRevenue,
        margen_bruto: grossMargin,
        ocupacion: Number(occupancy.toFixed(2)),
      },
    ]);

    const ventasSheet = XLSX.utils.json_to_sheet(
      filteredSales.map((sale) => ({
        boleta: sale.receiptNumber || "",
        fecha_fin: toDate(sale.endTime as Timestamp)?.toISOString() || "",
        local: sale.locationId || "",
        cabina: sale.machineName,
        cliente: sale.clientName || "Ocasional",
        operador: sale.operator?.email || "",
        metodo_pago: sale.paymentMethod,
        minutos: sale.totalMinutes,
        monto: sale.amount,
      }))
    );

    const operadoresSheet = XLSX.utils.json_to_sheet(
      productivityByOperator.map((row) => ({
        operador: row.operator,
        ventas: row.sales,
        total: row.total,
        ticket_promedio: row.avgTicket,
        atencion_promedio_min: Number(row.avgAttention.toFixed(2)),
        errores: row.errors,
      }))
    );

    const mixSheet = XLSX.utils.json_to_sheet(
      productMix.map((row) => ({
        producto: row.name,
        cantidad: row.qty,
        monto: row.amount,
        participacion_pct: Number(row.share.toFixed(2)),
      }))
    );

    const localesSheet = XLSX.utils.json_to_sheet(
      byLocation.map((row) => ({
        local: row.location,
        ingresos: row.total,
        sesiones: row.sessions,
        ocupacion_pct: Number(row.occupancy.toFixed(2)),
      }))
    );

    const cierresSheet = XLSX.utils.json_to_sheet(
      closureConsolidated.map((row) => ({
        local: row.location,
        cierres: row.closed,
        reabiertos: row.reopened,
        diferencia_caja_total: row.cashDiff,
      }))
    );

    XLSX.utils.book_append_sheet(workbook, resumenSheet, "Resumen");
    XLSX.utils.book_append_sheet(workbook, ventasSheet, "Ventas Filtradas");
    XLSX.utils.book_append_sheet(workbook, operadoresSheet, "Productividad");
    XLSX.utils.book_append_sheet(workbook, mixSheet, "Mix Productos");
    XLSX.utils.book_append_sheet(workbook, localesSheet, "Locales");
    XLSX.utils.book_append_sheet(workbook, cierresSheet, "Cierres");

    XLSX.writeFile(workbook, `reporte-ejecutivo-${startDate}-${endDate}.xlsx`);
  };

  const locationLabel = locationFilter === "all"
    ? "Todos los locales"
    : (locations.find((l) => l.id === locationFilter)?.name || locationFilter);

  return (
    <RoleGuard requiredRoles={["admin", "manager"]}>
      <div className="min-h-screen bg-secondary">
        <div className="border-b border-border/50 bg-card/80 backdrop-blur-lg sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl font-headline font-bold">Reportes Ejecutivos</h1>
              <p className="text-sm text-muted-foreground">Panel financiero y operativo consolidado por local.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="gap-2" onClick={exportPdf}>
                <FileText className="w-4 h-4" /> Exportar PDF
              </Button>
              <Button variant="outline" className="gap-2" onClick={exportExcel}>
                <FileSpreadsheet className="w-4 h-4" /> Exportar Excel
              </Button>
              <Link href="/">
                <Button variant="outline" className="gap-2">
                  <ArrowLeft className="w-4 h-4" /> Volver
                </Button>
              </Link>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Filter className="w-5 h-5" /> Filtros de reporte</CardTitle>
              <CardDescription>Filtra por fecha, local, operador y método de pago para análisis y exportación.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label>Desde</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Hasta</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Local</Label>
                <Select value={locationFilter} onValueChange={setLocationFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {locations.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Operador</Label>
                <Select value={operatorFilter} onValueChange={setOperatorFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {operators.map((op) => (
                      <SelectItem key={op.id} value={op.id}>{op.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Método de pago</Label>
                <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="yape">Yape/Plin</SelectItem>
                    <SelectItem value="otro">Tarjeta/Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">Ingresos ({locationLabel})</div>
                <div className="text-2xl font-black mt-1">{formatCurrency(totalRevenue)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">Ticket promedio</div>
                <div className="text-2xl font-black mt-1">{formatCurrency(avgTicket)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">Margen bruto</div>
                <div className="text-2xl font-black mt-1">{formatCurrency(grossMargin)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">Ocupación actual</div>
                <div className="text-2xl font-black mt-1">{occupancy.toFixed(1)}%</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><TrendingUp className="w-5 h-5" /> Ventas por hora</CardTitle>
                <CardDescription>Distribución horaria de ingresos en el rango filtrado.</CardDescription>
              </CardHeader>
              <CardContent className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip formatter={(value: number) => formatCurrency(Number(value))} />
                    <Legend />
                    <Bar dataKey="ventas" fill="#0ea5e9" name="Ventas" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><BarChart3 className="w-5 h-5" /> Mix de productos</CardTitle>
                <CardDescription>Participación de ingresos TPV por producto.</CardDescription>
              </CardHeader>
              <CardContent className="h-[280px]">
                {productMix.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No hay ventas de productos en este rango.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={productMix}
                        dataKey="amount"
                        nameKey="name"
                        outerRadius={95}
                        label={(entry) => `${entry.name} (${entry.share.toFixed(1)}%)`}
                      />
                      <Tooltip formatter={(value: number) => formatCurrency(Number(value))} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Reportes comparativos</CardTitle>
                <CardDescription>Hoy vs ayer y semana actual vs anterior.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg border p-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm text-muted-foreground">Hoy vs Ayer</div>
                    <div className="font-semibold">{formatCurrency(comparative.today)} vs {formatCurrency(comparative.yesterday)}</div>
                  </div>
                  <Badge variant={comparative.todayDiff >= 0 ? "default" : "secondary"}>
                    {comparative.todayDiff >= 0 ? "+" : ""}{comparative.todayDiff.toFixed(1)}%
                  </Badge>
                </div>
                <div className="rounded-lg border p-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm text-muted-foreground">Semana actual vs anterior</div>
                    <div className="font-semibold">{formatCurrency(comparative.thisWeek)} vs {formatCurrency(comparative.prevWeek)}</div>
                  </div>
                  <Badge variant={comparative.weekDiff >= 0 ? "default" : "secondary"}>
                    {comparative.weekDiff >= 0 ? "+" : ""}{comparative.weekDiff.toFixed(1)}%
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Store className="w-5 h-5" /> Local vs local</CardTitle>
                <CardDescription>Comparativo consolidado entre locales en el rango.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Local</TableHead>
                        <TableHead className="text-right">Ingresos</TableHead>
                        <TableHead className="text-right">Sesiones</TableHead>
                        <TableHead className="text-right">Ocupación</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {byLocation.map((row) => (
                        <TableRow key={row.location}>
                          <TableCell>{row.location}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(row.total)}</TableCell>
                          <TableCell className="text-right">{row.sessions}</TableCell>
                          <TableCell className="text-right">{row.occupancy.toFixed(1)}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5" /> Productividad por operador</CardTitle>
              <CardDescription>Ventas, errores e indicadores de atención por operador.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Operador</TableHead>
                      <TableHead className="text-right">Ventas</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Ticket Prom.</TableHead>
                      <TableHead className="text-right">Atención Prom.</TableHead>
                      <TableHead className="text-right">Errores</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productivityByOperator.map((row) => (
                      <TableRow key={row.operator}>
                        <TableCell>{row.operator}</TableCell>
                        <TableCell className="text-right">{row.sales}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(row.total)}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(row.avgTicket)}</TableCell>
                        <TableCell className="text-right">{formatDuration(row.avgAttention)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={row.errors > 0 ? "secondary" : "default"}>{row.errors}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cierres consolidados multi-local</CardTitle>
              <CardDescription>Visión global de cierres y diferencias de caja por local.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Local</TableHead>
                      <TableHead className="text-right">Cierres</TableHead>
                      <TableHead className="text-right">Reabiertos</TableHead>
                      <TableHead className="text-right">Dif. Caja Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {closureConsolidated.map((row) => (
                      <TableRow key={row.location}>
                        <TableCell>{row.location}</TableCell>
                        <TableCell className="text-right">{row.closed}</TableCell>
                        <TableCell className="text-right">{row.reopened}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(row.cashDiff)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </RoleGuard>
  );
}
