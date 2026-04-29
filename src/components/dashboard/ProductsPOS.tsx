"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useCartStore } from "@/store/useCartStore";
import type { Product, SoldProduct, Session, PaymentMethod, CardItem } from "@/lib/types";
import { formatCurrency, formatTime, formatDuration } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PlusCircle, MinusCircle, ShoppingCart } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { calculateSessionCost } from "@/lib/session-cost";
import { useFirestore } from "@/firebase";
import { doc, getDoc } from "firebase/firestore";
import { applyCardToSession } from "@/lib/services/sales";

interface ProductsPOSProps {
    availableProducts: Product[];
    initialProducts?: SoldProduct[];
    onSave: (products: SoldProduct[], discount?: Session['discount']) => Promise<void>;
    onClose?: () => void;
    onGoToCharge?: (products: SoldProduct[]) => void;
    inventoryByProduct?: Record<string, number>;
    activeSession?: Session;
    fractionMinutes?: number;
    onConfirmPayment?: (amount: number, paymentMethod: PaymentMethod, options?: { markAsUnpaid?: boolean }) => void;
    isProcessing?: boolean;
    machineName?: string;
    machineId?: string;
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
    machineId,
}: ProductsPOSProps) {
    const { quantities, updateQuantity, setQuantities, clearCart } = useCartStore();
    const [searchTerm, setSearchTerm] = useState("");
    const [onlyInStock, setOnlyInStock] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
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
        const grossTotal = productsTotal + sessionCost;
        const appliedDiscount = Math.max(0, Math.round((activeSession?.discount?.amount ?? 0) * 100) / 100);
        const total = Math.max(0, Math.round((grossTotal - appliedDiscount) * 100) / 100);
    const canRegisterDebt = Boolean(activeSession?.clientId);
            const sessionDiscount = appliedDiscount > 0
                ? { amount: appliedDiscount, reason: activeSession?.discount?.reason || "PROMOCION" }
                : undefined;

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

    // Customer cards
    const firestore = useFirestore();
    const [customerCards, setCustomerCards] = useState<CardItem[] | null>(null);
    const [loadingCards, setLoadingCards] = useState(false);

    useEffect(() => {
        const fetchCards = async () => {
            if (!activeSession?.clientId) {
                setCustomerCards(null);
                return;
            }
            setLoadingCards(true);
            try {
                const ref = doc(firestore, 'customers', activeSession.clientId);
                const snap = await getDoc(ref);
                if (snap.exists()) {
                    const data = snap.data();
                    setCustomerCards(data.inventoryCards || []);
                } else {
                    setCustomerCards([]);
                }
            } catch (e) {
                console.error('Error fetching customer cards', e);
                setCustomerCards([]);
            } finally {
                setLoadingCards(false);
            }
        };
        fetchCards();
    }, [activeSession?.clientId, firestore]);

    const renderProductRow = (product: Product) => {
        const availableStock = getAvailableStock(product.id, product);
        const isOutOfStock = availableStock === 0;
        const currentQty = quantities[product.id] || 0;

        return (
            <div
                key={product.id}
                className={`group relative overflow-hidden flex flex-col justify-between p-2.5 rounded-xl border transition-all duration-200 select-none ${
                    isOutOfStock 
                        ? 'border-border bg-muted/20 opacity-50 pointer-events-none' 
                        : currentQty > 0 
                            ? 'border-primary bg-primary/5 ring-1 ring-primary/20 cursor-pointer'
                            : 'border-border/60 bg-card/60 hover:bg-secondary/60 hover:border-border cursor-pointer'
                }`}
                onClick={() => {
                   if (!isOutOfStock) handleQuantityChange(product.id, 1);
                }}
            >
                <div className="flex justify-between items-start mb-2">
                   <span className="text-foreground font-semibold text-xs leading-tight line-clamp-2">
                        {product.name}
                   </span>
                   {currentQty > 0 && (
                      <Badge className="bg-primary text-primary-foreground font-bold px-1.5 py-0 min-w-[20px] text-center ml-1">
                         {currentQty}
                      </Badge>
                   )}
                </div>
                
                <div className="flex items-end justify-between mt-auto">
                   <div className="flex flex-col">
                        <span className="text-primary font-mono font-bold text-sm">
                            {formatCurrency(product.price)}
                        </span>
                        <span className="text-[10px] text-muted-foreground mt-0.5">
                            Stock: {availableStock}
                        </span>
                   </div>
                   
                   {currentQty > 0 && (
                       <div className="flex items-center gap-1 bg-background/80 backdrop-blur-sm border border-border rounded-lg p-0.5 shadow-sm" onClick={(e) => e.stopPropagation()}>
                            <button
                                className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors"
                                onClick={() => handleQuantityChange(product.id, -1)}
                            >
                                <MinusCircle className="w-3.5 h-3.5" />
                            </button>
                            <span className="font-mono font-bold text-xs min-w-[16px] text-center">{currentQty}</span>
                            <button
                                className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors disabled:opacity-30"
                                onClick={() => handleQuantityChange(product.id, 1)}
                                disabled={currentQty >= availableStock}
                            >
                                <PlusCircle className="w-3.5 h-3.5" />
                            </button>
                       </div>
                   )}
                </div>
            </div>
        );
    };

    return (
        <div className="flex h-full min-h-0 flex-col bg-background text-foreground font-body overflow-hidden">
            {/* Header Búsqueda */}
            <div className="p-3 border-b border-border space-y-2 shrink-0 bg-card/70">
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
                    className="h-9 text-sm bg-card border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
                />
                <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground tracking-wide uppercase">
                        {filteredProducts.length} Resultados
                    </span>
                    <div className="flex items-center gap-2">
                        <Label htmlFor="only-in-stock" className="text-xs text-muted-foreground cursor-pointer select-none">
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
            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3 bg-background">
                <Tabs defaultValue="drink" className="w-full">
                    <TabsList className="grid grid-cols-4 h-auto bg-card/70 p-1 border border-border rounded-xl shrink-0 mb-3">
                        {Object.entries(categoryLabels).map(([cat, label]) => (
                            <TabsTrigger key={cat} value={cat} className="text-xs py-1.5 flex flex-col sm:flex-row items-center justify-center gap-1 rounded-lg data-[state=active]:bg-secondary data-[state=active]:text-primary">
                                <span className="text-sm">{categoryIcons[cat as keyof typeof categoryIcons]}</span>
                                <span className="text-xs tracking-wide font-semibold uppercase">{label}</span>
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    {Object.keys(categoryLabels).map((cat) => {
                        const categoryProducts = filteredProducts.filter(p => p.category === cat);
                        return (
                            <TabsContent key={cat} value={cat} className="mt-0 focus-visible:ring-0">
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {categoryProducts.length === 0 ? (
                                        <div className="py-8 text-center text-xs text-muted-foreground bg-card/40 border border-border rounded-xl">
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
            {/* Summary / Footer táctico */}
            <div className="mt-auto border-t border-border bg-card p-3 shadow-[0_-8px_20px_hsl(var(--background)/0.35)] space-y-2 shrink-0 z-10">
                
                {activeSession && costCalculation && (
                    <div className="flex gap-2">
                        <div className="flex-1 p-1.5 rounded-xl bg-secondary/35 border border-border/60 flex justify-between items-center px-3">
                            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Tiempo:</span>
                            <span className="font-mono font-bold text-foreground text-sm">{formatTime(Math.floor(costCalculation.elapsedSeconds))}</span>
                        </div>
                        <div className="flex-1 p-1.5 rounded-xl bg-secondary/35 border border-border/60 flex justify-between items-center px-3">
                            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Costo:</span>
                            <span className="font-mono font-bold text-primary text-sm">{formatCurrency(costCalculation.sessionCost)}</span>
                        </div>
                    </div>
                )}

                {activeSession && (
                    <RadioGroup
                        value={paymentMethod}
                        onValueChange={(val) => setPaymentMethod(val as PaymentMethod)}
                        className="flex gap-1"
                    >
                        <Label htmlFor="efectivo" className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-border bg-background py-1.5 cursor-pointer transition-all hover:bg-secondary [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/10">
                            <RadioGroupItem value="efectivo" id="efectivo" className="sr-only" />
                            <span className="text-xs font-bold">Efectivo</span>
                        </Label>
                        <Label htmlFor="yape" className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-border bg-background py-1.5 cursor-pointer transition-all hover:bg-secondary [&:has([data-state=checked])]:border-info [&:has([data-state=checked])]:bg-info/10">
                            <RadioGroupItem value="yape" id="yape" className="sr-only" />
                            <span className="text-xs font-bold">Yape</span>
                        </Label>
                        <Label htmlFor="otro" className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-border bg-background py-1.5 cursor-pointer transition-all hover:bg-secondary [&:has([data-state=checked])]:border-status-warning [&:has([data-state=checked])]:bg-status-warning/10">
                            <RadioGroupItem value="otro" id="otro" className="sr-only" />
                            <span className="text-xs font-bold">Tarjeta</span>
                        </Label>
                    </RadioGroup>
                )}

                {activeSession && paymentMethod === 'efectivo' && (
                    <div className="flex items-center gap-2 p-1.5 px-3 bg-background border border-border/60 rounded-lg">
                        <Label htmlFor="amount-paid" className="text-[10px] font-semibold uppercase text-muted-foreground whitespace-nowrap">Recibido:</Label>
                        <Input
                            id="amount-paid"
                            type="number"
                            min={0}
                            placeholder={total.toFixed(2)}
                            value={amountPaid}
                            onChange={(e) => setAmountPaid(e.target.value)}
                            className="h-7 text-right font-mono font-bold border-none bg-transparent text-foreground text-sm focus-visible:ring-0 flex-1 px-0"
                        />
                        {change > 0 && (
                            <span className="text-sm font-mono font-bold text-primary whitespace-nowrap ml-2 border-l border-border pl-2">
                                Vuelto: {formatCurrency(change)}
                            </span>
                        )}
                    </div>
                )}

                {soldProducts.length > 0 && (
                    <div className="max-h-[80px] overflow-y-auto space-y-1 pr-1 text-xs bg-secondary/10 rounded-lg p-1.5 border border-border/40">
                        {soldProducts.map((sp) => (
                            <div key={sp.productId} className="flex items-center justify-between border-b border-border/40 pb-1 last:border-0 last:pb-0">
                                <span className="truncate max-w-[140px] font-medium">{sp.productName}</span>
                                <div className="flex items-center gap-1.5">
                                    <div className="flex items-center gap-1 bg-background px-1 py-0.5 rounded border border-border">
                                        <button className="text-muted-foreground hover:text-foreground disabled:opacity-30" onClick={() => handleQuantityChange(sp.productId, -1)}>
                                            <MinusCircle className="w-3 h-3" />
                                        </button>
                                        <span className="font-mono font-bold text-[10px] min-w-[12px] text-center">{sp.quantity}</span>
                                        <button className="text-muted-foreground hover:text-foreground disabled:opacity-30" onClick={() => handleQuantityChange(sp.productId, 1)}>
                                            <PlusCircle className="w-3 h-3" />
                                        </button>
                                    </div>
                                    <span className="font-bold font-mono text-primary text-xs w-12 text-right">{formatCurrency(sp.quantity * sp.unitPrice)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeSession?.clientId && customerCards && customerCards.length > 0 && (
                    <div className="space-y-1 p-1.5 rounded-lg border border-border bg-secondary/20">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase px-1">Cartas Disponibles</span>
                        <div className="grid gap-1">
                            {customerCards.map((c) => (
                                <div key={c.id} className="flex items-center justify-between p-1 px-2 bg-background border border-border rounded">
                                    <div className="text-[10px] flex items-center gap-2">
                                        <span className="font-semibold">{c.name}</span>
                                        <span className="text-muted-foreground">{c.type} {c.value ? `• ${c.value}` : ''}</span>
                                    </div>
                                    <Button size="sm" onClick={async () => {
                                        try {
                                            if (!machineId) throw new Error('Station id not available');
                                            await applyCardToSession(firestore, machineId, activeSession.clientId!, c.id);
                                            const ref = doc(firestore, 'customers', activeSession.clientId!);
                                            const snap = await getDoc(ref);
                                            if (snap.exists()) setCustomerCards(snap.data().inventoryCards || []);
                                        } catch (e) {
                                            console.error(e);
                                        }
                                    }} disabled={c.isUsed} className="h-5 text-[9px] px-2">{c.isUsed ? 'Usada' : 'Usar'}</Button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex items-center justify-between pt-1">
                    <span className="text-foreground text-sm uppercase tracking-wide font-bold">Total:</span>
                    <div className="flex items-center gap-2">
                        {appliedDiscount > 0 && <span className="text-[10px] text-status-warning font-mono line-through opacity-70">{formatCurrency(grossTotal)}</span>}
                        <span className="font-mono text-2xl font-black text-primary">{formatCurrency(total)}</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    {activeSession && onConfirmPayment ? (
                        <>
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
                                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs py-2 h-10 rounded-xl"
                            >
                                {isProcessing ? "..." : "COBRAR"}
                            </Button>
                            <Button
                                onClick={async () => {
                                    try {
                                        setIsSaving(true);
                                        await onSave(soldProducts);
                                        if (onConfirmPayment) onConfirmPayment(total, 'deuda', { markAsUnpaid: true });
                                    } finally {
                                        setIsSaving(false);
                                    }
                                }}
                                disabled={isSaving || isProcessing || !canRegisterDebt}
                                variant="destructive"
                                className="font-bold text-xs py-2 h-10 rounded-xl"
                            >
                                {isProcessing ? "..." : "NO PAGÓ"}
                            </Button>
                        </>
                    ) : (
                        onGoToCharge && (
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
                                className="col-span-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs py-2 h-10 rounded-xl"
                            >
                                COBRAR
                            </Button>
                        )
                    )}
                </div>

                <div className="flex gap-2">
                    {onClose && (
                        <Button 
                            variant="ghost" 
                            onClick={onClose} 
                            disabled={isSaving}
                            className="flex-1 h-8 text-[10px] font-semibold text-muted-foreground hover:bg-secondary border border-border rounded-lg"
                        >
                            Cerrar
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
                        className="flex-[2] h-8 bg-secondary text-secondary-foreground hover:bg-secondary/80 font-semibold text-[10px] border border-border rounded-lg"
                    >
                        <ShoppingCart className="w-3 h-3 mr-1.5" />
                        {isSaving ? "Guardando..." : "Guardar Carrito"}
                    </Button>
                </div>
                
                {activeSession && onConfirmPayment && !canRegisterDebt && (
                    <p className="text-[10px] text-center text-status-warning bg-status-warning/10 rounded px-1 py-0.5">Vincule cliente para registrar deuda.</p>
                )}
            </div>
        </div>
    );
}
