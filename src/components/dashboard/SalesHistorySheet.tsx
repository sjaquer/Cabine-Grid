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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Clock, Hash, Smartphone, Landmark, ShoppingCart, User, Package, ChartBar, List } from "lucide-react";
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
   const totalGross = sales.reduce((sum, sale) => sum + (sale.grossAmount ?? sale.amount), 0);
   const totalDiscounts = sales.reduce((sum, sale) => sum + (sale.discountAmount ?? 0), 0);
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
               <CardTitle className="text-sm font-medium">Ingreso Real</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(totalSales)}</div>
                </CardContent>
            </Card>
             <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
               <CardTitle className="text-sm font-medium">Ingreso Bruto</CardTitle>
                    <Hash className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
               <div className="text-2xl font-bold">{formatCurrency(totalGross)}</div>
                </CardContent>
            </Card>
             <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
               <CardTitle className="text-sm font-medium">Descuentos</CardTitle>
                    <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
               <div className="text-2xl font-bold text-amber-500">-{formatCurrency(totalDiscounts)}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
               <CardTitle className="text-sm font-medium">Sesiones Totales</CardTitle>
                    <Landmark className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
               <div className="text-2xl font-bold">{totalSessions}</div>
                </CardContent>
            </Card>
        </div>

        <Tabs defaultValue="breakdown" className="flex-1 flex flex-col min-h-0 w-full mt-2">
           <div className="px-4 sm:px-6 mb-2">
              <TabsList className="grid w-full grid-cols-2">
                 <TabsTrigger value="breakdown" className="flex items-center gap-2">
                    <List className="w-4 h-4" /> Desglose
                 </TabsTrigger>
                 <TabsTrigger value="analysis" className="flex items-center gap-2">
                    <ChartBar className="w-4 h-4" /> Análisis
                 </TabsTrigger>
              </TabsList>
           </div>
           
           <TabsContent value="analysis" className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4 m-0 data-[state=inactive]:hidden border-t">
              <div className="bg-card border rounded-lg p-2 h-[400px]">
                 <SalesChart sales={sales} />
              </div>
           </TabsContent>

           <TabsContent value="breakdown" className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4 m-0 data-[state=inactive]:hidden border-t">
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
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                           <div className="rounded-md border p-2">
                              <span className="text-muted-foreground">Ingreso Bruto</span>
                              <div className="font-mono font-semibold">{formatCurrency(sale.grossAmount ?? sale.amount)}</div>
                           </div>
                           <div className="rounded-md border p-2">
                              <span className="text-muted-foreground">Descuento</span>
                              <div className="font-mono font-semibold text-amber-500">-{formatCurrency(sale.discountAmount ?? 0)}</div>
                           </div>
                           <div className="rounded-md border p-2">
                              <span className="text-muted-foreground">Ingreso Real</span>
                              <div className="font-mono font-semibold text-emerald-500">{formatCurrency(sale.netAmount ?? sale.amount)}</div>
                           </div>
                        </div>
                        {sale.discountReason && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Motivo descuento: {sale.discountReason}
                          </p>
                        )}
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
           </TabsContent>
        </Tabs>
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
