"use client";

import { useState, useEffect } from "react";
import type { Machine, PaymentMethod } from "@/lib/types";
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

type ChargeDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  machine: Machine | null;
  onConfirmPayment: (machineId: number, amount: number, paymentMethod: PaymentMethod) => void;
};

export default function ChargeDialog({
  isOpen,
  onOpenChange,
  machine,
  onConfirmPayment,
}: ChargeDialogProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('efectivo');
  const [amountPaid, setAmountPaid] = useState<string>("");

  useEffect(() => {
    if (!isOpen) {
      // Reset state on close
      setPaymentMethod('efectivo');
      setAmountPaid("");
    }
  }, [isOpen]);

  if (!machine || !machine.session) return null;

  const { session } = machine;
  const rate = rates.find((r) => r.id === session.rateId);
  const elapsedSeconds = (Date.now() - session.startTime) / 1000;
  
  let cost = 0;
  let timeToDisplay = elapsedSeconds;

  if (session.usageMode === 'prepaid') {
    const prepaidSeconds = (session.prepaidHours || 0) * 3600;
    if (elapsedSeconds > prepaidSeconds) {
      // Pro-rata the extra time
      const extraSeconds = elapsedSeconds - prepaidSeconds;
      const extraMinutes = Math.ceil(extraSeconds / 60);
      const prepaidCost = (session.prepaidHours || 0) * rate!.pricePerHour;
      const extraCost = calculateCost(extraMinutes, rate!.pricePerHour);
      cost = prepaidCost + extraCost;
    } else {
      cost = (session.prepaidHours || 0) * rate!.pricePerHour;
    }
  } else { // 'free' mode
     const elapsedMinutes = Math.ceil(elapsedSeconds / 60);
     cost = calculateCost(elapsedMinutes, rate!.pricePerHour);
  }

  const numAmountPaid = parseFloat(amountPaid);
  const change = numAmountPaid > cost ? numAmountPaid - cost : 0;

  const handleConfirm = () => {
    onConfirmPayment(machine.id, cost, paymentMethod);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl">Finalizar y Cobrar: {machine.name}</DialogTitle>
          <DialogDescription>Confirme el cobro para finalizar la sesión del cliente.</DialogDescription>
        </DialogHeader>
        <div className="my-4 space-y-4">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <div className="text-muted-foreground">Cliente:</div>
            <div className="font-semibold text-right">{session.client || 'Ocasional'}</div>
            
            <div className="text-muted-foreground">Tiempo Utilizado:</div>
            <div className="font-semibold font-mono text-right">{formatTime(Math.floor(elapsedSeconds))}</div>

            <div className="text-muted-foreground">Tarifa Aplicada:</div>
            <div className="font-semibold text-right">{rate?.name}</div>
          </div>
          
          <div className="border-t border-dashed my-2"></div>
          
          <div className="flex justify-between items-center text-3xl font-bold text-primary">
            <span>Total a Cobrar:</span>
            <span className="font-mono">{formatCurrency(cost)}</span>
          </div>

          <div className="space-y-4 pt-2">
             <Label>Método de Pago</Label>
             <RadioGroup 
                value={paymentMethod} 
                onValueChange={(val) => setPaymentMethod(val as PaymentMethod)} 
                className="grid grid-cols-3 gap-4"
             >
                <div>
                    <RadioGroupItem value="efectivo" id="efectivo" className="peer sr-only" />
                    <Label htmlFor="efectivo" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-transparent p-3 text-sm hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">Efectivo</Label>
                </div>
                 <div>
                    <RadioGroupItem value="yape" id="yape" className="peer sr-only" />
                    <Label htmlFor="yape" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-transparent p-3 text-sm hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">Yape/Plin</Label>
                </div>
                 <div>
                    <RadioGroupItem value="otro" id="otro" className="peer sr-only" />
                    <Label htmlFor="otro" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-transparent p-3 text-sm hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">Otro</Label>
                </div>
             </RadioGroup>

             {paymentMethod === 'efectivo' && (
                <div className="grid grid-cols-2 gap-4 items-center pt-2">
                   <div className="space-y-2">
                     <Label htmlFor="amount-paid">Paga con (S/)</Label>
                     <Input 
                        id="amount-paid" 
                        type="number" 
                        placeholder={cost.toFixed(2)}
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
        <DialogFooter className="sm:justify-between gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleConfirm} className="w-full sm:w-auto">Confirmar Pago y Finalizar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
