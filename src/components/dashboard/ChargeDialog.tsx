"use client";

import { useState, useEffect } from "react";
import type { Machine, PaymentMethod, Product, SoldProduct } from "@/lib/types";
import { rates } from "@/lib/data";
import { calculateCost, formatCurrency, formatTime } from "@/lib/utils";
import { sanitizeString } from "@/lib/sanitize";
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
      <DialogContent className="sm:max-w-3xl p-0 overflow-hidden">
        <div className="bg-gradient-to-r from-primary/20 via-transparent to-accent/20 p-6 border-b">
          <DialogHeader className="space-y-1">
            <DialogTitle className="font-headline text-2xl flex items-center gap-2">
              💳 Finalizar Sesión: {machine?.name}
            </DialogTitle>
            <DialogDescription>
              Complete el cobro para terminar la sesión del cliente
            </DialogDescription>
          </DialogHeader>
        </div>

        <Tabs defaultValue="summary" className="w-full overflow-hidden flex flex-col max-h-[calc(100vh-200px)]">
            <TabsList className="grid w-full grid-cols-2 bg-secondary/60 mx-6 mt-6 mb-0">
                <TabsTrigger value="summary">Resumen y Cobro</TabsTrigger>
                <TabsTrigger value="pos">Vender Productos</TabsTrigger>
            </TabsList>
            
            <TabsContent value="summary" className="flex-1 overflow-y-auto mx-6 my-4 space-y-4">
                {/* Detalle de Sesión */}
                <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-secondary/40 border border-border/50">
                    <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">Cliente</span>
                        <span className="font-headline font-bold text-lg">{sanitizeString(session.client) || 'Ocasional'}</span>
                    </div>
                    <div className="flex flex-col gap-1 text-right">
                        <span className="text-xs text-muted-foreground">Tarifa</span>
                        <span className="font-semibold">{rate?.name}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">Tiempo Utilizado</span>
                        <span className="font-mono font-bold text-right">{formatTime(Math.floor(elapsedSeconds))}</span>
                    </div>
                    <div className="flex flex-col gap-1 text-right">
                        <span className="text-xs text-muted-foreground">Costo Sesión</span>
                        <span className="font-mono font-bold text-primary">{formatCurrency(sessionCost)}</span>
                    </div>
                </div>

                {/* Desglose de costos */}
                <div className="p-4 rounded-lg bg-secondary/30 border border-accent/30 space-y-2">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Sesión en {machine?.name}:</span>
                        <span className="font-mono font-semibold">{formatCurrency(sessionCost)}</span>
                    </div>
                    {productsTotal > 0 && (
                        <>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Productos vendidos:</span>
                                <span className="font-mono font-semibold text-accent">{formatCurrency(productsTotal)}</span>
                            </div>
                            <div className="border-t border-border/30 pt-2" />
                        </>
                    )}
                    <div className="flex justify-between items-center text-lg">
                        <span className="font-headline font-bold">Total a Cobrar:</span>
                        <span className="font-mono font-bold text-2xl text-accent">
                            {formatCurrency(finalCost)}
                        </span>
                    </div>
                </div>

                {/* Método de pago */}
                <div className="space-y-3">
                    <Label className="text-base font-semibold">Método de Pago</Label>
                    <RadioGroup 
                        value={paymentMethod} 
                        onValueChange={(val) => setPaymentMethod(val as PaymentMethod)} 
                        className="grid grid-cols-3 gap-3"
                    >
                        <Label htmlFor="efectivo" className="flex flex-col items-center gap-2 rounded-lg border-2 border-muted bg-popover/50 p-3 hover:bg-secondary/50 cursor-pointer transition peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/10">
                            <RadioGroupItem value="efectivo" id="efectivo" className="sr-only peer" />
                            <span className="text-2xl">💵</span>
                            <span className="text-sm font-semibold">Efectivo</span>
                        </Label>
                        <Label htmlFor="yape" className="flex flex-col items-center gap-2 rounded-lg border-2 border-muted bg-popover/50 p-3 hover:bg-secondary/50 cursor-pointer transition peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/10">
                            <RadioGroupItem value="yape" id="yape" className="sr-only peer" />
                            <span className="text-2xl">📱</span>
                            <span className="text-sm font-semibold">Yape/Plin</span>
                        </Label>
                        <Label htmlFor="otro" className="flex flex-col items-center gap-2 rounded-lg border-2 border-muted bg-popover/50 p-3 hover:bg-secondary/50 cursor-pointer transition peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/10">
                            <RadioGroupItem value="otro" id="otro" className="sr-only peer" />
                            <span className="text-2xl">💳</span>
                            <span className="text-sm font-semibold">Tarjeta</span>
                        </Label>
                    </RadioGroup>
                </div>

                {/* Cálculo de vuelto para efectivo */}
                {paymentMethod === 'efectivo' && (
                    <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-accent/10 border border-accent/30">
                        <div className="space-y-2">
                            <Label htmlFor="amount-paid" className="text-sm font-semibold">Paga con (S/.)</Label>
                            <Input 
                                id="amount-paid" 
                                type="number" 
                                placeholder={finalCost.toFixed(2)}
                                value={amountPaid}
                                onChange={(e) => setAmountPaid(e.target.value)}
                                className="text-right font-mono text-lg font-bold"
                                autoFocus
                            />
                        </div>
                        <div className="flex flex-col justify-end pb-2">
                            <p className="text-xs text-muted-foreground mb-1">Vuelto:</p>
                            <p className={`text-2xl font-bold font-mono ${change > 0 ? 'text-status-available' : 'text-muted-foreground'}`}>
                                {formatCurrency(change)}
                            </p>
                        </div>
                    </div>
                )}
            </TabsContent>
            
            <TabsContent value="pos" className="flex-1 overflow-hidden flex flex-col mx-6 my-4">
               <ProductsPOS onProductsChange={setSoldProducts} />
            </TabsContent>
        </Tabs>

        <DialogFooter className="p-6 pt-4 border-t bg-secondary/30 gap-2 justify-between">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar Cobro
            </Button>
            <Button 
                onClick={handleConfirm} 
                className="bg-gradient-to-r from-accent to-primary text-white font-bold px-8"
                size="lg"
            >
                ✓ Confirmar Pago
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
