"use client";

import { useState, useMemo } from "react";
import type { Product, SoldProduct } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PlusCircle, MinusCircle, ShoppingCart, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface ProductsPOSProps {
    availableProducts: Product[];
    initialProducts?: SoldProduct[];
    onSave: (products: SoldProduct[]) => Promise<void>;
    onClose?: () => void;
    onGoToCharge?: (products: SoldProduct[]) => void;
    inventoryByProduct?: Record<string, number>; // productId -> stock
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
    const [quantities, setQuantities] = useState<Record<string, number>>(() => {
        if (!initialProducts || initialProducts.length === 0) return {};
        return initialProducts.reduce((acc, item) => {
            acc[item.productId] = item.quantity;
            return acc;
        }, {} as Record<string, number>);
    });
    const [searchTerm, setSearchTerm] = useState("");
    const [onlyInStock, setOnlyInStock] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

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
        // First check inventory system, then fallback to product stock field
        if (inventoryByProduct && inventoryByProduct[productId] !== undefined) {
            return Math.max(0, inventoryByProduct[productId]);
        }
        return Math.max(0, product.stock ?? 0);
    };

    const handleQuantityChange = (productId: string, delta: number) => {
        const product = availableProducts.find(p => p.id === productId);
        if (!product) return;

        const availableStock = getAvailableStock(productId, product);
        const newQuantities = { ...quantities };
        const currentQuantity = newQuantities[productId] || 0;
        const newQuantity = Math.max(0, Math.min(currentQuantity + delta, availableStock));

        if (newQuantity > 0) {
            newQuantities[productId] = newQuantity;
        } else {
            delete newQuantities[productId];
        }

        setQuantities(newQuantities);
    };

    const buildSoldProducts = (currentQuantities: Record<string, number>) => {
        return Object.entries(currentQuantities).map(([productId, quantity]) => {
            const product = availableProducts.find(p => p.id === productId)!;
            return {
                productId,
                productName: product.name,
                quantity,
                unitPrice: product.price
            };
        });
    };

    const products = useMemo(() => {
        const result = new Map<string, Product[]>();
        Object.entries(categoryLabels).forEach(([category]) => {
            result.set(category, filteredProducts.filter(p => p.category === category));
        });
        return result;
    }, [filteredProducts]);

    const total = Object.entries(quantities).reduce((acc, [productId, quantity]) => {
        const product = availableProducts.find(p => p.id === productId);
        return acc + (product ? product.price * quantity : 0);
    }, 0);

    const itemCount = Object.values(quantities).reduce((sum, qty) => sum + qty, 0);
    const soldProducts = buildSoldProducts(quantities);

    // Check if any products are out of stock
    const outOfStockProducts = availableProducts.filter(p => {
        const stock = getAvailableStock(p.id, p);
        return stock === 0 && p.isActive !== false;
    });

    const renderProductRow = (product: Product) => {
        const availableStock = getAvailableStock(product.id, product);
        const isOutOfStock = availableStock === 0;
        const currentQty = quantities[product.id] || 0;

        return (
            <div
                key={product.id}
                className={`flex items-center justify-between p-3 rounded-xl border border-border/80 bg-background transition shadow-sm ${
                    isOutOfStock
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:bg-secondary/40'
                }`}
            >
                <div className="flex-1 min-w-0 pr-3">
                    <div className="flex items-center gap-2">
                        <div className="font-semibold text-sm md:text-base text-foreground/90 truncate">{product.name}</div>
                        {availableStock > 0 && (
                            <Badge variant="outline" className="text-xs bg-secondary/60 text-foreground/70 font-semibold">
                                Stock: {availableStock}
                            </Badge>
                        )}
                        {isOutOfStock && (
                            <Badge variant="destructive" className="text-xs font-semibold">
                                Sin stock
                            </Badge>
                        )}
                    </div>
                    <div className="text-sm md:text-base text-accent font-bold mt-0.5">{formatCurrency(product.price)}</div>
                </div>
                <div className="flex items-center gap-2 bg-secondary/30 rounded-lg p-1.5 border border-border/50">
                    <Button
                        variant="secondary"
                        size="icon"
                        className="h-11 w-11 md:h-12 md:w-12 rounded-md hover:bg-destructive hover:text-destructive-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => handleQuantityChange(product.id, -1)}
                        disabled={isOutOfStock || currentQty === 0}
                    >
                        <MinusCircle className="w-5 h-5" />
                    </Button>
                    <div className="w-10 md:w-12 text-center flex items-center justify-center">
                        <span className="font-bold text-lg md:text-xl tabular-nums">{currentQty}</span>
                    </div>
                    <Button
                        variant="secondary"
                        size="icon"
                        className="h-11 w-11 md:h-12 md:w-12 rounded-md hover:bg-status-available hover:text-status-available-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => handleQuantityChange(product.id, 1)}
                        disabled={isOutOfStock || currentQty >= availableStock}
                    >
                        <PlusCircle className="w-5 h-5" />
                    </Button>
                </div>
            </div>
        );
    };

    return (
        <Card className="border-0 shadow-none min-h-full flex flex-col lg:h-full lg:min-h-0 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-[auto_minmax(0,1fr)] lg:gap-0">
            <CardHeader className="pb-3 lg:col-start-1 lg:row-start-1">
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2 text-xl font-bold">
                                <ShoppingCart className="w-5 h-5 text-accent" />
                                Punto de Venta (TPV)
                            </CardTitle>
                        </div>
                        {itemCount > 0 && (
                            <Badge className="bg-accent text-accent-foreground text-base px-3 py-2">
                                {itemCount} {itemCount === 1 ? "item" : "items"}
                            </Badge>
                        )}
                    </div>
                    <Input
                        placeholder="Buscar producto..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="h-11 text-base"
                    />
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-xs text-muted-foreground">
                            {filteredProducts.length} resultado{filteredProducts.length === 1 ? "" : "s"}
                        </p>
                        <div className="flex items-center gap-2">
                            <Label htmlFor="only-in-stock" className="text-xs text-muted-foreground cursor-pointer">
                                Solo con stock
                            </Label>
                            <Switch
                                id="only-in-stock"
                                checked={onlyInStock}
                                onCheckedChange={setOnlyInStock}
                            />
                        </div>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="flex-1 min-h-0 flex flex-col gap-3 overflow-visible lg:overflow-hidden lg:col-start-1 lg:row-start-2 lg:pb-4">
                {outOfStockProducts.length > 0 && (
                    <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-sm">
                            {outOfStockProducts.length} {outOfStockProducts.length === 1 ? "producto está" : "productos están"} sin stock disponible.
                        </AlertDescription>
                    </Alert>
                )}
                <div className="lg:hidden flex-1 min-h-0 overflow-y-auto">
                    <div className="pr-2 space-y-2 pb-2 h-max">
                        {filteredProducts.length === 0 ? (
                            <div className="py-8 text-center text-muted-foreground bg-secondary/20 rounded-lg">
                                <p>Sin productos</p>
                            </div>
                        ) : (
                            filteredProducts.map(renderProductRow)
                        )}
                    </div>
                </div>

                <Tabs defaultValue="drink" className="hidden lg:flex flex-1 min-h-0 flex-col">
                    <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto bg-secondary/60 p-1">
                        {Object.entries(categoryLabels).map(([cat, label]) => (
                            <TabsTrigger key={cat} value={cat} className="text-sm flex gap-1 h-11">
                                <span>{categoryIcons[cat as keyof typeof categoryIcons]}</span>
                                <span className="hidden sm:inline">{label}</span>
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    {Array.from(products.entries()).map(([category, categoryProducts]) => (
                        <TabsContent key={category} value={category} className="flex-1 min-h-0 overflow-visible lg:overflow-y-auto data-[state=active]:flex data-[state=active]:flex-col">
                            <div className="pr-2 space-y-2 pb-2 h-max">
                                {categoryProducts.length === 0 ? (
                                    <div className="py-8 text-center text-muted-foreground bg-secondary/20 rounded-lg">
                                        <p>Sin productos</p>
                                    </div>
                                ) : (
                                    categoryProducts.map(renderProductRow)
                                )}
                            </div>
                        </TabsContent>
                    ))}
                </Tabs>
            </CardContent>

            <aside className="border-t lg:border-t-0 lg:border-l border-border/50 bg-secondary/10 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-5 lg:pb-5 lg:col-start-2 lg:row-span-2 flex flex-col min-h-0">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Resumen</h3>
                {Object.entries(quantities).length > 0 && (
                    <div className="space-y-1 text-sm mb-4 pb-4 border-b border-border/40 overflow-y-auto max-h-48 lg:max-h-[45vh] pr-1">
                        {Object.entries(quantities).map(([productId, qty]) => {
                            const product = availableProducts.find(p => p.id === productId);
                            if (!product) return null;
                            return (
                                <div key={productId} className="flex justify-between items-center text-muted-foreground bg-background/50 px-3 py-1.5 rounded-md text-xs font-medium">
                                    <span className="flex items-center gap-2 text-foreground/80"><span className="text-accent font-bold bg-accent/10 px-1.5 rounded">{qty}x</span> {product.name}</span>
                                    <span className="font-mono text-foreground/90">{formatCurrency(qty * product.price)}</span>
                                </div>
                            );
                        })}
                    </div>
                )}
                <div className="flex justify-between items-center mb-5 px-1">
                    <span className="font-semibold text-muted-foreground uppercase tracking-wider text-xs md:text-sm">Total Productos:</span>
                    <span className="text-2xl md:text-3xl font-black tracking-tight text-accent drop-shadow-sm">
                        {formatCurrency(total)}
                    </span>
                </div>
                <div className="mt-auto flex flex-col gap-3 sticky bottom-0 bg-secondary/10 pt-3">
                    {onClose && (
                        <Button 
                            variant="outline" 
                            onClick={onClose} 
                            disabled={isSaving}
                            className="w-full h-12 font-semibold hover:bg-destructive hover:text-white transition-all shadow-sm"
                        >
                            Cancelar
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
                        className="w-full h-14 bg-secondary text-foreground hover:bg-secondary/80 font-bold text-base shadow-sm transition-all active:scale-[0.98]"
                    >
                        <ShoppingCart className="w-5 h-5 mr-2" />
                        {isSaving ? "Guardando..." : "Guardar productos"}
                    </Button>
                    {onGoToCharge && (
                        <Button 
                            onClick={async () => {
                                try {
                                    setIsSaving(true);
                                    await onSave(soldProducts);
                                    onGoToCharge(soldProducts);
                                } finally {
                                    setIsSaving(false);
                                }
                            }} 
                            disabled={isSaving}
                            className="w-full h-14 bg-gradient-to-r from-status-available to-status-available/80 hover:from-status-available/90 hover:to-status-available text-white font-bold text-base shadow-lg shadow-status-available/20 transition-all active:scale-[0.98]"
                        >
                            {isSaving ? "Guardando..." : "💰 Guardar y cobrar"}
                        </Button>
                    )}
                </div>
            </aside>
        </Card>
    );
}
