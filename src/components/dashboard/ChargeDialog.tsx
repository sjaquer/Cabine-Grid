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

  const handleConfirm = () => {
    if (isProcessing) return;
    onConfirmPayment(machine.id, finalCost, paymentMethod);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-3xl p-0 overflow-hidden max-h-[92vh] flex flex-col shadow-2xl rounded-2xl border-primary/20">
        <div className="bg-gradient-to-r from-primary/10 via-background to-accent/10 p-5 sm:p-6 border-b relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
          <DialogHeader className="space-y-1 relative z-10">
            <DialogTitle className="font-headline text-2xl sm:text-3xl flex items-center gap-3 font-black">
              🧾 Boleta de Consumo: <span className="text-primary ml-1">{machine?.name}</span>
            </DialogTitle>
            <DialogDescription className="text-sm sm:text-base font-medium">
              Revisa los detalles de consumo y registra el pago para cerrar la cuenta.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="w-full overflow-y-auto flex-1 min-h-0 px-4 sm:px-6 py-4 sm:py-5 space-y-5 bg-background/50">
                {/* Detalle de Sesión */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 p-5 rounded-xl bg-secondary/30 border border-border/60 shadow-sm items-start">
                    <div className="flex flex-col gap-1">
                        <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Cliente</span>
                        <span className="font-headline font-bold text-base md:text-lg text-foreground/90">{sanitizeString(session.client) || 'Ocasional'}</span>
                    </div>
                    <div className="flex flex-col gap-1 sm:text-center">
                        <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Tarifa por Hora</span>
                        <span className="font-semibold text-sm md:text-base font-mono text-accent">{formatCurrency(session.hourlyRate || 0)}</span>
                    </div>
                    <div className="flex flex-col gap-1 text-center">
                        <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Tiempo Usado</span>
                        <span className="font-mono font-bold text-sm md:text-base bg-secondary/50 px-2 py-0.5 rounded w-max mx-auto">{formatTime(Math.floor(elapsedSeconds))}</span>
                    </div>
                    <div className="flex flex-col gap-1 text-right sm:text-center lg:text-right">
                        <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Tiempo a Cobrar</span>
                        <div className="flex flex-col items-end sm:items-center lg:items-end gap-0.5">
                          <span className="font-mono font-bold text-base md:text-lg text-primary">{formatDuration(billedMinutes)}</span>
                          <span className="text-[10px] text-muted-foreground font-normal">{chargeDescription}</span>
                        </div>
                    </div>
                    <div className="flex flex-col gap-1 text-left sm:text-center lg:text-right">
                        <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Costo de Sesión</span>
                        <span className="font-mono font-bold text-base md:text-lg text-primary">{formatCurrency(sessionCost)}</span>
                    </div>
                </div>

                {/* Desglose de costos */}
                <div className="p-5 rounded-xl bg-background border border-accent/20 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.1)] space-y-3 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-accent"></div>
                    <div className="flex justify-between items-center text-sm md:text-base font-medium">
                        <span className="text-foreground/80">Uso de equipo ({machine?.name}):</span>
                        <span className="font-mono font-bold">{formatCurrency(sessionCost)}</span>
                    </div>
                    {productsTotal > 0 && (
                        <>
                            <div className="flex justify-between items-center text-sm md:text-base font-medium mt-1">
                                <span className="text-foreground/80">Productos consumidos:</span>
                                <span className="font-mono font-bold text-accent">{formatCurrency(productsTotal)}</span>
                            </div>
                            <div className="border-t border-dashed border-border/60 my-3" />
                            <div className="space-y-1.5 bg-secondary/20 p-3 rounded-lg">
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Detalle de productos</p>
                              {(session.soldProducts ?? []).map((product, index) => (
                                <div key={`${product.productId}-${index}`} className="flex justify-between text-xs md:text-sm text-foreground/70 font-medium items-center">
                                  <span className="flex items-center gap-2"><span className="bg-accent/10 text-accent font-bold px-1.5 rounded">{product.quantity}x</span> {product.productName}</span>
                                  <span className="font-mono font-semibold">{formatCurrency(product.quantity * product.unitPrice)}</span>
                                </div>
                              ))}
                            </div>
                        </>
                    )}
                    <div className="border-t border-border/50 pt-4 mt-2 flex justify-between items-end">
                        <span className="font-headline font-black text-lg md:text-xl text-foreground">Total a Cobrar:</span>
                        <span className="font-mono font-black text-3xl md:text-4xl text-transparent bg-clip-text bg-gradient-to-r from-accent to-primary drop-shadow-sm">
                            {formatCurrency(finalCost)}
                        </span>
                    </div>
                </div>

                {/* Método de pago */}
                <div className="space-y-3.5 pt-2">
                    <Label className="text-[13px] uppercase tracking-wider font-bold text-muted-foreground ml-1">Método de Pago</Label>
                    <RadioGroup 
                        value={paymentMethod} 
                        onValueChange={(val) => setPaymentMethod(val as PaymentMethod)} 
                      className="grid grid-cols-1 sm:grid-cols-3 gap-3"
                    >
                        <Label htmlFor="efectivo" className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-border/60 bg-background p-4 hover:bg-secondary/40 cursor-pointer transition-all peer-data-[state=checked]:border-status-available [&:has([data-state=checked])]:border-status-available [&:has([data-state=checked])]:bg-status-available/10 [&:has([data-state=checked])]:shadow-[0_0_15px_-3px_rgba(34,197,94,0.3)]">
                            <RadioGroupItem value="efectivo" id="efectivo" className="sr-only peer" />
                            <span className="text-3xl drop-shadow-sm group-hover:scale-110 transition-transform">💵</span>
                            <span className="text-sm font-bold text-foreground/80">Efectivo</span>
                        </Label>
                        <Label htmlFor="yape" className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-border/60 bg-background p-4 hover:bg-secondary/40 cursor-pointer transition-all peer-data-[state=checked]:border-[#742384] [&:has([data-state=checked])]:border-[#742384] [&:has([data-state=checked])]:bg-[#742384]/10 [&:has([data-state=checked])]:shadow-[0_0_15px_-3px_rgba(116,35,132,0.3)]">
                            <RadioGroupItem value="yape" id="yape" className="sr-only peer" />
                            <span className="text-3xl drop-shadow-sm group-hover:scale-110 transition-transform">📱</span>
                            <span className="text-sm font-bold text-foreground/80">Yape/Plin</span>
                        </Label>
                        <Label htmlFor="otro" className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-border/60 bg-background p-4 hover:bg-secondary/40 cursor-pointer transition-all peer-data-[state=checked]:border-accent [&:has([data-state=checked])]:border-accent [&:has([data-state=checked])]:bg-accent/10 [&:has([data-state=checked])]:shadow-[0_0_15px_-3px_rgba(var(--accent),0.3)]">
                            <RadioGroupItem value="otro" id="otro" className="sr-only peer" />
                            <span className="text-3xl drop-shadow-sm group-hover:scale-110 transition-transform">💳</span>
                            <span className="text-sm font-bold text-foreground/80">Tarjeta</span>
                        </Label>
                    </RadioGroup>
                </div>

                {/* Cálculo de vuelto para efectivo */}
                {paymentMethod === 'efectivo' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 rounded-xl bg-status-available/5 border border-status-available/20 shadow-inner mt-2">
                        <div className="space-y-2.5">
                            <Label htmlFor="amount-paid" className="text-sm font-bold text-foreground/80">El cliente paga con (S/.)</Label>
                            <Input 
                                id="amount-paid" 
                                type="number" 
                                placeholder={finalCost.toFixed(2)}
                                value={amountPaid}
                                onChange={(e) => setAmountPaid(e.target.value)}
                                className="text-right font-mono text-xl font-bold h-12 border-status-available/30 focus-visible:ring-status-available/50 bg-background shadow-sm"
                                autoFocus
                            />
                        </div>
                        <div className="flex flex-col justify-end pb-1 sm:pl-4">
                            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">Vuelto a entregar:</p>
                            <p className={`text-3xl font-black font-mono tracking-tight ${change > 0 ? 'text-status-available drop-shadow-sm' : 'text-muted-foreground/50'}`}>
                                {formatCurrency(change)}
                            </p>
                        </div>
                    </div>
                )}
          </div>

          <DialogFooter className="p-5 sm:p-6 border-t bg-background/80 backdrop-blur-sm gap-3 justify-between flex-col sm:flex-row shadow-[0_-5px_15px_-10px_rgba(0,0,0,0.1)] z-10 w-full shrink-0">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-1/3 h-12 sm:h-auto font-semibold hover:bg-destructive hover:text-white transition-all shadow-sm">
                Cancelar Cobro
            </Button>
            <Button
                onClick={handleConfirm}
                disabled={isProcessing}
              className="w-full sm:flex-1 h-14 sm:h-auto bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary text-white font-bold text-base shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
            >
                {isProcessing ? "Procesando pago..." : "✅ Confirmar y Terminar Sesión"}
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
