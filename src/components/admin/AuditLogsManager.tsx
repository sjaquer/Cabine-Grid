"use client";

import { useMemo, useState } from "react";
import type { Location, UserProfile } from "@/lib/types";
import type { Timestamp } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, ShieldAlert } from "lucide-react";

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
              <div key={`anomaly-${log.id}`} className="rounded-md border border-red-300/60 bg-red-50/40 p-3 text-sm">
                <div className="font-semibold">{log.action}</div>
                <div>Operador: {log.actor?.email || "No identificado"}</div>
                <div>Local: {locationsMap.get(log.locationId || "") || log.locationId || "Sin local"}</div>
                <div>Puntaje: {log.anomalyScore || 0} - Tags: {(log.riskTags || []).join(", ") || "N/A"}</div>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Accion</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Severidad</TableHead>
                <TableHead className="text-right">Riesgo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{toDate(log).toLocaleString("es-PE")}</TableCell>
                  <TableCell>
                    <div className="font-medium">{log.action}</div>
                    <div className="text-xs text-muted-foreground">{log.target}{log.targetId ? ` / ${log.targetId}` : ""}</div>
                  </TableCell>
                  <TableCell>
                    <div>{log.actor?.email || "No identificado"}</div>
                    <div className="text-xs text-muted-foreground">{log.actor?.role || "Sin rol"}</div>
                  </TableCell>
                  <TableCell>{locationsMap.get(log.locationId || "") || log.locationId || "Sin local"}</TableCell>
                  <TableCell>
                    <Badge variant={severityVariant(log.severity)}>{log.severity || "low"}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={(log.anomalyScore || 0) >= 60 ? "destructive" : "secondary"}>{log.anomalyScore || 0}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
