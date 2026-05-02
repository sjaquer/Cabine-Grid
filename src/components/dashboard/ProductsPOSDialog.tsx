"use client";

import type { Station, Product, SoldProduct, PaymentMethod, Session, Customer } from "@/lib/types";
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
    customers?: Customer[];
  onSaveProducts: (machineId: string, products: SoldProduct[]) => Promise<void>;
    onConfirmPayment: (machineId: string | null, amount: number, paymentMethod: PaymentMethod, options?: { markAsUnpaid?: boolean; soldProducts?: SoldProduct[]; customerId?: string; customerName?: string; customerCode?: string }) => void;
  isProcessingPayment?: boolean;
  inventoryByProduct?: Record<string, number>; // productId -> stock
  fractionMinutes?: number;
 };

export default function ProductsPOSDialog({
  isOpen,
  onOpenChange,
  machine,
  products,
  customers,
  onSaveProducts,
  onConfirmPayment,
  isProcessingPayment = false,
  inventoryByProduct,
  fractionMinutes = 5,
}: ProductsPOSDialogProps) {
  const session = machine?.session ?? null;
  const elapsedSeconds = session ? Math.max(0, Math.floor((Date.now() - session.startTime) / 1000)) : 0;

  const handleSave = async (products: SoldProduct[]) => {
    await onSaveProducts(machine?.id ?? "", products);
  };

  const machineTitle = machine?.name || "Venta libre";
  const descriptionLabel = session ? (sanitizeString(session.client) || "Cliente Ocasional") : "Venta independiente";

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[100vw] sm:max-w-xl p-0 overflow-hidden h-full flex flex-col border-l border-border bg-background text-foreground [&>button]:hidden">
        <div className="bg-card p-4 border-b border-border relative overflow-hidden">
          <SheetHeader className="space-y-1 relative z-10">
            <button 
              onClick={() => onOpenChange(false)}
              className="absolute right-0 top-0 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
            >
              <X size={18} />
            </button>
            <SheetTitle className="text-lg font-bold tracking-tight flex items-center text-foreground">
              <ShoppingCart className="text-muted-foreground mr-2" size={18} />
              Punto de Venta - <span className="text-primary ml-1">{machineTitle}</span>
            </SheetTitle>
            <SheetDescription className="text-xs font-medium text-muted-foreground mt-1 flex items-center gap-2">
              <span className="bg-background px-2.5 py-1 rounded-md text-foreground font-semibold border border-border shadow-sm">
                {descriptionLabel}
              </span>
              {session && (
                <span className="bg-primary/15 text-primary px-2.5 py-1 rounded-md font-mono font-bold tracking-tight border border-primary/30 shadow-sm">
                  {formatTime(elapsedSeconds)}
                </span>
              )}
            </SheetDescription>
          </SheetHeader>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto bg-background">
          <ProductsPOS
            availableProducts={products}
            initialProducts={session?.soldProducts}
            onSave={handleSave}
            onClose={() => onOpenChange(false)}
            onConfirmPayment={(amount, paymentMethod, options) => onConfirmPayment(machine?.id ?? null, amount, paymentMethod, options)}
            isProcessing={isProcessingPayment}
            inventoryByProduct={inventoryByProduct}
            activeSession={session ?? undefined}
            fractionMinutes={fractionMinutes}
            machineName={machineTitle}
            machineId={machine?.id}
            customerOptions={customers}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
