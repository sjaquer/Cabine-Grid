"use client";

import type { Sale } from "@/lib/types";
import { formatCurrency, formatTime, formatDateTime, formatDuration } from "@/lib/utils";
import SalesChart from "./SalesChart";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Clock, Hash, Smartphone, Landmark } from "lucide-react";


type SalesHistorySheetProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  sales: Sale[];
};

export default function SalesHistorySheet({ isOpen, onOpenChange, sales }: SalesHistorySheetProps) {
  const totalSales = sales.reduce((sum, sale) => sum + sale.amount, 0);
  const totalSessions = sales.length;
  const averageMinutes = totalSessions > 0 ? sales.reduce((sum, sale) => sum + sale.totalMinutes, 0) / totalSessions : 0;
  
  const cashSales = sales.filter(s => s.paymentMethod === 'efectivo').reduce((sum, s) => sum + s.amount, 0);
  const yapeSales = sales.filter(s => s.paymentMethod === 'yape').reduce((sum, s) => sum + s.amount, 0);


  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-4xl w-full flex flex-col gap-6 p-4 sm:p-6">
        <SheetHeader>
          <SheetTitle className="font-headline text-2xl">Historial de Ventas del Día</SheetTitle>
          <SheetDescription>
            Un resumen detallado de la actividad y los ingresos de hoy.
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Recaudado</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(totalSales)}</div>
                </CardContent>
            </Card>
             <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Sesiones Totales</CardTitle>
                    <Hash className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{totalSessions}</div>
                </CardContent>
            </Card>
             <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Ventas Yape/Plin</CardTitle>
                    <Smartphone className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(yapeSales)}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Ventas Efectivo</CardTitle>
                    <Landmark className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(cashSales)}</div>
                </CardContent>
            </Card>
        </div>

        <SalesChart sales={sales} />

        <div className="flex-1 overflow-hidden rounded-lg border">
          <ScrollArea className="h-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PC</TableHead>
                  <TableHead className="hidden sm:table-cell">Cliente</TableHead>
                  <TableHead>Inicio</TableHead>
                  <TableHead>Fin</TableHead>
                  <TableHead className="hidden sm:table-cell">Duración</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.length > 0 ? sales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="font-medium">{sale.machineName}</TableCell>
                    <TableCell className="hidden sm:table-cell">{sale.clientName || 'Ocasional'}</TableCell>
                    <TableCell>{formatDateTime(sale.startTime)}</TableCell>
                    <TableCell>{formatDateTime(sale.endTime)}</TableCell>
                    <TableCell className="hidden sm:table-cell">{formatTime(sale.totalMinutes * 60)}</TableCell>
                    <TableCell className="capitalize">{sale.paymentMethod}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(sale.amount)}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                      Aún no hay ventas registradas hoy.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
