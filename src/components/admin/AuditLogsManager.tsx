"use client";

import { useMemo, useState } from "react";
import type { Location, UserProfile } from "@/lib/types";
import type { Timestamp } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Pagination from "@/components/ui/pagination";
import { usePagination } from "@/hooks/usePagination";
import { AlertTriangle, ShieldAlert, Trash2, User, Clock } from "lucide-react";

export type AuditLogRecord = {
  id: string;
  action: string;
  target: string;
  targetId?: string | null;
  locationId?: string | null;
  details?: Record<string, unknown>;
  actor?: {
    id?: string | null;
    email?: string | null;
    role?: string | null;
  };
  createdAt?: Timestamp;
  createdAtMs?: number;
  severity?: "low" | "medium" | "high" | "critical";
  anomalyScore?: number;
  riskTags?: string[];
};

type AuditLogsManagerProps = {
  logs: AuditLogRecord[];
  locations: Location[];
  users: UserProfile[];
};

function toDate(log: AuditLogRecord): Date {
  if (typeof log.createdAtMs === "number") return new Date(log.createdAtMs);
  if (log.createdAt) return log.createdAt.toDate();
  return new Date();
}

function severityVariant(value?: AuditLogRecord["severity"]): "default" | "secondary" | "destructive" | "outline" {
  if (value === "critical") return "destructive";
  if (value === "high") return "destructive";
  if (value === "medium") return "default";
  if (value === "low") return "secondary";
  return "outline";
}

function explainRisk(log: AuditLogRecord): { reason: string; action: string } {
  const tags = log.riskTags || [];
  const score = log.anomalyScore || 0;

  if (tags.includes("destructive-action") || /delete|deactivate/i.test(log.action)) {
    return {
      reason: "Accion destructiva detectada sobre datos operativos.",
      action: "Validar autorizacion y revisar bitacora del mismo operador en las ultimas 2 horas.",
    };
  }

  if (/shift\.reopen|closure/i.test(log.action)) {
    return {
      reason: "Cambio en cierre de turno con impacto en control de caja.",
      action: "Confirmar motivo documentado y conciliar ventas vs efectivo contado.",
    };
  }

  if (/inventory|stock/i.test(log.action) || tags.includes("inventory-risk")) {
    return {
      reason: "Movimiento de inventario con posible impacto en margen y disponibilidad.",
      action: "Cruzar con ajustes del turno y verificar diferencia fisica del producto.",
    };
  }

  if (score >= 75) {
    return {
      reason: "Patron atipico de alta severidad segun puntaje de riesgo.",
      action: "Escalar a supervisor y congelar cambios sensibles hasta validacion.",
    };
  }

  return {
    reason: "Evento con riesgo operativo moderado.",
    action: "Monitorear recurrencia y documentar seguimiento en el cierre del turno.",
  };
}

