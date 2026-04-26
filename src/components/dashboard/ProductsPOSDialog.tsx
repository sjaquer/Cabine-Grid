"use client";

import type { Station, Product, SoldProduct, PaymentMethod } from "@/lib/types";
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

import { ShoppingCart, X } from "lucide-react";

 type ProductsPOSDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  machine: Station | null;
  products: Product[];
  onSaveProducts: (machineId: string, products: SoldProduct[]) => Promise<void>;
  onConfirmPayment: (machineId: string, amount: number, paymentMethod: PaymentMethod) => void;
  isProcessingPayment?: boolean;
  inventoryByProduct?: Record<string, number>; // productId -> stock
  fractionMinutes?: number;
 };

export default function ProductsPOSDialog({
  isOpen,
  onOpenChange,
  machine,
  products,
  onSaveProducts,
  onConfirmPayment,
  isProcessingPayment = false,
  inventoryByProduct,
  fractionMinutes = 5,
}: ProductsPOSDialogProps) {
  if (!machine || !machine.session) return null;

  const { session } = machine;
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - session.startTime) / 1000));

  const handleSave = async (products: SoldProduct[]) => {
    await onSaveProducts(machine.id, products);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[100vw] sm:max-w-xl p-0 overflow-hidden h-full flex flex-col border-l border-zinc-800 bg-zinc-950 text-zinc-100 [&>button]:hidden">
        <div className="bg-zinc-900 p-4 border-b border-zinc-800 relative overflow-hidden">
          <SheetHeader className="space-y-1 relative z-10">
            <button 
              onClick={() => onOpenChange(false)}
              className="absolute right-0 top-0 p-1 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60 transition-all"
            >
              <X size={18} />
            </button>
            <SheetTitle className="text-lg font-bold tracking-tight flex items-center text-white">
              <ShoppingCart className="text-zinc-500 mr-2" size={18} />
              Punto de Venta - <span className="text-emerald-400 ml-1">{machine.name}</span>
            </SheetTitle>
            <SheetDescription className="text-xs font-medium text-zinc-400 mt-1 flex items-center gap-2">
              <span className="bg-zinc-950 px-2.5 py-1 rounded-md text-zinc-300 font-semibold border border-zinc-800/60 shadow-sm">
                {sanitizeString(session.client) || "Cliente Ocasional"}
              </span>
              <span className="bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-md font-mono font-bold tracking-tight border border-emerald-500/30 shadow-sm">
                {formatTime(elapsedSeconds)}
              </span>
            </SheetDescription>
          </SheetHeader>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto bg-zinc-950">
          <ProductsPOS
            availableProducts={products}
            initialProducts={session.soldProducts}
            onSave={handleSave}
            onClose={() => onOpenChange(false)}
            onConfirmPayment={(amount, paymentMethod) => onConfirmPayment(machine.id, amount, paymentMethod)}
            isProcessing={isProcessingPayment}
            inventoryByProduct={inventoryByProduct}
            activeSession={session}
            fractionMinutes={fractionMinutes}
            machineName={machine.name}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
