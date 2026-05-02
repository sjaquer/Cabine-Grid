"use client";

import { useState } from "react";
import { useAuth } from "@/firebase";
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
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { formatCurrency, cn } from "@/lib/utils";

const productSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  price: z.coerce.number().positive("El precio debe ser mayor a 0").max(10000, "Precio máximo es 10,000 soles"),
  costPrice: z.coerce.number().min(0, "El costo no puede ser negativo").optional(),
  category: z.string().min(1, "La categoría es requerida"),
  description: z.string().optional(),
  stock: z.coerce.number().min(0, "El stock no puede ser negativo").max(99999, "Stock máximo es 99,999").optional(),
  minStock: z.coerce.number().min(0, "El stock mínimo no puede ser negativo").optional(),
  supplierInfo: z.string().optional(),
});

type ProductFormValues = z.infer<typeof productSchema>;

type ProductManagerProps = {
  products: Product[];
  onAdd: (product: Omit<Product, 'id' | 'createdAt'>) => Promise<void>;
  onEdit: (id: string, product: Partial<Product>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

const categoryLabels: Record<string, string> = {
  drink: "Bebidas",
  snack: "Snacks",
  food: "Comidas",
  other: "Servicios",
  hardware: "Hardware",
  bebidas: "Bebidas",
  snacks: "Snacks",
  servicios: "Servicios",
};

const categoryColors: Record<string, string> = {
  drink: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  snack: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  food: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  other: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  hardware: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  bebidas: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  snacks: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  servicios: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

export default function ProductManager({
  products,
  onAdd,
  onEdit,
  onDelete,
}: ProductManagerProps) {
  const { userProfile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "all" || product.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      price: 0,
      costPrice: 0,
      category: "snack",
      description: "",
      stock: 0,
      minStock: 5,
      supplierInfo: "",
    },
  });

  const handleSubmit = async (values: ProductFormValues) => {
    try {
      if (editingId) {
        await onEdit(editingId, {
          name: values.name,
          price: values.price,
          costPrice: values.costPrice,
          category: values.category,
          description: values.description,
          stock: values.stock,
          minStock: values.minStock,
          supplierInfo: values.supplierInfo,
        });
      } else {
        await onAdd({
          name: values.name,
          price: values.price,
          costPrice: values.costPrice,
          category: values.category,
          description: values.description,
          stock: values.stock,
          minStock: values.minStock,
          supplierInfo: values.supplierInfo,
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
    form.setValue("costPrice", product.costPrice || 0);
    form.setValue("category", product.category);
    form.setValue("description", product.description || "");
    form.setValue("stock", product.stock || 0);
    form.setValue("minStock", product.minStock || 5);
    form.setValue("supplierInfo", product.supplierInfo || "");
    setIsOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Productos</CardTitle>
          <CardDescription>Configura productos disponibles para venta</CardDescription>
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
                Completa la información del producto
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
                        <FormLabel>Precio de Venta (PEN)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="2.50" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="costPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Precio de Costo (PEN)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="1.80" {...field} />
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
                        <FormLabel>Stock Actual</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="25" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="minStock"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Stock Mínimo</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="5" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="supplierInfo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Información de Proveedor (Opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Makro / Distribuidora X" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
                          <SelectItem value="snack">Snacks</SelectItem>
                          <SelectItem value="drink">Bebidas</SelectItem>
                          <SelectItem value="hardware">Hardware</SelectItem>
                          <SelectItem value="other">Servicios</SelectItem>
                          <SelectItem value="food">Comidas</SelectItem>
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
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between mb-4 filter-bar">
          <div className="relative w-full sm:max-w-xs">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar producto..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-background/50"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {[{id: "all", label: "Todos"}, {id: "snack", label: "Snacks"}, {id: "drink", label: "Bebidas"}, {id: "food", label: "Comida"}, {id: "hardware", label: "Hardware"}, {id: "other", label: "Servicios"}].map(cat => (
              <Button
                key={cat.id}
                variant={categoryFilter === cat.id ? "default" : "outline"}
                size="sm"
                className="rounded-full text-xs"
                onClick={() => setCategoryFilter(cat.id)}
              >
                {cat.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="data-table-wrapper">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Precio</TableHead>
                {userProfile?.role === "admin" && <TableHead>Costo</TableHead>}
                {userProfile?.role === "admin" && <TableHead>Margen</TableHead>}
                <TableHead>Stock</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No se encontraron productos
                  </TableCell>
                </TableRow>
              ) : (
                filteredProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>
                      <Badge className={categoryColors[product.category]}>
                        {categoryLabels[product.category] || product.category}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatCurrency(product.price)}</TableCell>
                    {userProfile?.role === "admin" && (
                      <TableCell className="text-muted-foreground">{formatCurrency(product.costPrice || 0)}</TableCell>
                    )}
                    {userProfile?.role === "admin" && (
                      <TableCell className="font-bold text-emerald-400">
                        {formatCurrency(product.price - (product.costPrice || 0))}
                      </TableCell>
                    )}
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
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="data-cards-wrapper mt-4">
          {filteredProducts.map((product) => (
            <Card key={`mob-${product.id}`} className="flex flex-col border-border/50 shadow-sm relative overflow-hidden">
              <div className={cn("absolute left-0 top-0 bottom-0 w-1", categoryColors[product.category]?.split(' ')[0] || "bg-primary")} />
              <CardContent className="p-4 pl-5">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-bold text-sm leading-tight pr-2">{product.name}</h4>
                  <Badge variant={product.isActive !== false ? "default" : "secondary"} className="text-[10px] whitespace-nowrap shrink-0">
                    {product.isActive !== false ? "Activo" : "Inactivo"}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between mb-3">
                  <Badge className={cn("text-[10px]", categoryColors[product.category])}>
                    {categoryLabels[product.category] || product.category}
                  </Badge>
                  <span className="font-mono font-bold text-primary">
                    {formatCurrency(product.price)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3 mb-3 text-xs">
                  <div>
                    <span className="text-muted-foreground block mb-1">Stock Actual</span>
                    <span className="font-medium">{product.stock ?? "-"}</span>
                  </div>
                  {userProfile?.role === "admin" && (
                    <div>
                      <span className="text-muted-foreground block mb-1">Margen</span>
                      <span className="font-medium text-emerald-400">{formatCurrency(product.price - (product.costPrice || 0))}</span>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => handleEdit(product)}
                  >
                    <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => onDelete(product.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Eliminar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {filteredProducts.length === 0 && (
             <div className="text-center py-8 text-muted-foreground border border-dashed rounded-xl">
               No se encontraron productos
             </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
