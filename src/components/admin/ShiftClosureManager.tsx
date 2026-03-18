"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { UserProfile } from "@/lib/types";
import type { Timestamp } from "firebase/firestore";

type ShiftClosure = {
  id: string;
  shiftId?: string;
  locationId?: string | null;
  status?: "closed" | "reopened";
  expectedCash?: number;
  countedCash?: number;
  cashDifference?: number;
  discrepancyReason?: string | null;
  shiftStart?: Timestamp;
  shiftEnd?: Timestamp;
  operator?: {
    email?: string | null;
    id?: string | null;
  };
  reopenedAt?: Timestamp;
};

type ShiftClosureManagerProps = {
  closures: ShiftClosure[];
  userProfile: UserProfile | null;
  onReopenShift: (closureId: string) => Promise<void>;
};

export default function ShiftClosureManager({ closures, userProfile, onReopenShift }: ShiftClosureManagerProps) {
  const canReopen = userProfile?.role === "admin";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cierres de Turno</CardTitle>
        <CardDescription>
          Historial de cierres con arqueo. Solo administrador puede reabrir un cierre finalizado.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha Fin</TableHead>
                <TableHead>Operador</TableHead>
                <TableHead>Local</TableHead>
                <TableHead className="text-right">Caja Esperada</TableHead>
                <TableHead className="text-right">Caja Contada</TableHead>
                <TableHead className="text-right">Diferencia</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {closures.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No hay cierres registrados.
                  </TableCell>
                </TableRow>
              ) : (
                closures.map((closure) => (
                  <TableRow key={closure.id}>
                    <TableCell>
                      {closure.shiftEnd ? formatDateTime((closure.shiftEnd as Timestamp).toDate()) : "-"}
                    </TableCell>
                    <TableCell>{closure.operator?.email || "-"}</TableCell>
                    <TableCell>{closure.locationId || "Sin local"}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(closure.expectedCash || 0)}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(closure.countedCash || 0)}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(closure.cashDifference || 0)}</TableCell>
                    <TableCell>
                      <Badge variant={closure.status === "reopened" ? "secondary" : "default"}>
                        {closure.status === "reopened" ? "Reabierto" : "Cerrado"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!canReopen || closure.status === "reopened"}
                        onClick={() => onReopenShift(closure.id)}
                      >
                        Reabrir
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
