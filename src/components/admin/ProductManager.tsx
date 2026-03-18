"use client";

import { useState } from "react";
import type { Product } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { formatCurrency } from "@/lib/utils";

const productSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  price: z.coerce.number().positive("El precio debe ser mayor a 0").max(10000, "Precio máximo es 10,000 soles"),
  category: z.enum(["drink", "snack", "food", "other"]),
  description: z.string().optional(),
  stock: z.coerce.number().min(0, "El stock no puede ser negativo").max(99999, "Stock máximo es 99,999").optional(),
});

type ProductFormValues = z.infer<typeof productSchema>;

type ProductManagerProps = {
  products: Product[];
  onAdd: (product: Omit<Product, 'id' | 'createdAt'>) => Promise<void>;
  onEdit: (id: string, product: Partial<Product>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

const categoryLabels = {
  drink: "Bebida",
  snack: "Snack",
  food: "Comida",
  other: "Otro",
};

const categoryColors = {
  drink: "bg-blue-500/20 text-blue-600",
  snack: "bg-amber-500/20 text-amber-600",
  food: "bg-green-500/20 text-green-600",
  other: "bg-gray-500/20 text-gray-600",
};

export default function ProductManager({
  products,
  onAdd,
  onEdit,
  onDelete,
}: ProductManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      price: 0,
      category: "other",
      description: "",
      stock: 0,
    },
  });

  const handleSubmit = async (values: ProductFormValues) => {
    try {
      if (editingId) {
        await onEdit(editingId, {
          name: values.name,
          price: values.price,
          category: values.category,
          description: values.description,
          stock: values.stock,
        });
      } else {
        await onAdd({
          name: values.name,
          price: values.price,
          category: values.category,
          description: values.description,
          stock: values.stock,
          isActive: true,
        });
      }
      form.reset();
      setIsOpen(false);
      setEditingId(null);
    } catch (error) {
      console.error("Error saving product:", error);
    }
  };

  const handleEdit = (product: Product) => {
    setEditingId(product.id);
    form.setValue("name", product.name);
    form.setValue("price", product.price);
    form.setValue("category", product.category);
    form.setValue("description", product.description || "");
    form.setValue("stock", product.stock || 0);
    setIsOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Gestión de Productos</CardTitle>
          <CardDescription>Administra productos disponibles para venta</CardDescription>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => {
                setEditingId(null);
                form.reset();
              }}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Nuevo Producto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Editar Producto" : "Crear Nuevo Producto"}
              </DialogTitle>
              <DialogDescription>
                Ingresa los datos del producto para la venta
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre del Producto</FormLabel>
                      <FormControl>
                        <Input placeholder="Coca Cola 500ml" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción (opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Bebida gaseosa fría" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Precio (PEN)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.1" placeholder="2.50" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="stock"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Stock (opcional)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="25" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoría</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="drink">Bebida</SelectItem>
                          <SelectItem value="snack">Snack</SelectItem>
                          <SelectItem value="food">Comida</SelectItem>
                          <SelectItem value="other">Otro</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit">
                    {editingId ? "Guardar Cambios" : "Crear Producto"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Precio</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id}>
                <TableCell className="font-medium">{product.name}</TableCell>
                <TableCell>
                  <Badge className={categoryColors[product.category]}>
                    {categoryLabels[product.category]}
                  </Badge>
                </TableCell>
                <TableCell>{formatCurrency(product.price)}</TableCell>
                <TableCell>{product.stock ?? "-"}</TableCell>
                <TableCell>
                  <Badge variant={product.isActive !== false ? "default" : "secondary"}>
                    {product.isActive !== false ? "Activo" : "Inactivo"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(product)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onDelete(product.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
