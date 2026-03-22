"use client";

import type { Machine, Product, SoldProduct } from "@/lib/types";
import { sanitizeString } from "@/lib/sanitize";
import { formatTime } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ProductsPOS from "./ProductsPOS";

 type ProductsPOSDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  machine: Machine | null;
  products: Product[];
  onSaveProducts: (machineId: string, products: SoldProduct[]) => Promise<void>;
  onGoToCharge: (machineId: string) => void;
  inventoryByProduct?: Record<string, number>; // productId -> stock
 };

export default function ProductsPOSDialog({
  isOpen,
  onOpenChange,
  machine,
  products,
  onSaveProducts,
  onGoToCharge,
  inventoryByProduct,
}: ProductsPOSDialogProps) {
  if (!machine || !machine.session) return null;

  const { session } = machine;
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - session.startTime) / 1000));

  const handleSave = async (products: SoldProduct[]) => {
    await onSaveProducts(machine.id, products);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] sm:max-w-4xl lg:max-w-6xl p-0 overflow-hidden max-h-[92vh] lg:h-[88vh] flex flex-col shadow-2xl rounded-2xl border-accent/20">
        <div className="bg-gradient-to-r from-background via-accent/5 to-secondary p-4 sm:p-6 border-b relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-accent/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
          <DialogHeader className="space-y-1 relative z-10">
            <DialogTitle className="font-headline text-xl sm:text-2xl flex items-center gap-2 font-black">
              TPV - <span className="text-accent">{machine.name}</span>
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-muted-foreground mt-1 flex flex-wrap items-center gap-2">
              <span className="bg-secondary/40 px-2.5 py-1 rounded-md text-foreground/80 font-semibold shadow-sm">
                {sanitizeString(session.client) || "Cliente Ocasional"}
              </span>
              <span className="bg-accent/10 text-accent px-2.5 py-1 rounded-md font-mono font-bold tracking-tight shadow-sm">
                {formatTime(elapsedSeconds)}
              </span>
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex-1 min-h-0 bg-background/50 flex flex-col">
          <ProductsPOS
            availableProducts={products}
            initialProducts={session.soldProducts}
            onSave={handleSave}
            onClose={() => onOpenChange(false)}
            onGoToCharge={() => onGoToCharge(machine.id)}
            inventoryByProduct={inventoryByProduct}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
