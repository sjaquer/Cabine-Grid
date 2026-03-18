"use client";

import { useState, useMemo } from "react";
import type { SoldProduct } from "@/lib/types";
import { products as availableProducts } from "@/lib/data";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PlusCircle, MinusCircle, ShoppingCart } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ProductsPOSProps {
    initialProducts?: SoldProduct[];
    onSave: (products: SoldProduct[]) => void;
    onClose?: () => void;
    onGoToCharge?: () => void;
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

export default function ProductsPOS({ initialProducts, onSave, onClose, onGoToCharge }: ProductsPOSProps) {
    const [quantities, setQuantities] = useState<Record<string, number>>(() => {
        if (!initialProducts || initialProducts.length === 0) return {};
        return initialProducts.reduce((acc, item) => {
            acc[item.productId] = item.quantity;
            return acc;
        }, {} as Record<string, number>);
    });
    const [searchTerm, setSearchTerm] = useState("");

    const filteredProducts = useMemo(() => {
        return availableProducts.filter(p =>
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) && p.isActive !== false
        );
    }, [searchTerm]);

    const handleQuantityChange = (productId: string, delta: number) => {
        const newQuantities = { ...quantities };
        const currentQuantity = newQuantities[productId] || 0;
        const newQuantity = Math.max(0, currentQuantity + delta);

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
        const result = new Map<string, (typeof availableProducts)>();
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

    return (
        <Card className="border-0 shadow-none flex flex-col h-full min-h-0">
            <CardHeader className="pb-3">
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2 text-xl font-bold">
                                <ShoppingCart className="w-5 h-5 text-accent" />
                                Punto de Venta (TPV)
                            </CardTitle>
                            <CardDescription className="text-sm mt-1">
                                Selecciona los productos que consumirá el cliente para agregarlos a su cuenta.
                            </CardDescription>
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
                        className="h-9"
                    />
                </div>
            </CardHeader>

            <CardContent className="flex-1 min-h-0 flex flex-col gap-4 overflow-hidden">
                <Tabs defaultValue="drink" className="flex-1 min-h-0 flex flex-col">
                    <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto bg-secondary/60">
                        {Object.entries(categoryLabels).map(([cat, label]) => (
                            <TabsTrigger key={cat} value={cat} className="text-xs sm:text-sm flex gap-1">
                                <span>{categoryIcons[cat as keyof typeof categoryIcons]}</span>
                                <span className="hidden sm:inline">{label}</span>
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    {Array.from(products.entries()).map(([category, categoryProducts]) => (
                        <TabsContent key={category} value={category} className="flex-1 min-h-0 overflow-y-auto data-[state=active]:flex data-[state=active]:flex-col">
                            <div className="pr-2 space-y-3 pb-4 h-max">
                                {categoryProducts.length === 0 ? (
                                    <div className="py-8 text-center text-muted-foreground bg-secondary/20 rounded-lg">
                                        <p>No hay productos en esta categoría</p>
                                    </div>
                                ) : (
                                    categoryProducts.map(product => (
                                        <div
                                            key={product.id}
                                            className="flex items-center justify-between p-3.5 rounded-xl border border-border/80 bg-background hover:bg-secondary/40 transition shadow-sm"
                                        >
                                            <div className="flex-1 min-w-0 pr-3">
                                                <div className="font-semibold text-sm md:text-base text-foreground/90 truncate">{product.name}</div>
                                                <div className="text-sm md:text-base text-accent font-bold mt-0.5">{formatCurrency(product.price)}</div>
                                            </div>
                                            <div className="flex items-center gap-1.5 bg-secondary/30 rounded-lg p-1 border border-border/50">
                                                <Button
                                                    variant="secondary"
                                                    size="icon"
                                                    className="h-9 w-9 md:h-10 md:w-10 rounded-md hover:bg-destructive hover:text-destructive-foreground transition-colors"
                                                    onClick={() => handleQuantityChange(product.id, -1)}
                                                >
                                                    <MinusCircle className="w-5 h-5" />
                                                </Button>
                                                <div className="w-8 md:w-10 text-center flex items-center justify-center">
                                                    <span className="font-bold text-base md:text-lg tabular-nums">{quantities[product.id] || 0}</span>
                                                </div>
                                                <Button
                                                    variant="secondary"
                                                    size="icon"
                                                    className="h-9 w-9 md:h-10 md:w-10 rounded-md hover:bg-status-available hover:text-status-available-foreground transition-colors"
                                                    onClick={() => handleQuantityChange(product.id, 1)}
                                                >
                                                    <PlusCircle className="w-5 h-5" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </TabsContent>
                    ))}
                </Tabs>
            </CardContent>

            <div className="border-t border-border/50 bg-secondary/10 p-5 mt-auto shrink-0 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.5)] z-10">
                {Object.entries(quantities).length > 0 && (
                    <div className="space-y-1 text-sm mb-4 pb-4 border-b border-border/40">
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
                <div className="flex flex-col sm:flex-row gap-3">
                    {onClose && (
                        <Button 
                            variant="outline" 
                            onClick={onClose} 
                            className="w-full sm:w-1/4 h-12 sm:h-auto font-semibold hover:bg-destructive hover:text-white transition-all shadow-sm"
                        >
                            Cancelar
                        </Button>
                    )}
                    <Button 
                        onClick={() => {
                            onSave(soldProducts);
                            if (onClose) onClose();
                        }} 
                        className="w-full sm:flex-1 h-14 sm:h-auto bg-secondary text-foreground hover:bg-secondary/80 font-bold text-base shadow-sm transition-all active:scale-[0.98]"
                    >
                        <ShoppingCart className="w-5 h-5 mr-2" />
                        Añadir y seguir jugando
                    </Button>
                    {onGoToCharge && (
                        <Button 
                            onClick={() => {
                                onSave(soldProducts);
                                onGoToCharge();
                            }} 
                            className="w-full sm:flex-1 h-14 sm:h-auto bg-gradient-to-r from-status-available to-status-available/80 hover:from-status-available/90 hover:to-status-available text-white font-bold text-base shadow-lg shadow-status-available/20 transition-all active:scale-[0.98]"
                        >
                            💰 Ir a Cobrar Boleta
                        </Button>
                    )}
                </div>
            </div>
        </Card>
    );
}
