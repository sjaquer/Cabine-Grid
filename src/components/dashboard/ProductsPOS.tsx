"use client";

import { useState, useMemo } from "react";
import type { SoldProduct } from "@/lib/types";
import { products as availableProducts } from "@/lib/data";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PlusCircle, MinusCircle, ShoppingCart, Zap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ProductsPOSProps {
    onProductsChange: (products: SoldProduct[]) => void;
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

export default function ProductsPOS({ onProductsChange }: ProductsPOSProps) {
    const [quantities, setQuantities] = useState<Record<string, number>>({});
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
        updateParent(newQuantities);
    };

    const updateParent = (currentQuantities: Record<string, number>) => {
        const soldProducts: SoldProduct[] = Object.entries(currentQuantities).map(([productId, quantity]) => {
            const product = availableProducts.find(p => p.id === productId)!;
            return {
                productId,
                productName: product.name,
                quantity,
                unitPrice: product.price
            };
        });
        onProductsChange(soldProducts);
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

    return (
        <Card className="border-0 shadow-none flex flex-col h-[500px]">
            <CardHeader className="pb-3">
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <ShoppingCart className="w-5 h-5 text-accent" />
                                Punto de Venta (TPV)
                            </CardTitle>
                            <CardDescription>
                                Selecciona productos para añadir a la venta
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

            <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden">
                <Tabs defaultValue="drink" className="flex-1 flex flex-col">
                    <TabsList className="grid w-full grid-cols-4 bg-secondary/60">
                        {Object.entries(categoryLabels).map(([cat, label]) => (
                            <TabsTrigger key={cat} value={cat} className="text-xs sm:text-sm flex gap-1">
                                <span>{categoryIcons[cat as keyof typeof categoryIcons]}</span>
                                <span className="hidden sm:inline">{label}</span>
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    {Array.from(products.entries()).map(([category, categoryProducts]) => (
                        <TabsContent key={category} value={category} className="flex-1 overflow-hidden">
                            <ScrollArea className="h-full">
                                <div className="pr-4 space-y-2">
                                    {categoryProducts.length === 0 ? (
                                        <div className="py-8 text-center text-muted-foreground">
                                            <p>No hay productos en esta categoría</p>
                                        </div>
                                    ) : (
                                        categoryProducts.map(product => (
                                            <div
                                                key={product.id}
                                                className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-secondary/50 transition"
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-semibold text-sm truncate">{product.name}</div>
                                                    <div className="text-sm text-accent font-bold">{formatCurrency(product.price)}</div>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        onClick={() => handleQuantityChange(product.id, -1)}
                                                    >
                                                        <MinusCircle className="w-4 h-4 text-destructive" />
                                                    </Button>
                                                    <div className="w-10 text-center">
                                                        <span className="font-bold text-base">{quantities[product.id] || 0}</span>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        onClick={() => handleQuantityChange(product.id, 1)}
                                                    >
                                                        <PlusCircle className="w-4 h-4 text-status-available" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </ScrollArea>
                        </TabsContent>
                    ))}
                </Tabs>
            </CardContent>

            <div className="border-t border-border/50 bg-gradient-to-b from-transparent to-secondary/50 p-4 space-y-2">
                {Object.entries(quantities).length > 0 && (
                    <div className="space-y-1 text-sm mb-3 pb-3 border-b border-border/30">
                        {Object.entries(quantities).map(([productId, qty]) => {
                            const product = availableProducts.find(p => p.id === productId);
                            if (!product) return null;
                            return (
                                <div key={productId} className="flex justify-between text-muted-foreground text-xs">
                                    <span>{qty}x {product.name}</span>
                                    <span className="font-mono">{formatCurrency(qty * product.price)}</span>
                                </div>
                            );
                        })}
                    </div>
                )}
                <div className="flex justify-between items-center">
                    <span className="font-semibold text-muted-foreground">Subtotal Productos:</span>
                    <span className="text-2xl font-bold font-mono text-accent">
                        {formatCurrency(total)}
                    </span>
                </div>
            </div>
        </Card>
    );
}
