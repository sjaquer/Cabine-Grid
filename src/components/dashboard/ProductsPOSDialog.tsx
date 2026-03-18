"use client";

import type { Machine, SoldProduct } from "@/lib/types";
import { sanitizeString } from "@/lib/sanitize";
import { formatTime } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import ProductsPOS from "./ProductsPOS";

 type ProductsPOSDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  machine: Machine | null;
  onSaveProducts: (machineId: string, products: SoldProduct[]) => Promise<void>;
  onGoToCharge: (machineId: string) => void;
 };

export default function ProductsPOSDialog({
  isOpen,
  onOpenChange,
  machine,
  onSaveProducts,
  onGoToCharge,
}: ProductsPOSDialogProps) {
  if (!machine || !machine.session) return null;

  const { session } = machine;
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - session.startTime) / 1000));

  const handleSave = async (products: SoldProduct[]) => {
    await onSaveProducts(machine.id, products);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-4xl p-0 overflow-hidden max-h-[92vh] flex flex-col shadow-2xl rounded-2xl border-accent/20">
        <div className="bg-gradient-to-r from-background via-accent/5 to-secondary p-5 sm:p-6 border-b relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-accent/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
          <DialogHeader className="space-y-1 relative z-10">
            <DialogTitle className="font-headline text-2xl sm:text-3xl flex items-center gap-3 font-black">
              🛍️ Tienda y Servicios: <span className="text-accent ml-1">{machine.name}</span>
            </DialogTitle>
            <DialogDescription className="text-sm sm:text-base font-medium text-muted-foreground mt-2 flex items-center gap-2">
              <span className="bg-secondary/40 px-2.5 py-1 rounded-md text-foreground/80 font-semibold shadow-sm">
                👤 {sanitizeString(session.client) || "Cliente Ocasional"}
              </span> 
              <span className="text-accent/60 mx-1">•</span> 
              <span className="bg-accent/10 text-accent px-2.5 py-1 rounded-md font-mono font-bold tracking-tight shadow-sm">
                ⏱️ {formatTime(elapsedSeconds)}
              </span>
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex-1 min-h-0 bg-background/50 flex flex-col">
          <ProductsPOS
            initialProducts={session.soldProducts}
            onSave={handleSave}
            onClose={() => onOpenChange(false)}
            onGoToCharge={() => onGoToCharge(machine.id)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
