"use client";

import type { Sale, UserProfile, SoldProduct } from "@/lib/types";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Clock, Hash, Smartphone, Landmark, ShoppingCart, User, Package } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";
import { Badge } from "../ui/badge";
import type { Timestamp } from "firebase/firestore";

type SalesHistorySheetProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  sales: Sale[];
  userProfile: UserProfile | null;
};

export default function SalesHistorySheet({ isOpen, onOpenChange, sales, userProfile }: SalesHistorySheetProps) {
  const totalSales = sales.reduce((sum, sale) => sum + sale.amount, 0);
  const totalSessions = sales.length;
  
  const cashSales = sales.filter(s => s.paymentMethod === 'efectivo').reduce((sum, s) => sum + s.amount, 0);
  const yapeSales = sales.filter(s => s.paymentMethod === 'yape').reduce((sum, s) => sum + s.amount, 0);
  const productSales = sales.reduce((sum, sale) => {
    const productsTotal = sale.soldProducts?.reduce((pSum, p) => pSum + (p.quantity * p.unitPrice), 0) || 0;
    return sum + productsTotal;
  }, 0);

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-4xl w-full flex flex-col gap-0 p-0 overflow-hidden">
        <SheetHeader className="px-4 sm:px-6 py-4 sm:py-6 border-b">
          <SheetTitle className="font-headline text-2xl">Historial de Ventas del Día</SheetTitle>
          <SheetDescription>
            Un resumen detallado de la actividad y los ingresos de hoy.
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 px-4 sm:px-6 py-4 border-b overflow-x-auto">
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
                    <CardTitle className="text-sm font-medium">Ventas TPV</CardTitle>
                    <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(productSales)}</div>
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

        <div className="flex-1 min-h-0 overflow-y-auto border-t px-4 sm:px-6 py-4">
          <Accordion type="multiple" className="w-full space-y-2">
              {sales.length > 0 ? sales.map((sale) => (
                  <AccordionItem value={sale.id} key={sale.id}>
                     <AccordionTrigger className="px-4 hover:no-underline hover:bg-muted/50">
                        <div className="flex-1 grid grid-cols-4 sm:grid-cols-6 gap-2 text-left text-sm">
                           <div className="font-medium flex items-center gap-2"><Clock className="w-3 h-3 text-muted-foreground" />{formatDateTime(sale.endTime as Timestamp)}</div>
                           <div className="font-semibold">{sale.machineName}</div>
                           <div className="hidden sm:block">{sale.clientName || 'Ocasional'}</div>
                           <div className="hidden sm:block capitalize">{sale.paymentMethod}</div>
                           <div className="font-mono text-right col-span-2">{formatCurrency(sale.amount)}</div>
                        </div>
                     </AccordionTrigger>
                     <AccordionContent className="p-4 bg-secondary/50">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                           <InfoCard icon={User} title="Cliente" value={sale.clientName || 'Ocasional'} />
                           <InfoCard icon={Clock} title="Duración" value={formatTime(sale.totalMinutes * 60)} />
                            <InfoCard icon={Landmark} title="Tarifa" value={`${sale.rate?.name || ''} (${formatCurrency(sale.rate?.pricePerHour || sale.hourlyRate || 0)}/hr)`} />
                           {userProfile?.role === 'admin' && <InfoCard icon={User} title="Operador" value={sale.operator?.email || 'N/A'} />}
                        </div>
                                    {sale.soldProducts && sale.soldProducts.length > 0 && (
                            <div className="mt-4">
                                              <h4 className="font-semibold mb-2 flex items-center gap-2">
                                                 <ShoppingCart className="w-4 h-4" /> Productos Vendidos
                                              </h4>
                                              <div className="text-xs text-muted-foreground mb-2">
                                                 Items en boleta: {sale.soldProducts.reduce((sum, item) => sum + item.quantity, 0)}
                                              </div>
                               <Table>
                                 <TableHeader>
                                    <TableRow>
                                       <TableHead>Producto</TableHead>
                                       <TableHead>Cantidad</TableHead>
                                       <TableHead>P. Unit.</TableHead>
                                       <TableHead className="text-right">Subtotal</TableHead>
                                    </TableRow>
                                 </TableHeader>
                                 <TableBody>
                                    {sale.soldProducts.map((p, index) => (
                                       <TableRow key={index}>
                                          <TableCell>{p.productName}</TableCell>
                                          <TableCell>{p.quantity}</TableCell>
                                          <TableCell>{formatCurrency(p.unitPrice)}</TableCell>
                                          <TableCell className="text-right font-mono">{formatCurrency(p.quantity * p.unitPrice)}</TableCell>
                                       </TableRow>
                                    ))}
                                 </TableBody>
                               </Table>
                            </div>
                        )}
                     </AccordionContent>
                  </AccordionItem>
              )) : (
                <div className="text-center h-24 flex items-center justify-center text-muted-foreground">
                   Aún no hay ventas registradas hoy.
                </div>
              )}
            </Accordion>
        </div>
      </SheetContent>
    </Sheet>
  );
}

const InfoCard = ({ icon: Icon, title, value }: { icon: React.ElementType, title: string, value: string }) => (
   <div className="flex items-start gap-3">
      <Icon className="w-5 h-5 text-muted-foreground mt-1" />
      <div className="flex flex-col">
         <span className="text-sm text-muted-foreground">{title}</span>
         <span className="font-semibold">{value}</span>
      </div>
   </div>
)
