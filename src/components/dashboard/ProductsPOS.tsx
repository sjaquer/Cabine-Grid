"use client";

import { useState } from "react";
import type { Product, SoldProduct } from "@/lib/types";
import { products as availableProducts } from "@/lib/data";
import { formatCurrency } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlusCircle, MinusCircle, ShoppingCart } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";


interface ProductsPOSProps {
    onProductsChange: (products: SoldProduct[]) => void;
}

export default function ProductsPOS({ onProductsChange }: ProductsPOSProps) {
    const [quantities, setQuantities] = useState<Record<string, number>>({});

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

    const total = Object.entries(quantities).reduce((acc, [productId, quantity]) => {
        const product = availableProducts.find(p => p.id === productId);
        return acc + (product ? product.price * quantity : 0);
    }, 0);

    return (
        <Card className="border-0 shadow-none">
            <CardHeader>
                <CardTitle>Punto de Venta</CardTitle>
                <CardDescription>Añada productos a la venta actual.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col h-[450px]">
                <div className="flex-1 -mx-6 -my-2">
                    <ScrollArea className="h-full">
                        <div className="p-6">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Producto</TableHead>
                                        <TableHead className="w-[150px] text-center">Cantidad</TableHead>
                                        <TableHead className="text-right">Subtotal</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {availableProducts.map(product => (
                                        <TableRow key={product.id}>
                                            <TableCell>
                                                <div className="font-medium">{product.name}</div>
                                                <div className="text-sm text-muted-foreground">{formatCurrency(product.price)}</div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleQuantityChange(product.id, -1)}>
                                                        <MinusCircle className="w-4 h-4" />
                                                    </Button>
                                                    <span className="font-bold text-lg w-8">{quantities[product.id] || 0}</span>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleQuantityChange(product.id, 1)}>
                                                        <PlusCircle className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right font-mono">
                                                {formatCurrency((quantities[product.id] || 0) * product.price)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </ScrollArea>
                </div>
                 <div className="mt-auto pt-4 border-t">
                    <div className="flex justify-between items-center text-xl font-bold">
                        <span>Total Productos:</span>
                        <span>{formatCurrency(total)}</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
