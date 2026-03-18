"use client";

import { useState } from "react";
import type { Location } from "@/lib/types";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
import { Plus, Pencil, Trash2, MapPin, Phone } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const locationSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").min(3, "Mínimo 3 caracteres").max(100, "Máximo 100 caracteres"),
  address: z.string().min(5, "Dirección requerida").max(200, "Dirección máximo 200 caracteres"),
  phone: z.string().max(20, "Teléfono inválido").optional().or(z.literal("")),
});

type LocationFormValues = z.infer<typeof locationSchema>;

type LocationManagerProps = {
  locations: Location[];
  onAdd: (location: Omit<Location, 'id' | 'createdAt'>) => Promise<void>;
  onEdit: (id: string, location: Partial<Location>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

export default function LocationManager({
  locations,
  onAdd,
  onEdit,
  onDelete,
}: LocationManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const form = useForm<LocationFormValues>({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      name: "",
      address: "",
      phone: "",
    },
  });

  const handleSubmit = async (values: LocationFormValues) => {
    try {
      if (editingId) {
        await onEdit(editingId, {
          name: values.name,
          address: values.address,
          phone: values.phone || undefined,
        });
      } else {
        await onAdd({
          name: values.name,
          address: values.address,
          phone: values.phone || undefined,
          fractionMinutes: 5,
          isActive: true,
        });
      }
      form.reset();
      setIsOpen(false);
      setEditingId(null);
    } catch (error) {
      console.error("Error saving location:", error);
      const errorMessage = error instanceof Error ? error.message : "Error al guardar la ubicación";
      form.setError("root", { message: errorMessage });
    }
  };

  const handleEdit = (location: Location) => {
    setEditingId(location.id);
    form.setValue("name", location.name);
    form.setValue("address", location.address);
    form.setValue("phone", location.phone || "");
    setIsOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Gestión de Locales</CardTitle>
          <CardDescription>Administra los locales/sucursales de cabinas</CardDescription>
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
              Nuevo Local
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Local" : "Crear Nuevo Local"}</DialogTitle>
              <DialogDescription>
                Ingresa los datos del local de cabinas
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre del Local</FormLabel>
                      <FormControl>
                        <Input placeholder="Cabine Grid Centro" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dirección</FormLabel>
                      <FormControl>
                        <Input placeholder="Av. Principal 123, Piso 2" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teléfono (opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="(01) 2345-6789" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit">
                    {editingId ? "Guardar Cambios" : "Crear Local"}
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
              <TableHead>Dirección</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {locations.map((location) => (
              <TableRow key={location.id}>
                <TableCell className="font-medium">{location.name}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    {location.address}
                  </div>
                </TableCell>
                <TableCell>
                  {location.phone ? (
                    <div className="flex items-center gap-1">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      {location.phone}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={location.isActive ? "default" : "secondary"}>
                    {location.isActive ? "Activo" : "Inactivo"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(location)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onDelete(location.id)}>
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
