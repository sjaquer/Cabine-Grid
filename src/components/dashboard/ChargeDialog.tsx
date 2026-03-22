"use client";

import { useState, useEffect } from "react";
import type { Machine, PaymentMethod } from "@/lib/types";
import { formatCurrency, formatDuration, formatTime } from "@/lib/utils";
import { calculateSessionCost } from "@/lib/session-cost";
import { sanitizeString } from "@/lib/sanitize";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  onConfirmPayment: (machineId: string, amount: number, paymentMethod: PaymentMethod) => void;
  isProcessing?: boolean;
  fractionMinutes?: number;
};

export default function ChargeDialog({
  isOpen,
  onOpenChange,
  machine,
  onConfirmPayment,
  isProcessing = false,
  fractionMinutes = 5,
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
  
  // Use centralized cost calculation
  const costCalculation = calculateSessionCost(session, fractionMinutes);
  const {
    elapsedSeconds,
    billedMinutes,
    sessionCost,
    productsTotal,
    finalCost,
    chargeDescription,
  } = costCalculation;

  const numAmountPaid = parseFloat(amountPaid) || 0;
  const change = numAmountPaid > finalCost ? numAmountPaid - finalCost : 0;

  const quickAmounts = [
    finalCost,
    Math.ceil(finalCost / 5) * 5,
    Math.ceil(finalCost / 10) * 10,
  ];

  const handleConfirm = () => {
    if (isProcessing) return;
    onConfirmPayment(machine.id, finalCost, paymentMethod);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] sm:max-w-3xl lg:max-w-6xl p-0 overflow-hidden max-h-[92vh] lg:h-[88vh] flex flex-col shadow-2xl rounded-2xl border-primary/20">
        <div className="bg-gradient-to-r from-primary/10 via-background to-accent/10 p-5 sm:p-6 border-b relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
          <DialogHeader className="space-y-1 relative z-10">
            <DialogTitle className="font-headline text-xl sm:text-2xl flex items-center gap-2 font-black">
              Cobro - <span className="text-primary">{machine?.name}</span>
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm font-medium">
              {sanitizeString(session.client) || 'Ocasional'}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="w-full overflow-hidden flex-1 min-h-0 px-4 sm:px-6 py-4 sm:py-5 bg-background/50 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-4">
          <div className="space-y-4 min-h-0 overflow-y-auto pr-1">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 p-4 rounded-xl bg-secondary/30 border border-border/60 shadow-sm items-start">
              <div className="flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Cliente</span>
                <span className="font-headline font-bold text-sm md:text-lg text-foreground/90">{sanitizeString(session.client) || 'Ocasional'}</span>
              </div>
              <div className="flex flex-col gap-1 sm:text-center">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Tarifa</span>
                <span className="font-semibold text-sm font-mono text-accent">{formatCurrency(session.hourlyRate || 0)}</span>
              </div>
              <div className="flex flex-col gap-1 text-center">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Tiempo</span>
                <span className="font-mono font-bold text-sm md:text-base bg-secondary/50 px-2 py-0.5 rounded w-max mx-auto">{formatTime(Math.floor(elapsedSeconds))}</span>
              </div>
              <div className="flex flex-col gap-1 text-right sm:text-center lg:text-right">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Cobro</span>
                <div className="flex flex-col items-end sm:items-center lg:items-end gap-0.5">
                  <span className="font-mono font-bold text-base text-primary">{formatDuration(billedMinutes)}</span>
                  <span className="text-[10px] text-muted-foreground font-normal">{chargeDescription}</span>
                </div>
              </div>
              <div className="flex flex-col gap-1 text-left sm:text-center lg:text-right">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Sesión</span>
                <span className="font-mono font-bold text-base md:text-lg text-primary">{formatCurrency(sessionCost)}</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-background border border-accent/20 space-y-3">
              <div className="flex justify-between items-center text-sm font-medium">
                <span className="text-foreground/80">Uso de equipo</span>
                <span className="font-mono font-bold">{formatCurrency(sessionCost)}</span>
              </div>
              {productsTotal > 0 && (
                <>
                  <div className="flex justify-between items-center text-sm font-medium">
                    <span className="text-foreground/80">Productos</span>
                    <span className="font-mono font-bold text-accent">{formatCurrency(productsTotal)}</span>
                  </div>
                  <div className="border-t border-dashed border-border/60" />
                  <div className="space-y-1.5 bg-secondary/20 p-3 rounded-lg">
                    {(session.soldProducts ?? []).map((product, index) => (
                      <div key={`${product.productId}-${index}`} className="flex justify-between text-xs text-foreground/70 font-medium items-center">
                        <span>{product.quantity}x {product.productName}</span>
                        <span className="font-mono font-semibold">{formatCurrency(product.quantity * product.unitPrice)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div className="border-t border-border/50 pt-3 flex justify-between items-end">
                <span className="font-headline font-black text-base text-foreground">Total</span>
                <span className="font-mono font-black text-3xl text-primary">{formatCurrency(finalCost)}</span>
              </div>
            </div>
          </div>

          <aside className="mt-4 lg:mt-0 border-t lg:border-t-0 lg:border-l border-border/40 pt-4 lg:pt-0 lg:pl-4 flex flex-col min-h-0">
            <div className="space-y-3">
              <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Pago</Label>
              <RadioGroup
                value={paymentMethod}
                onValueChange={(val) => setPaymentMethod(val as PaymentMethod)}
                className="grid grid-cols-3 lg:grid-cols-1 gap-2"
              >
                <Label htmlFor="efectivo" className="flex items-center justify-center gap-2 rounded-xl border-2 border-border/60 bg-background p-3 min-h-16 cursor-pointer transition-all [&:has([data-state=checked])]:border-status-available [&:has([data-state=checked])]:bg-status-available/10">
                  <RadioGroupItem value="efectivo" id="efectivo" className="sr-only" />
                  <span className="text-sm font-bold">Efectivo</span>
                </Label>
                <Label htmlFor="yape" className="flex items-center justify-center gap-2 rounded-xl border-2 border-border/60 bg-background p-3 min-h-16 cursor-pointer transition-all [&:has([data-state=checked])]:border-[#742384] [&:has([data-state=checked])]:bg-[#742384]/10">
                  <RadioGroupItem value="yape" id="yape" className="sr-only" />
                  <span className="text-sm font-bold">Yape</span>
                </Label>
                <Label htmlFor="otro" className="flex items-center justify-center gap-2 rounded-xl border-2 border-border/60 bg-background p-3 min-h-16 cursor-pointer transition-all [&:has([data-state=checked])]:border-accent [&:has([data-state=checked])]:bg-accent/10">
                  <RadioGroupItem value="otro" id="otro" className="sr-only" />
                  <span className="text-sm font-bold">Tarjeta</span>
                </Label>
              </RadioGroup>

              {paymentMethod === 'efectivo' && (
                <div className="space-y-2 p-3 rounded-xl bg-status-available/5 border border-status-available/20">
                  <Label htmlFor="amount-paid" className="text-xs font-bold text-foreground/80">Recibido (S/.)</Label>
                  <Input
                    id="amount-paid"
                    type="number"
                    placeholder={finalCost.toFixed(2)}
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    className="text-right font-mono text-lg font-bold h-12 border-status-available/30"
                    autoFocus
                  />
                  <div className="flex flex-wrap gap-2">
                    {quickAmounts.map((value, index) => (
                      <Button
                        key={`${value}-${index}`}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setAmountPaid(value.toFixed(2))}
                      >
                        {index === 0 ? "Exacto" : formatCurrency(value)}
                      </Button>
                    ))}
                  </div>
                  <div className="pt-1 text-right">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Vuelto</p>
                    <p className={`text-2xl font-black font-mono ${change > 0 ? 'text-status-available' : 'text-muted-foreground/50'}`}>
                      {formatCurrency(change)}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-auto pt-4 flex flex-col gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full h-11 font-semibold">
                Cancelar
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={isProcessing}
                className="w-full h-12 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary text-white font-bold"
              >
                {isProcessing ? "Procesando..." : "Confirmar cobro"}
              </Button>
            </div>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}
