"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useCartStore } from "@/store/useCartStore";
import type { Product, SoldProduct, Session, PaymentMethod } from "@/lib/types";
import { formatCurrency, formatTime, formatDuration } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PlusCircle, MinusCircle, ShoppingCart, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { calculateSessionCost } from "@/lib/session-cost";

interface ProductsPOSProps {
    availableProducts: Product[];
    initialProducts?: SoldProduct[];
    onSave: (products: SoldProduct[]) => Promise<void>;
    onClose?: () => void;
    onGoToCharge?: (products: SoldProduct[]) => void;
    inventoryByProduct?: Record<string, number>;
    activeSession?: Session;
    fractionMinutes?: number;
    onConfirmPayment?: (amount: number, paymentMethod: PaymentMethod) => void;
    isProcessing?: boolean;
    machineName?: string;
}

const categoryLabels = {
  drink: "Bebidas",
  snack: "Snacks",
  food: "Comida",
  other: "Otros",
};

const categoryIcons = {
  drink: "🥤",
  snack: "🍪",
  food: "🍔",
  other: "📦",
};

export default function ProductsPOS({ 
  availableProducts, 
  initialProducts, 
  onSave, 
  onClose, 
  onGoToCharge,
  inventoryByProduct = {},
  activeSession,
  fractionMinutes = 5,
  onConfirmPayment,
  isProcessing = false,
  machineName = "PC",
}: ProductsPOSProps) {
    const { quantities, updateQuantity, setQuantities, clearCart } = useCartStore();
    const [searchTerm, setSearchTerm] = useState("");
    const [onlyInStock, setOnlyInStock] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isCheckoutExpanded, setIsCheckoutExpanded] = useState(false);
    const posSearchRef = useRef<HTMLInputElement>(null);

    // Payment States
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('efectivo');
    const [amountPaid, setAmountPaid] = useState<string>("");

    // Tick for timer
    const [tick, setTick] = useState(0);
    useEffect(() => {
        if (!activeSession) return;
        const timer = setInterval(() => {
            setTick(t => t + 1);
        }, 1000);
        return () => clearInterval(timer);
    }, [activeSession]);

    useEffect(() => {
        if (posSearchRef.current) {
            posSearchRef.current.focus();
        }
    }, []);

    useEffect(() => {
        if (!initialProducts || initialProducts.length === 0) {
            clearCart();
            return;
        }
        const initialQuantities = initialProducts.reduce((acc, item) => {
            acc[item.productId] = item.quantity;
            return acc;
        }, {} as Record<string, number>);
        setQuantities(initialQuantities);
    }, [initialProducts, setQuantities, clearCart]);

    const filteredProducts = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase();
        return availableProducts.filter((p) => {
            if (p.isActive === false) return false;
            if (normalizedSearch && !p.name.toLowerCase().includes(normalizedSearch)) return false;
            if (onlyInStock) {
                const stock = inventoryByProduct[p.id] !== undefined
                    ? Math.max(0, inventoryByProduct[p.id])
                    : Math.max(0, p.stock ?? 0);
                if (stock <= 0) return false;
            }
            return true;
        });
    }, [availableProducts, searchTerm, onlyInStock, inventoryByProduct]);

    const getAvailableStock = (productId: string, product: Product): number => {
        if (inventoryByProduct && inventoryByProduct[productId] !== undefined) {
            return Math.max(0, inventoryByProduct[productId]);
        }
        return Math.max(0, product.stock ?? 0);
    };

    const handleQuantityChange = (productId: string, delta: number) => {
        const product = availableProducts.find(p => p.id === productId);
        if (!product) return;
        const availableStock = getAvailableStock(productId, product);
        updateQuantity(productId, delta, availableStock);
    };

    const costCalculation = useMemo(() => {
        if (!activeSession) return null;
        return calculateSessionCost(activeSession, fractionMinutes);
    }, [activeSession, fractionMinutes, tick]);

    const productsTotal = Object.entries(quantities).reduce((acc, [productId, quantity]) => {
        const product = availableProducts.find(p => p.id === productId);
        return acc + (product ? product.price * quantity : 0);
    }, 0);

    const sessionCost = costCalculation?.sessionCost || 0;
    const total = productsTotal + sessionCost;

    const numAmountPaid = Math.max(0, parseFloat(amountPaid) || 0);
    const change = numAmountPaid > total ? numAmountPaid - total : 0;

    const soldProducts = useMemo(() => {
        return Object.entries(quantities).map(([productId, quantity]) => {
            const product = availableProducts.find(p => p.id === productId)!;
            return {
                productId,
                productName: product?.name || "Producto",
                quantity,
                unitPrice: product?.price || 0
            };
        });
    }, [quantities, availableProducts]);

    const renderProductRow = (product: Product) => {
        const availableStock = getAvailableStock(product.id, product);
        const isOutOfStock = availableStock === 0;
        const currentQty = quantities[product.id] || 0;

        return (
            <div
                key={product.id}
                className={`flex justify-between items-center p-3 rounded-xl border transition-all duration-200 ${
                    isOutOfStock 
                        ? 'border-zinc-900 bg-zinc-950/40 opacity-40 pointer-events-none' 
                        : currentQty > 0 
                            ? 'border-emerald-500/40 bg-emerald-500/10 shadow-[0_0_12px_rgba(16,185,129,0.08)]'
                            : 'border-zinc-800/60 bg-zinc-900/30 hover:bg-zinc-900/80 hover:border-zinc-700 cursor-pointer'
                }`}
                onClick={() => !isOutOfStock && currentQty === 0 && handleQuantityChange(product.id, 1)}
            >
                <div className="flex-1 min-w-0 pr-2 select-none">
                    <span className="text-zinc-100 font-semibold text-sm block truncate tracking-tight">
                        {product.name}
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-emerald-400 font-mono font-bold text-sm">
                            {formatCurrency(product.price)}
                        </span>
                        {availableStock > 0 && (
                            <Badge variant="outline" className="text-[9px] font-mono border-zinc-800/60 bg-zinc-950 text-zinc-400 py-0 px-1.5">
                                Stock: {availableStock}
                            </Badge>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {currentQty > 0 ? (
                        <div className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-850 p-1.5 rounded-xl shadow-inner">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-11 w-11 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 disabled:opacity-30 rounded-lg"
                                onClick={() => handleQuantityChange(product.id, -1)}
                            >
                                <MinusCircle className="w-5 h-5" />
                            </Button>
                            <span className="text-emerald-400 font-mono font-bold text-sm min-w-[24px] text-center">
                                {currentQty}
                            </span>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-11 w-11 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 disabled:opacity-30 rounded-lg"
                                onClick={() => handleQuantityChange(product.id, 1)}
                                disabled={currentQty >= availableStock}
                            >
                                <PlusCircle className="w-5 h-5" />
                            </Button>
                        </div>
                    ) : (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-11 w-11 text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-xl border border-zinc-800 hover:border-emerald-500/30 transition-all flex items-center justify-center"
                            onClick={() => handleQuantityChange(product.id, 1)}
                        >
                            <PlusCircle className="w-5 h-5" />
                        </Button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-[100dvh] bg-slate-950 text-slate-50 font-body overflow-hidden">
            {/* Header Búsqueda */}
            <div className="p-4 border-b border-slate-900 space-y-3 shrink-0 bg-slate-950">
                <Input
                    ref={posSearchRef}
                    placeholder="Buscar producto..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={async (e) => {
                        if (e.key === "Enter" && !e.ctrlKey) {
                            if (filteredProducts.length > 0) {
                                const firstProduct = filteredProducts[0];
                                const availableStock = getAvailableStock(firstProduct.id, firstProduct);
                                const currentQty = quantities[firstProduct.id] || 0;
                                if (currentQty < availableStock) {
                                    handleQuantityChange(firstProduct.id, 1);
                                    setSearchTerm(""); // Limpia la barra
                                }
                            }
                        } else if (e.key === "Enter" && e.ctrlKey) {
                            // Cobro Directo
                            if (soldProducts.length > 0 && onGoToCharge) {
                                e.preventDefault();
                                await onSave(soldProducts);
                                onGoToCharge(soldProducts);
                            }
                        }
                    }}
                    className="h-10 text-sm bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-emerald-500"
                />
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">
                        {filteredProducts.length} Resultados
                    </span>
                    <div className="flex items-center gap-2">
                        <Label htmlFor="only-in-stock" className="text-xs text-slate-400 cursor-pointer select-none">
                            Solo con stock
                        </Label>
                        <Switch
                            id="only-in-stock"
                            checked={onlyInStock}
                            onCheckedChange={setOnlyInStock}
                            className="data-[state=checked]:bg-primary"
                        />
                    </div>
                </div>
            </div>

            {/* Listado de Productos */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/20">
                <Tabs defaultValue="drink" className="w-full flex flex-col h-full">
                    <TabsList className="grid grid-cols-4 h-auto bg-slate-900/60 p-1 border border-slate-800 rounded-xl shrink-0 mb-3">
                        {Object.entries(categoryLabels).map(([cat, label]) => (
                            <TabsTrigger key={cat} value={cat} className="text-xs py-1.5 flex flex-col sm:flex-row items-center justify-center gap-1 rounded-lg data-[state=active]:bg-slate-800 data-[state=active]:text-primary">
                                <span className="text-sm">{categoryIcons[cat as keyof typeof categoryIcons]}</span>
                                <span className="text-[10px] tracking-wider hidden sm:inline font-bold uppercase">{label}</span>
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    {Object.keys(categoryLabels).map((cat) => {
                        const categoryProducts = filteredProducts.filter(p => p.category === cat);
                        return (
                            <TabsContent key={cat} value={cat} className="flex-1 min-h-0 mt-0 focus-visible:ring-0">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    {categoryProducts.length === 0 ? (
                                        <div className="py-8 text-center text-xs text-slate-500 bg-slate-900/20 border border-slate-900 rounded-xl">
                                            Sin productos en esta categoría
                                        </div>
                                    ) : (
                                        categoryProducts.map(renderProductRow)
                                    )}
                                </div>
                            </TabsContent>
                        );
                    })}
                </Tabs>
            </div>

            {/* Summary / Footer táctico */}
            <div className="mt-auto border-t border-zinc-800 bg-zinc-950 p-4 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] space-y-4 shrink-0">
                
                {activeSession && (
                    <div className="flex justify-between items-center py-1 border-b border-zinc-800/40 mb-1">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                            Detalles de Cobro
                        </span>
                        <Button 
                            variant="outline" 
                            size="sm"
                            className="h-6 px-2.5 text-[10px] font-bold bg-zinc-900 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 border-zinc-800"
                            onClick={() => setIsCheckoutExpanded(!isCheckoutExpanded)}
                        >
                            {isCheckoutExpanded ? "Ocultar Horas y Pago" : "Ver Horas y Pago"}
                        </Button>
                    </div>
                )}

                {activeSession && isCheckoutExpanded && costCalculation && (
                    <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800/60 space-y-2 text-xs">
                        <div className="flex justify-between items-center">
                            <span className="text-zinc-400 font-semibold uppercase tracking-wider text-[10px]">Tiempo Transcurrido:</span>
                            <span className="font-mono font-bold text-zinc-200 bg-zinc-950 px-2 py-0.5 rounded-md border border-zinc-800/60 shadow-sm">
                                {formatTime(Math.floor(costCalculation.elapsedSeconds))}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-zinc-400 font-semibold uppercase tracking-wider text-[10px]">Costo de Tiempo:</span>
                            <span className="font-mono font-bold text-emerald-400">
                                {formatCurrency(costCalculation.sessionCost)}
                            </span>
                        </div>
                        {costCalculation.elapsedMinutes < 10 && (
                            <div className="text-[9px] text-amber-400/80 font-medium pt-0.5 border-t border-zinc-800/40">
                                * Tarifa mínima aplicada (S/ 0.50)
                            </div>
                        )}
                    </div>
                )}

                {activeSession && isCheckoutExpanded && (
                    <div className="space-y-3 p-3 rounded-xl bg-zinc-900 border border-zinc-800/60">
                        <Label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">Medio de Pago</Label>
                        <RadioGroup
                            value={paymentMethod}
                            onValueChange={(val) => setPaymentMethod(val as PaymentMethod)}
                            className="grid grid-cols-3 gap-1"
                        >
                            <Label htmlFor="efectivo" className="flex flex-col items-center justify-center gap-1 rounded-lg border border-zinc-800 bg-zinc-950 p-2 cursor-pointer transition-all hover:bg-zinc-800/50 [&:has([data-state=checked])]:border-emerald-500 [&:has([data-state=checked])]:bg-emerald-500/10">
                                <RadioGroupItem value="efectivo" id="efectivo" className="sr-only" />
                                <span className="text-xs font-bold">Efectivo</span>
                            </Label>
                            <Label htmlFor="yape" className="flex flex-col items-center justify-center gap-1 rounded-lg border border-zinc-800 bg-zinc-950 p-2 cursor-pointer transition-all hover:bg-zinc-800/50 [&:has([data-state=checked])]:border-[#742384] [&:has([data-state=checked])]:bg-[#742384]/10">
                                <RadioGroupItem value="yape" id="yape" className="sr-only" />
                                <span className="text-xs font-bold">Yape/Plin</span>
                            </Label>
                            <Label htmlFor="otro" className="flex flex-col items-center justify-center gap-1 rounded-lg border border-zinc-800 bg-zinc-950 p-2 cursor-pointer transition-all hover:bg-zinc-800/50 [&:has([data-state=checked])]:border-amber-500 [&:has([data-state=checked])]:bg-amber-500/10">
                                <RadioGroupItem value="otro" id="otro" className="sr-only" />
                                <span className="text-xs font-bold">Tarjeta</span>
                            </Label>
                        </RadioGroup>

                        {paymentMethod === 'efectivo' && (
                            <div className="space-y-2 p-2 bg-zinc-950 border border-zinc-800/60 rounded-lg">
                                <div className="flex justify-between items-center">
                                    <Label htmlFor="amount-paid" className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider">Recibido (S/.)</Label>
                                    <Input
                                        id="amount-paid"
                                        type="number"
                                        min={0}
                                        placeholder={total.toFixed(2)}
                                        value={amountPaid}
                                        onChange={(e) => setAmountPaid(e.target.value)}
                                        className="text-right font-mono font-bold h-8 border-zinc-800 bg-zinc-900 text-zinc-100 text-xs w-24 focus-visible:ring-emerald-500"
                                    />
                                </div>
                                {change > 0 && (
                                    <div className="flex justify-between items-center pt-1 border-t border-zinc-900">
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">Vuelto:</span>
                                        <span className="text-sm font-black font-mono text-emerald-400">
                                            {formatCurrency(change)}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {soldProducts.length > 0 && (
                    <div className="max-h-32 overflow-y-auto space-y-2 pr-1 text-xs text-zinc-400">
                        {soldProducts.map((sp) => (
                            <div key={sp.productId} className="flex items-center justify-between border-b border-zinc-900 pb-1.5 last:border-0 last:pb-0">
                                <span className="truncate max-w-[200px]">{sp.productName}</span>
                                <div className="flex items-center gap-2 font-mono">
                                    <div className="flex items-center gap-1 bg-zinc-900 px-1.5 py-0.5 rounded-md border border-zinc-800">
                                        <button
                                            className="text-zinc-500 hover:text-zinc-200 transition-colors disabled:opacity-30"
                                            onClick={() => handleQuantityChange(sp.productId, -1)}
                                        >
                                            <MinusCircle className="w-3.5 h-3.5" />
                                        </button>
                                        <span className="text-zinc-200 font-bold text-xs min-w-[16px] text-center">{sp.quantity}</span>
                                        <button
                                            className="text-zinc-500 hover:text-zinc-200 transition-colors disabled:opacity-30"
                                            onClick={() => handleQuantityChange(sp.productId, 1)}
                                        >
                                            <PlusCircle className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                    <span className="font-bold text-emerald-400 text-xs ml-1">{formatCurrency(sp.quantity * sp.unitPrice)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-zinc-900/50">
                    <span className="text-zinc-400 text-xs uppercase tracking-widest font-bold">
                        Total Cuenta:
                    </span>
                    <span className="font-mono text-3xl font-black text-emerald-400">
                        {formatCurrency(total)}
                    </span>
                </div>

                {activeSession && onConfirmPayment && (
                    <div className="flex items-start gap-2 p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-[11px] text-amber-200/90 leading-tight mb-2 mt-1">
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <p>
                            Estás cobrando con <strong>{paymentMethod.toUpperCase()}</strong>.
                            {paymentMethod === 'efectivo' 
                              ? " Recuerda registrar SIEMPRE el monto físico que te está entregando el cliente." 
                              : " Valida que el comprobante digital corresponda al total."}
                        </p>
                    </div>
                )}

                {activeSession && onConfirmPayment && (
                    <Button 
                        onClick={async () => {
                            try {
                                setIsSaving(true);
                                await onSave(soldProducts);
                                if (onConfirmPayment) onConfirmPayment(total, paymentMethod);
                            } finally {
                                setIsSaving(false);
                            }
                        }} 
                        disabled={isSaving || isProcessing}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base py-5 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all"
                    >
                        {isProcessing ? "Procesando..." : "FINALIZAR Y COBRAR"}
                    </Button>
                )}

                {!activeSession && onGoToCharge && (
                    <Button 
                        onClick={async () => {
                            try {
                                setIsSaving(true);
                                await onSave(soldProducts);
                                if (onGoToCharge) onGoToCharge(soldProducts);
                            } finally {
                                setIsSaving(false);
                            }
                        }} 
                        disabled={isSaving}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-lg py-6 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all"
                    >
                        Cobrar (Enter)
                    </Button>
                )}

                <div className="flex gap-2 pt-1">
                    {onClose && (
                        <Button 
                            variant="ghost" 
                            onClick={onClose} 
                            disabled={isSaving}
                            className="flex-1 h-11 text-xs font-bold text-zinc-400 hover:bg-zinc-900 border border-zinc-800"
                        >
                            Cerrar (Esc)
                        </Button>
                    )}
                    <Button 
                        onClick={async () => {
                            try {
                                setIsSaving(true);
                                await onSave(soldProducts);
                                if (onClose) onClose();
                            } finally {
                                setIsSaving(false);
                            }
                        }} 
                        disabled={isSaving}
                        className="flex-[2] h-11 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 font-bold text-xs border border-zinc-700"
                    >
                        <ShoppingCart className="w-4 h-4 mr-1.5" />
                        {isSaving ? "Guardando..." : (activeSession ? `Añadir a la cuenta de ${machineName}` : "Guardar Cambios")}
                    </Button>
                </div>
            </div>
        </div>
    );
}
