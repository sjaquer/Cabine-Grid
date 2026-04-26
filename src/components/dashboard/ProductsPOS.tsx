"use client";

import { useState, useMemo, useEffect } from "react";
import { useCartStore } from "@/store/useCartStore";
import type { Product, SoldProduct } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PlusCircle, MinusCircle, ShoppingCart } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface ProductsPOSProps {
    availableProducts: Product[];
    initialProducts?: SoldProduct[];
    onSave: (products: SoldProduct[]) => Promise<void>;
    onClose?: () => void;
    onGoToCharge?: (products: SoldProduct[]) => void;
    inventoryByProduct?: Record<string, number>;
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
  inventoryByProduct = {}
}: ProductsPOSProps) {
    const { quantities, updateQuantity, setQuantities, clearCart } = useCartStore();
    const [searchTerm, setSearchTerm] = useState("");
    const [onlyInStock, setOnlyInStock] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

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

    const total = Object.entries(quantities).reduce((acc, [productId, quantity]) => {
        const product = availableProducts.find(p => p.id === productId);
        return acc + (product ? product.price * quantity : 0);
    }, 0);

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
                className={`flex items-center justify-between p-2.5 rounded-xl border border-slate-800 bg-slate-900/40 transition-all shadow-sm ${
                    isOutOfStock ? 'opacity-40 pointer-events-none' : 'hover:bg-slate-800/60'
                }`}
            >
                <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-sm text-slate-100 truncate">{product.name}</span>
                        {availableStock > 0 && (
                            <Badge variant="outline" className="text-[9px] font-bold border-slate-700 text-slate-400 py-0 px-1">
                                Stk: {availableStock}
                            </Badge>
                        )}
                    </div>
                    <span className="text-xs font-black text-primary mt-0.5 block">
                        {formatCurrency(product.price)}
                    </span>
                </div>
                <div className="flex items-center gap-1 bg-slate-950/60 rounded-lg p-1 border border-slate-800/50">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-md text-slate-400 hover:bg-destructive/20 hover:text-destructive disabled:opacity-30"
                        onClick={() => handleQuantityChange(product.id, -1)}
                        disabled={currentQty === 0}
                    >
                        <MinusCircle className="w-4 h-4" />
                    </Button>
                    <span className="w-6 text-center text-xs font-black text-slate-50 tabular-nums">
                        {currentQty}
                    </span>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-md text-slate-400 hover:bg-emerald-500/20 hover:text-emerald-400 disabled:opacity-30"
                        onClick={() => handleQuantityChange(product.id, 1)}
                        disabled={currentQty >= availableStock}
                    >
                        <PlusCircle className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-slate-950 text-slate-50 font-body overflow-hidden">
            {/* Header Búsqueda */}
            <div className="p-4 border-b border-slate-900 space-y-3 shrink-0 bg-slate-950">
                <Input
                    placeholder="Buscar producto..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-10 text-sm bg-slate-900 border-slate-800 text-slate-50 focus-visible:ring-primary/50"
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
                                <div className="grid grid-cols-1 gap-2">
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

            {/* Summary / Footer */}
            <div className="p-4 border-t border-slate-900 bg-slate-900/30 shrink-0 space-y-3">
                {soldProducts.length > 0 && (
                    <div className="max-h-24 overflow-y-auto space-y-1 pr-1 text-[11px]">
                        {soldProducts.map((sp) => (
                            <div key={sp.productId} className="flex items-center justify-between text-slate-400">
                                <span>{sp.quantity}x {sp.productName}</span>
                                <span className="font-mono font-bold text-slate-200">{formatCurrency(sp.quantity * sp.unitPrice)}</span>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex items-center justify-between">
                    <span className="text-xs font-bold tracking-wider uppercase text-slate-400">
                        Total Compra:
                    </span>
                    <span className="text-xl font-black text-primary tracking-tight font-mono">
                        {formatCurrency(total)}
                    </span>
                </div>

                <div className="flex gap-2 pt-1">
                    {onClose && (
                        <Button 
                            variant="ghost" 
                            onClick={onClose} 
                            disabled={isSaving}
                            className="flex-1 h-11 text-xs font-bold text-slate-400 hover:bg-slate-800/50 border border-slate-800"
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
                        disabled={isSaving || soldProducts.length === 0}
                        className="flex-[2] h-11 bg-primary text-primary-foreground font-bold text-xs shadow-md shadow-primary/10 hover:bg-primary/90"
                    >
                        <ShoppingCart className="w-4 h-4 mr-1.5" />
                        {isSaving ? "Guardando..." : "Añadir Deuda"}
                    </Button>
                </div>

                {onGoToCharge && (
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
                        disabled={isSaving || soldProducts.length === 0}
                        className="w-full h-12 bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-bold text-sm shadow-md shadow-emerald-500/10"
                    >
                        💰 Guardar y Cobrar Ahora
                    </Button>
                )}
            </div>
        </div>
    );
}