export default function AuditLogsManager({ logs, locations, users }: AuditLogsManagerProps) {
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("all");
  const [operatorFilter, setOperatorFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");

  const locationsMap = useMemo(() => {
    const map = new Map<string, string>();
    locations.forEach((location) => map.set(location.id, location.name));
    return map;
  }, [locations]);

  const operators = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((user) => map.set(user.uid, user.email || user.name || user.uid));
    logs.forEach((log) => {
      if (log.actor?.id) {
        map.set(log.actor.id, log.actor.email || log.actor.id);
      }
    });
    return Array.from(map.entries()).map(([id, email]) => ({ id, email })).sort((a, b) => a.email.localeCompare(b.email));
  }, [users, logs]);

  const filtered = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return logs
      .filter((log) => {
        if (locationFilter !== "all" && (log.locationId || "sin-local") !== locationFilter) return false;
        if (operatorFilter !== "all" && (log.actor?.id || "sin-operador") !== operatorFilter) return false;
        if (severityFilter !== "all" && (log.severity || "low") !== severityFilter) return false;

        if (!normalizedSearch) return true;
        const haystack = [
          log.action,
          log.target,
          log.targetId || "",
          log.actor?.email || "",
          JSON.stringify(log.details || {}),
          (log.riskTags || []).join(" "),
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(normalizedSearch);
      })
      .sort((a, b) => toDate(b).getTime() - toDate(a).getTime());
  }, [logs, locationFilter, operatorFilter, severityFilter, search]);

  const anomalies = useMemo(() => filtered.filter((log) => (log.anomalyScore || 0) >= 60), [filtered]);
  const {
    paginatedItems,
    currentPage,
    totalPages,
    pageSize,
    onPageChange,
    onPageSizeChange,
  } = usePagination(filtered, 15);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5" /> Auditoria y Deteccion de Anomalias
          </CardTitle>
          <CardDescription>
            Registro permanente de acciones con filtros por local, operador, severidad y busqueda textual.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="space-y-2 xl:col-span-2">
            <Label>Buscar accion / detalle</Label>
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ej. shift.close, inventory.adjust, delete..." />
            
            <div className="flex flex-wrap gap-2 mt-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="text-[10px] h-6 px-2 bg-zinc-900/40 border-rose-500/30 hover:bg-rose-500/10 text-rose-400"
                onClick={() => { setSeverityFilter('critical'); setSearch(''); }}
              >
                🚨 Acciones Críticas
              </Button>
              
              <Button 
                variant="outline" 
                size="sm" 
                className="text-[10px] h-6 px-2 bg-zinc-900/40 border-amber-500/30 hover:bg-amber-500/10 text-amber-400"
                onClick={() => { setSeverityFilter('all'); setSearch('void'); }}
              >
                ❌ Anulaciones
              </Button>

              <Button 
                variant="outline" 
                size="sm" 
                className="text-[10px] h-6 px-2 bg-zinc-900/40 border-blue-500/30 hover:bg-blue-500/10 text-blue-400"
                onClick={() => { setSeverityFilter('all'); setSearch('drawer'); }}
              >
                💵 Apertura de Caja
              </Button>

              {(severityFilter !== 'all' || search !== '') && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-[10px] h-6 px-2 text-zinc-500 hover:text-zinc-300"
                  onClick={() => { setSeverityFilter('all'); setSearch(''); }}
                >
                  Limpiar filtros
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Local</Label>
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="sin-local">Sin local</SelectItem>
                {locations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Operador</Label>
            <Select value={operatorFilter} onValueChange={setOperatorFilter}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="sin-operador">Sin operador</SelectItem>
                {operators.map((operator) => (
                  <SelectItem key={operator.id} value={operator.id}>{operator.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Severidad</Label>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="low">Baja</SelectItem>
                <SelectItem value="medium">Media</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="critical">Critica</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard title="Eventos filtrados" value={String(filtered.length)} />
        <SummaryCard title="Anomalias detectadas" value={String(anomalies.length)} />
        <SummaryCard
          title="Riesgo promedio"
          value={`${(filtered.reduce((sum, log) => sum + (log.anomalyScore || 0), 0) / Math.max(1, filtered.length)).toFixed(1)} / 100`}
        />
      </div>

      {anomalies.length > 0 && (
        <Card className="border-red-400/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-5 h-5" /> Alertas de anomalia
            </CardTitle>
            <CardDescription>Acciones con puntaje de riesgo alto para revision administrativa.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {anomalies.slice(0, 5).map((log) => (
              <div key={`anomaly-${log.id}`} className="rounded-md border border-red-300/60 bg-red-50/40 p-3 text-sm space-y-1">
                <div className="font-semibold">{log.action}</div>
                <div>Operador: {log.actor?.email || "No identificado"}</div>
                <div>Local: {locationsMap.get(log.locationId || "") || log.locationId || "Sin local"}</div>
                <div>Puntaje: {log.anomalyScore || 0} - Tags: {(log.riskTags || []).join(", ") || "N/A"}</div>
                <div className="text-xs text-red-800"><strong>Motivo:</strong> {explainRisk(log).reason}</div>
                <div className="text-xs text-red-800"><strong>Accion sugerida:</strong> {explainRisk(log).action}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Bitacora de actividad</CardTitle>
          <CardDescription>
            Vista cronologica para rastrear acciones, detectar patrones erraticos y auditar operaciones del personal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative border-l border-zinc-800 ml-4 md:ml-6 pl-6 md:pl-8 space-y-6 py-4">
            {paginatedItems.map((log) => {
              const isCritical = log.severity === "critical" || log.severity === "high";
              const isVoid = /void|anular/i.test(log.action);
              const isDrawer = /drawer|caja/i.test(log.action);
              
              return (
                <div key={log.id} className="relative group">
                  {/* Timeline Node Indicator */}
                  <span className={`absolute -left-[31px] md:-left-[37px] top-1.5 flex items-center justify-center w-5 h-5 rounded-full border bg-zinc-950 transition-all ${
                    isCritical 
                      ? "border-rose-500/80 text-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.25)]" 
                      : isVoid 
                        ? "border-amber-500/80 text-amber-500" 
                        : isDrawer 
                          ? "border-blue-500/80 text-blue-500" 
                          : "border-zinc-700 text-zinc-400"
                  }`}>
                    {isCritical ? <AlertTriangle className="w-3 h-3" /> : isVoid ? <Trash2 className="w-3 h-3" /> : isDrawer ? <Clock className="w-3 h-3" /> : <User className="w-3 h-3" />}
                  </span>

                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-4 rounded-xl border border-zinc-900/60 bg-zinc-900/20 p-4 hover:bg-zinc-900/40 transition-all">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-xs font-bold tracking-tight ${isCritical ? "text-rose-400 font-black" : "text-zinc-200"}`}>
                          {log.action}
                        </span>
                        <Badge variant={severityVariant(log.severity)} className="text-[9px] py-0 px-1.5 h-4">{log.severity || "low"}</Badge>
                        {(log.anomalyScore || 0) >= 60 && (
                          <Badge variant="destructive" className="text-[9px] py-0 px-1.5 h-4">{log.anomalyScore} pts</Badge>
                        )}
                      </div>

                      <div className="text-xs text-zinc-400 flex flex-wrap items-center gap-1.5">
                        <span className="text-zinc-300 font-medium">{log.actor?.email || "Operador"}</span>
                        <span className="text-zinc-600">•</span>
                        <span>{locationsMap.get(log.locationId || "") || log.locationId || "Local Único"}</span>
                        <span className="text-zinc-600">•</span>
                        <span className="text-zinc-500 text-[10px] font-mono">{toDate(log).toLocaleString("es-PE")}</span>
                      </div>

                      <div className="text-xs text-zinc-300 bg-zinc-950/40 border border-zinc-800/50 rounded-lg p-2.5 mt-2">
                        <strong className="text-zinc-400">Contexto:</strong> {log.target} {log.targetId && `[${log.targetId}]`}
                        {log.details && Object.keys(log.details).length > 0 && (
                          <pre className="text-[10px] text-zinc-500 overflow-x-auto mt-1 max-w-full block bg-zinc-950/60 p-1 rounded">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col md:text-right gap-1 self-start md:self-center shrink-0 min-w-[200px]">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Recomendación</span>
                      <span className="text-xs text-zinc-400 max-w-xs">{explainRisk(log).action}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {filtered.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
              totalItems={filtered.length}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-sm text-muted-foreground">{title}</div>
        <div className="text-2xl font-black">{value}</div>
      </CardContent>
    </Card>
  );
}
