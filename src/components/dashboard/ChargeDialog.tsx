"use client";

import { useState, useEffect } from "react";
import type { Machine, PaymentMethod, Product, SoldProduct } from "@/lib/types";
import { rates } from "@/lib/data";
import { calculateCost, formatCurrency, formatTime } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProductsPOS from "./ProductsPOS";


type ChargeDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  machine: Machine | null;
  onConfirmPayment: (machineId: string, amount: number, paymentMethod: PaymentMethod, soldProducts: SoldProduct[]) => void;
};

export default function ChargeDialog({
  isOpen,
  onOpenChange,
  machine,
  onConfirmPayment,
}: ChargeDialogProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('efectivo');
  const [amountPaid, setAmountPaid] = useState<string>("");
  const [soldProducts, setSoldProducts] = useState<SoldProduct[]>([]);

  useEffect(() => {
    if (!isOpen) {
      // Reset state on close
      setPaymentMethod('efectivo');
      setAmountPaid("");
      setSoldProducts([]);
    }
  }, [isOpen]);

  if (!machine || !machine.session) return null;

  const { session } = machine;
  const rate = rates.find((r) => r.id === session.rateId);
  const elapsedSeconds = (Date.now() - session.startTime) / 1000;
  
  let sessionCost = 0;

  if (session.usageMode === 'prepaid') {
    const prepaidSeconds = (session.prepaidHours || 0) * 3600;
    if (elapsedSeconds > prepaidSeconds) {
      const extraSeconds = elapsedSeconds - prepaidSeconds;
      const extraMinutes = Math.ceil(extraSeconds / 60);
      // Cost calculation in prepaid is based on the initial prepaid amount, plus any extra time.
      // The initial cost is already accounted for in `session.prepaidHours`.
      const prepaidCost = (session.prepaidHours || 0) * rate!.pricePerHour;
      const extraCost = calculateCost(extraMinutes, rate!.pricePerHour, true);
      sessionCost = prepaidCost + extraCost;
    } else {
      // If within prepaid time, the cost is simply the amount they prepaid.
      sessionCost = (session.prepaidHours || 0) * rate!.pricePerHour;
    }
  } else { // 'free' mode
     const elapsedMinutes = Math.ceil(elapsedSeconds / 60);
     sessionCost = calculateCost(elapsedMinutes, rate!.pricePerHour);
  }

  const productsTotal = soldProducts.reduce((total, p) => total + p.quantity * p.unitPrice, 0);
  const finalCost = sessionCost + productsTotal;

  const numAmountPaid = parseFloat(amountPaid) || 0;
  const change = numAmountPaid > finalCost ? numAmountPaid - finalCost : 0;

  const handleConfirm = () => {
    onConfirmPayment(machine.id, finalCost, paymentMethod, soldProducts);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl">Finalizar y Cobrar: {machine.name}</DialogTitle>
          <DialogDescription>Añada productos y confirme el pago para finalizar la sesión.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="summary" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="summary">Resumen y Cobro</TabsTrigger>
                <TabsTrigger value="pos">Vender Productos (TPV)</TabsTrigger>
            </TabsList>
            <TabsContent value="summary" className="mt-4">
                 <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 p-4 border rounded-lg">
                        <div className="text-muted-foreground">Cliente:</div>
                        <div className="font-semibold text-right">{session.client || 'Ocasional'}</div>
                        
                        <div className="text-muted-foreground">Tiempo Utilizado:</div>
                        <div className="font-semibold font-mono text-right">{formatTime(Math.floor(elapsedSeconds))}</div>

                        <div className="text-muted-foreground">Tarifa Aplicada:</div>
                        <div className="font-semibold text-right">{rate?.name}</div>

                        <div className="text-muted-foreground">Costo Sesión:</div>
                        <div className="font-semibold font-mono text-right">{formatCurrency(sessionCost)}</div>
                        
                        {productsTotal > 0 && (
                          <>
                            <div className="text-muted-foreground">Costo Productos:</div>
                            <div className="font-semibold font-mono text-right">{formatCurrency(productsTotal)}</div>
                          </>
                        )}
                    </div>
                    
                    <div className="border-t border-dashed my-2"></div>
                    
                    <div className="flex justify-between items-center text-3xl font-bold text-primary">
                        <span>Total a Cobrar:</span>
                        <span className="font-mono">{formatCurrency(finalCost)}</span>
                    </div>

                    <div className="space-y-4 pt-2">
                        <Label>Método de Pago</Label>
                        <RadioGroup 
                            value={paymentMethod} 
                            onValueChange={(val) => setPaymentMethod(val as PaymentMethod)} 
                            className="grid grid-cols-3 gap-4"
                        >
                            <Label htmlFor="efectivo" className="flex items-center justify-center rounded-md border-2 border-muted bg-transparent p-3 text-sm hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"><RadioGroupItem value="efectivo" id="efectivo" className="sr-only peer" />Efectivo</Label>
                            <Label htmlFor="yape" className="flex items-center justify-center rounded-md border-2 border-muted bg-transparent p-3 text-sm hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"><RadioGroupItem value="yape" id="yape" className="sr-only peer" />Yape/Plin</Label>
                            <Label htmlFor="otro" className="flex items-center justify-center rounded-md border-2 border-muted bg-transparent p-3 text-sm hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"><RadioGroupItem value="otro" id="otro" className="sr-only peer" />Otro</Label>
                        </RadioGroup>

                        {paymentMethod === 'efectivo' && (
                            <div className="grid grid-cols-2 gap-4 items-center pt-2">
                            <div className="space-y-2">
                                <Label htmlFor="amount-paid">Paga con (S/)</Label>
                                <Input 
                                    id="amount-paid" 
                                    type="number" 
                                    placeholder={finalCost.toFixed(2)}
                                    value={amountPaid}
                                    onChange={(e) => setAmountPaid(e.target.value)}
                                    className="text-right font-mono"
                                />
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-muted-foreground">Vuelto:</p>
                                <p className="text-2xl font-bold font-mono text-accent-foreground">{formatCurrency(change)}</p>
                            </div>
                            </div>
                        )}
                    </div>

                    </div>
                    <DialogFooter className="pt-6 sm:justify-between gap-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                        <Button onClick={handleConfirm} className="w-full sm:w-auto">Confirmar Pago y Finalizar</Button>
                    </DialogFooter>
            </TabsContent>
            <TabsContent value="pos">
               <ProductsPOS onProductsChange={setSoldProducts} />
            </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
