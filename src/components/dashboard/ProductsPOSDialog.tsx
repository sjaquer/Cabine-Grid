"use client";

import type { Station, Product, SoldProduct } from "@/lib/types";
import { sanitizeString } from "@/lib/sanitize";
import { formatTime } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import ProductsPOS from "./ProductsPOS";

 type ProductsPOSDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  machine: Station | null;
  products: Product[];
  onSaveProducts: (machineId: string, products: SoldProduct[]) => Promise<void>;
  onGoToCharge: (machineId: string, products: SoldProduct[]) => void;
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
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[100vw] sm:max-w-xl p-0 overflow-hidden h-full flex flex-col border-slate-800 bg-slate-950 text-slate-50">
        <div className="bg-gradient-to-r from-background via-accent/5 to-secondary p-4 sm:p-6 border-b relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-accent/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
          <SheetHeader className="space-y-1 relative z-10">
            <SheetTitle className="font-headline text-xl sm:text-2xl flex items-center gap-2 font-black text-slate-50">
              TPV - <span className="text-primary">{machine.name}</span>
            </SheetTitle>
            <SheetDescription className="text-xs font-medium text-muted-foreground mt-1 flex flex-wrap items-center gap-2">
              <span className="bg-slate-900 px-2.5 py-1 rounded-md text-slate-300 font-semibold shadow-sm">
                {sanitizeString(session.client) || "Cliente Ocasional"}
              </span>
              <span className="bg-primary/20 text-primary px-2.5 py-1 rounded-md font-mono font-bold tracking-tight shadow-sm">
                {formatTime(elapsedSeconds)}
              </span>
            </SheetDescription>
          </SheetHeader>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto bg-background/50">
          <ProductsPOS
            availableProducts={products}
            initialProducts={session.soldProducts}
            onSave={handleSave}
            onClose={() => onOpenChange(false)}
            onGoToCharge={(selectedProducts) => onGoToCharge(machine.id, selectedProducts)}
            inventoryByProduct={inventoryByProduct}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
