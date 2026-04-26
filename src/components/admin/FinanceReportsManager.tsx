"use client";

import { useMemo, useState, type ElementType } from "react";
import type { Station, Location, PaymentMethod, Sale, UserProfile } from "@/lib/types";
import type { Timestamp } from "firebase/firestore";
import {
  buildFinanceAnalytics,
  type AuditLogLike,
  type ConsolidatedClosure,
  type ExecutiveLocationSummary,
  type ReportFilters,
} from "@/lib/finance-analytics";
import { exportFinanceExcel, exportFinancePdf } from "@/lib/finance-export";
import { formatCurrency, formatDuration } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { BrainCircuit, Download, FileText, Building2, TrendingUp, AlertTriangle } from "lucide-react";

type ShiftClosureLike = {
  id: string;
  locationId?: string | null;
  totalSales?: number;
  expectedCash?: number;
  countedCash?: number;
  cashDifference?: number;
  salesCount?: number;
};

type FinanceReportsManagerProps = {
  sales: Sale[];
  machines: Station[];
  locations: Location[];
  users: UserProfile[];
  auditLogs: AuditLogLike[];
  closures: ShiftClosureLike[];
};

const MIX_COLORS = ["#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6", "#f97316", "#64748b"];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatVariation(value: number): string {
  if (!Number.isFinite(value)) return "0.0%";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function resolveLocationLabel(locationId: string, locationsMap: Map<string, string>): string {
  if (locationId === "sin-local") return "Sin local";
  return locationsMap.get(locationId) || locationId;
}

function toDate(value: Timestamp | Date | number): Date {
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  return value.toDate();
}

export default function FinanceReportsManager({ sales, machines, locations, users, auditLogs, closures }: FinanceReportsManagerProps) {
  const [filters, setFilters] = useState<ReportFilters>({
    startDate: todayISO(),
    endDate: todayISO(),
    locationId: "all",
    operatorId: "all",
    paymentMethod: "all",
  });

  const locationsMap = useMemo(() => {
    const map = new Map<string, string>();
    locations.forEach((location) => map.set(location.id, location.name));
    return map;
  }, [locations]);

  const operatorOptions = useMemo(() => {
    const byId = new Map<string, string>();
    users.forEach((user) => byId.set(user.uid, user.email || user.name || user.uid));
    sales.forEach((sale) => {
      if (sale.operator?.id) {
        byId.set(sale.operator.id, sale.operator.email || sale.operator.id);
      }
    });
    return Array.from(byId.entries()).map(([id, email]) => ({ id, email })).sort((a, b) => a.email.localeCompare(b.email));
  }, [users, sales]);

  const analytics = useMemo(() => {
    return buildFinanceAnalytics({
      sales,
      machines,
      filters,
      auditLogs,
      closures,
    });
  }, [sales, machines, filters, auditLogs, closures]);

  const globalRevenue = analytics.filteredSales.reduce((sum, sale) => sum + sale.amount, 0);
  const globalSalesCount = analytics.filteredSales.length;
  const globalAvgTicket = globalSalesCount > 0 ? globalRevenue / globalSalesCount : 0;
  const weightedMargin = analytics.executiveByLocation.reduce((sum, item) => sum + item.estimatedMargin, 0);
  const weightedMarginPercent = globalRevenue > 0 ? (weightedMargin / globalRevenue) * 100 : 0;

  const topLocation = analytics.executiveByLocation[0];

  const financialForecast = useMemo(() => {
    const now = Date.now();
    const lastThreeHoursMs = now - (3 * 60 * 60 * 1000);
    const recentSales = analytics.filteredSales.filter((sale) => {
      const end = sale.endTime as Timestamp;
      return end?.toMillis?.() >= lastThreeHoursMs;
    });

    const recentRevenue = recentSales.reduce((sum, sale) => sum + sale.amount, 0);
    const hourlyRecentRevenue = recentRevenue / 3;
    const hourlyBaseline = globalRevenue / Math.max(1, new Date().getHours() + 1);
    const projectedRevenue = (hourlyRecentRevenue * 0.65) + (hourlyBaseline * 0.35);
    const projectedSalesCount = Math.max(1, Math.round((recentSales.length / 3) * 0.7 + (globalSalesCount / Math.max(1, new Date().getHours() + 1)) * 0.3));

    return {
      projectedRevenue,
      projectedSalesCount,
    };
  }, [analytics.filteredSales, globalRevenue, globalSalesCount]);

  const filteredRiskLogs = useMemo(
    () =>
      auditLogs.filter((log) => {
        if (filters.locationId && filters.locationId !== "all" && (log.locationId || "sin-local") !== filters.locationId) {
          return false;
        }
        return true;
      }),
    [auditLogs, filters.locationId]
  );

  const riskExposure = useMemo(() => {
    const criticalOrHigh = filteredRiskLogs.filter(
      (log) => log.severity === "critical" || log.severity === "high" || (log.anomalyScore || 0) >= 60
    );
    const avgRisk = filteredRiskLogs.length > 0
      ? filteredRiskLogs.reduce((sum, log) => sum + (log.anomalyScore || 0), 0) / filteredRiskLogs.length
      : 0;

    return {
      criticalOrHighCount: criticalOrHigh.length,
      averageRisk: avgRisk,
    };
  }, [filteredRiskLogs]);

  const financeInsights = useMemo(() => {
    const insights: Array<{ title: string; detail: string; action: string; tone: "good" | "warn" | "neutral" }> = [];

    if (financialForecast.projectedRevenue > 0) {
      insights.push({
        title: "Proxima hora",
        detail: `Proyeccion ${formatCurrency(financialForecast.projectedRevenue)} en ${financialForecast.projectedSalesCount} venta(s).`,
        action: "Refuerza operador en hora pico y valida stock top.",
        tone: "neutral",
      });
    }

    const worstComparative = [...analytics.todayVsYesterday].sort((a, b) => a.variationPercent - b.variationPercent)[0];
    if (worstComparative && worstComparative.variationPercent < -8) {
      insights.push({
        title: "Caida relevante",
        detail: `${worstComparative.title} cae ${formatVariation(worstComparative.variationPercent)} vs ayer.`,
        action: "Revisa operador, disponibilidad de cabinas y mix de productos en el turno actual.",
        tone: "warn",
      });
    }

    if (riskExposure.criticalOrHighCount > 0) {
      insights.push({
        title: "Riesgo operativo",
        detail: `${riskExposure.criticalOrHighCount} evento(s) de alto riesgo en auditoria para este filtro.`,
        action: "Abrir modulo de auditoria y cerrar hallazgos antes del cierre de caja.",
        tone: "warn",
      });
    }

    if (insights.length === 0) {
      insights.push({
        title: "Operacion estable",
        detail: "Indicadores sin desviaciones fuertes en el rango seleccionado.",
        action: "Mantener ritmo y validar cumplimiento de cierres.",
        tone: "good",
      });
    }

    return insights.slice(0, 3);
  }, [financialForecast, analytics.todayVsYesterday, riskExposure]);

  const exportPdf = () => {
    exportFinancePdf({
      sales: analytics.filteredSales,
      filters,
      locationsMap,
      executiveByLocation: analytics.executiveByLocation,
      operatorProductivity: analytics.operatorProductivity,
    });
  };

  const exportExcel = () => {
    exportFinanceExcel({
      sales: analytics.filteredSales,
      filters,
      locationsMap,
      executiveByLocation: analytics.executiveByLocation,
      operatorProductivity: analytics.operatorProductivity,
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Filtros de Reporte</CardTitle>
          <CardDescription>
            Exporta PDF y Excel con rango de fechas, local, operador y metodo de pago.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
          <div className="space-y-2">
            <Label>Fecha inicio</Label>
            <input
              type="date"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={filters.startDate}
              onChange={(event) => setFilters((prev) => ({ ...prev, startDate: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Fecha fin</Label>
            <input
              type="date"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={filters.endDate}
              onChange={(event) => setFilters((prev) => ({ ...prev, endDate: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Local</Label>
            <Select value={filters.locationId || "all"} onValueChange={(value) => setFilters((prev) => ({ ...prev, locationId: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {locations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Operador</Label>
            <Select value={filters.operatorId || "all"} onValueChange={(value) => setFilters((prev) => ({ ...prev, operatorId: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {operatorOptions.map((operator) => (
                  <SelectItem key={operator.id} value={operator.id}>{operator.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Metodo de pago</Label>
            <Select
              value={filters.paymentMethod || "all"}
              onValueChange={(value) => setFilters((prev) => ({ ...prev, paymentMethod: value as PaymentMethod | "all" }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="efectivo">Efectivo</SelectItem>
                <SelectItem value="yape">Yape/Plin</SelectItem>
                <SelectItem value="otro">Tarjeta/Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Exportar</Label>
            <div className="flex gap-2">
              <Button variant="outline" className="w-full" onClick={exportPdf}>
                <FileText className="w-4 h-4 mr-2" /> PDF
              </Button>
              <Button className="w-full" onClick={exportExcel}>
                <Download className="w-4 h-4 mr-2" /> Excel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard title="Ingresos" value={formatCurrency(globalRevenue)} subtitle={`${globalSalesCount} ventas`} icon={TrendingUp} />
        <MetricCard title="Ticket promedio" value={formatCurrency(globalAvgTicket)} subtitle="Promedio por venta" icon={Building2} />
        <MetricCard title="Margen estimado" value={formatCurrency(weightedMargin)} subtitle={`${weightedMarginPercent.toFixed(1)}% sobre ingresos`} icon={TrendingUp} />
        <MetricCard
          title="Local lider"
          value={topLocation ? resolveLocationLabel(topLocation.locationId, locationsMap) : "Sin datos"}
          subtitle={topLocation ? `${formatCurrency(topLocation.revenue)} en ingresos` : "No hay ventas en filtros"}
          icon={Building2}
        />
      </div>

      <Card className="surface-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BrainCircuit className="w-5 h-5 text-accent" /> Copiloto financiero
          </CardTitle>
          <CardDescription>
            Recomendaciones automaticas por tendencia, riesgo y proyeccion de la proxima hora.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {financeInsights.map((insight, index) => (
            <div
              key={`${insight.title}-${index}`}
              className={`rounded-lg border p-3 space-y-2 ${
                insight.tone === "warn"
                  ? "border-amber-300/50 bg-amber-500/10"
                  : insight.tone === "good"
                    ? "border-green-300/50 bg-green-500/10"
                    : "border-border/50 bg-background/70"
              }`}
            >
              <p className="text-sm font-semibold">{insight.title}</p>
              <p className="text-xs text-muted-foreground">{insight.detail}</p>
              <p className="text-xs font-medium">{insight.action}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Tabs defaultValue="executive" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="executive">Dashboard Ejecutivo</TabsTrigger>
          <TabsTrigger value="comparative">Comparativos</TabsTrigger>
          <TabsTrigger value="operators">Operadores</TabsTrigger>
          <TabsTrigger value="closures">Cierres Consolidados</TabsTrigger>
          <TabsTrigger value="detail">Detalle</TabsTrigger>
        </TabsList>

        <TabsContent value="executive" className="space-y-4 mt-4">
          {analytics.executiveByLocation.length === 0 ? (
            <Card><CardContent className="pt-6 text-sm text-muted-foreground">No hay datos para los filtros seleccionados.</CardContent></Card>
          ) : (
            analytics.executiveByLocation.map((location) => (
              <ExecutiveLocationCard
                key={location.locationId}
                location={location}
                locationName={resolveLocationLabel(location.locationId, locationsMap)}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="comparative" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Hoy vs Ayer</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-4">
              {analytics.todayVsYesterday.map((item) => (
                <ComparisonCard key={item.title} title={item.title} currentValue={item.currentValue} previousValue={item.previousValue} variationPercent={item.variationPercent} />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Semana Actual vs Semana Anterior</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-4">
              {analytics.weekVsPreviousWeek.map((item) => (
                <ComparisonCard key={item.title} title={item.title} currentValue={item.currentValue} previousValue={item.previousValue} variationPercent={item.variationPercent} />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Local vs Local</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Local</TableHead>
                    <TableHead className="text-right">Ingresos</TableHead>
                    <TableHead className="text-right">Ventas</TableHead>
                    <TableHead className="text-right">Ticket Promedio</TableHead>
                    <TableHead className="text-right">% Margen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics.localComparison.map((item) => (
                    <TableRow key={item.locationId}>
                      <TableCell>{resolveLocationLabel(item.locationId, locationsMap)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(item.revenue)}</TableCell>
                      <TableCell className="text-right">{item.salesCount}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(item.avgTicket)}</TableCell>
                      <TableCell className="text-right">{item.marginPercent.toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="operators" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Productividad por Operador</CardTitle>
              <CardDescription>
                Ventas, errores, incongruencias y tiempos de atencion por operador.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Operador</TableHead>
                    <TableHead className="text-right">Ventas</TableHead>
                    <TableHead className="text-right">Ingresos</TableHead>
                    <TableHead className="text-right">Tiempo de Atencion</TableHead>
                    <TableHead className="text-right">Errores</TableHead>
                    <TableHead className="text-right">Incongruencias</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics.operatorProductivity.map((operator) => (
                    <TableRow key={operator.operatorId}>
                      <TableCell>{operator.operatorEmail}</TableCell>
                      <TableCell className="text-right">{operator.salesCount}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(operator.revenue)}</TableCell>
                      <TableCell className="text-right">{formatDuration(operator.averageAttentionMinutes)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={operator.errorsCount > 0 ? "destructive" : "secondary"}>{operator.errorsCount}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={operator.inconsistenciesCount > 0 ? "destructive" : "secondary"}>{operator.inconsistenciesCount}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="closures" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Vision Global de Cierres Multi-local</CardTitle>
              <CardDescription>
                Consolidado para dueno y gerencia general con diferencias de caja y ventas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ConsolidatedClosuresTable locationsMap={locationsMap} closures={analytics.consolidatedClosures} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="detail" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Detalle de Ventas Filtradas</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Local</TableHead>
                    <TableHead>Operador</TableHead>
                    <TableHead>Cabina</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead>Pago</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics.filteredSales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell>{toDate(sale.endTime as Timestamp).toLocaleString("es-PE")}</TableCell>
                      <TableCell>{resolveLocationLabel(sale.locationId || "sin-local", locationsMap)}</TableCell>
                      <TableCell>{sale.operator?.email || "No identificado"}</TableCell>
                      <TableCell>{sale.machineName}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(sale.amount)}</TableCell>
                      <TableCell className="capitalize">{sale.paymentMethod}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: ElementType;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm text-muted-foreground">{title}</div>
            <div className="text-2xl font-black leading-tight">{value}</div>
            <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>
          </div>
          <div className="rounded-md bg-primary/15 p-2">
            <Icon className="w-5 h-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ComparisonCard({
  title,
  currentValue,
  previousValue,
  variationPercent,
}: {
  title: string;
  currentValue: number;
  previousValue: number;
  variationPercent: number;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="text-sm text-muted-foreground">Actual: {title === "Sesiones" ? Math.round(currentValue) : formatCurrency(currentValue)}</div>
        <div className="text-sm text-muted-foreground">Anterior: {title === "Sesiones" ? Math.round(previousValue) : formatCurrency(previousValue)}</div>
        <div className={`text-sm font-semibold ${variationPercent >= 0 ? "text-green-600" : "text-red-600"}`}>
          Variacion: {formatVariation(variationPercent)}
        </div>
      </CardContent>
    </Card>
  );
}

function ExecutiveLocationCard({ location, locationName }: { location: ExecutiveLocationSummary; locationName: string }) {
  const mixChartData = location.productsMix.map((item) => ({ name: item.productName, value: item.revenue }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="w-5 h-5" /> {locationName}
        </CardTitle>
        <CardDescription>
          Ventas por hora, ticket promedio, mix de productos, margen y ocupacion.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid xl:grid-cols-3 gap-6">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <MiniStat title="Ingresos" value={formatCurrency(location.revenue)} />
            <MiniStat title="Ticket" value={formatCurrency(location.avgTicket)} />
            <MiniStat title="Margen" value={formatCurrency(location.estimatedMargin)} />
            <MiniStat title="Ocupacion" value={`${location.occupancyPercent.toFixed(1)}%`} />
          </div>

          <div className="h-64 rounded-lg border p-3">
            <div className="text-sm font-semibold mb-2">Ventas por hora</div>
            <ResponsiveContainer width="100%" height="90%">
              <BarChart data={location.hourlySales}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={2} />
                <YAxis tickFormatter={(value) => formatCurrency(Number(value))} tick={{ fontSize: 10 }} width={70} />
                <Tooltip formatter={(value: number) => formatCurrency(Number(value))} />
                <Bar dataKey="revenue" fill="#0ea5e9" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="xl:col-span-2 grid md:grid-cols-2 gap-4">
          <div className="rounded-lg border p-3">
            <div className="text-sm font-semibold mb-2">Mix de Productos</div>
            {mixChartData.length === 0 ? (
              <div className="text-sm text-muted-foreground">No hay ventas de productos en este rango.</div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={mixChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label>
                      {mixChartData.map((_, index) => (
                        <Cell key={`mix-${index}`} fill={MIX_COLORS[index % MIX_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="rounded-lg border p-3">
            <div className="text-sm font-semibold mb-2">Top productos</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Unidades</TableHead>
                  <TableHead className="text-right">Ingreso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {location.productsMix.map((item) => (
                  <TableRow key={`${location.locationId}-${item.productName}`}>
                    <TableCell>{item.productName}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(item.revenue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-3 text-xs text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Margen estimado calculado con costo operativo referencial de servicio (35%) y productos (65%).
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniStat({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-md border p-2">
      <div className="text-xs text-muted-foreground">{title}</div>
      <div className="text-base font-bold">{value}</div>
    </div>
  );
}

function ConsolidatedClosuresTable({ locationsMap, closures }: { locationsMap: Map<string, string>; closures: ConsolidatedClosure[] }) {
  if (closures.length === 0) {
    return <div className="text-sm text-muted-foreground">No hay cierres consolidados disponibles.</div>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Local</TableHead>
          <TableHead className="text-right">Ventas</TableHead>
          <TableHead className="text-right">Total vendido</TableHead>
          <TableHead className="text-right">Caja esperada</TableHead>
          <TableHead className="text-right">Caja contada</TableHead>
          <TableHead className="text-right">Diferencia</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {closures.map((closure) => (
          <TableRow key={`closure-${closure.locationId}`}>
            <TableCell>{resolveLocationLabel(closure.locationId, locationsMap)}</TableCell>
            <TableCell className="text-right">{closure.salesCount}</TableCell>
            <TableCell className="text-right font-mono">{formatCurrency(closure.totalSales)}</TableCell>
            <TableCell className="text-right font-mono">{formatCurrency(closure.expectedCash)}</TableCell>
            <TableCell className="text-right font-mono">{formatCurrency(closure.countedCash)}</TableCell>
            <TableCell className={`text-right font-mono ${Math.abs(closure.cashDifference) > 0 ? "text-red-600" : "text-green-600"}`}>
              {formatCurrency(closure.cashDifference)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
