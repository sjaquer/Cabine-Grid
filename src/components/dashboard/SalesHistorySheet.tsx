"use client";

import type { Sale } from "@/lib/types";
import { formatCurrency, formatTime } from "@/lib/utils";
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

type SalesHistorySheetProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  sales: Sale[];
};

export default function SalesHistorySheet({ isOpen, onOpenChange, sales }: SalesHistorySheetProps) {
  const totalSales = sales.reduce((sum, sale) => sum + sale.amount, 0);

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl w-full flex flex-col">
        <SheetHeader>
          <SheetTitle className="font-headline">Historial de Ventas del Día</SheetTitle>
          <SheetDescription>
            Total Recaudado: <span className="font-bold text-status-available">{formatCurrency(totalSales)}</span>
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PC</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tiempo</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.length > 0 ? sales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="font-medium">{sale.machineName}</TableCell>
                    <TableCell>{sale.clientName}</TableCell>
                    <TableCell>{formatTime(sale.totalMinutes * 60)}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(sale.amount)}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                      No hay ventas registradas hoy.
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
