"use client";

import type { Machine } from "@/lib/types";
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

type ChargeDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  machine: Machine | null;
  onConfirmPayment: (machineId: number, amount: number) => void;
};

export default function ChargeDialog({
  isOpen,
  onOpenChange,
  machine,
  onConfirmPayment,
}: ChargeDialogProps) {
  if (!machine || !machine.session) return null;

  const { session } = machine;
  const rate = rates.find((r) => r.id === session.rateId);
  const elapsedSeconds = (Date.now() - session.startTime) / 1000;
  const elapsedMinutes = Math.ceil(elapsedSeconds / 60);
  const cost = calculateCost(elapsedMinutes, rate!.pricePerHour);

  const handleConfirm = () => {
    onConfirmPayment(machine.id, cost);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl">Finalizar y Cobrar: {machine.name}</DialogTitle>
          <DialogDescription>Confirme el cobro para finalizar la sesión del cliente.</DialogDescription>
        </DialogHeader>
        <div className="my-4 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Cliente:</span>
            <span className="font-semibold">{session.client}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Tiempo Utilizado:</span>
            <span className="font-semibold font-mono">{formatTime(Math.floor(elapsedSeconds))}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Tarifa Aplicada:</span>
            <span className="font-semibold">{rate?.name}</span>
          </div>
          <div className="border-t border-dashed my-4"></div>
          <div className="flex justify-between items-center text-3xl font-bold text-primary">
            <span>Total a Cobrar:</span>
            <span className="font-mono">{formatCurrency(cost)}</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleConfirm}>Confirmar Pago</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
