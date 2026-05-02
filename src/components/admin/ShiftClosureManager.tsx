"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Pagination from "@/components/ui/pagination";
import { usePagination } from "@/hooks/usePagination";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { UserProfile } from "@/lib/types";
import type { Timestamp } from "firebase/firestore";

type ShiftClosure = {
  id: string;
  shiftId?: string;
  locationId?: string | null;
  status?: "closed" | "reopened";
  expectedCash?: number;
  grossSales?: number;
  theoreticalIncome?: number;
  debtsGenerated?: number;
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
  const sortedClosures = useMemo(
    () => [...closures].sort((a, b) => (b.shiftEnd?.toMillis?.() || 0) - (a.shiftEnd?.toMillis?.() || 0)),
    [closures],
  );
  const {
    paginatedItems,
    currentPage,
    totalPages,
    pageSize,
    onPageChange,
    onPageSizeChange,
  } = usePagination(sortedClosures, 10);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cierres de Turno</CardTitle>
        <CardDescription>
          Historial de cierres de turno con auditoría de caja
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
                <TableHead className="text-right">Deudas</TableHead>
                <TableHead className="text-right">Ingreso Teórico</TableHead>
                <TableHead className="text-right">Caja Contada</TableHead>
                <TableHead className="text-right">Diferencia</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {closures.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground">
                    No hay cierres registrados.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedItems.map((closure) => (
                  <TableRow key={closure.id}>
                    <TableCell>
                      {closure.shiftEnd ? formatDateTime((closure.shiftEnd as Timestamp).toDate()) : "-"}
                    </TableCell>
                    <TableCell>{closure.operator?.email || "-"}</TableCell>
                    <TableCell>{closure.locationId || "Sin local"}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(closure.expectedCash || 0)}</TableCell>
                    <TableCell className="text-right font-mono text-destructive">{formatCurrency(closure.debtsGenerated || 0)}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(closure.theoreticalIncome ?? closure.grossSales ?? 0)}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(closure.countedCash || 0)}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(closure.cashDifference || 0)}</TableCell>
                    <TableCell>
                      <Badge variant={closure.status === "reopened" ? "secondary" : "default"}>
                        {closure.status === "reopened" ? "Reabierto" : "Cerrado"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!canReopen || closure.status === "reopened"}
                          >
                            Reabrir
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Estás seguro de reabrir este turno?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción permitirá registrar nuevos movimientos en el turno cerrado.
                              Esta acción es sensible y quedará registrada en la auditoría.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => onReopenShift(closure.id)}>
                              Confirmar Reapertura
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {closures.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
            totalItems={closures.length}
          />
        )}
      </CardContent>
    </Card>
  );
}
