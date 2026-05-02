"use client";

import { useState } from "react";
import type { Location } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MapPin, Phone, Pencil } from "lucide-react";

type LocationManagerProps = {
  locations: Location[];
  onEdit: (id: string, location: Partial<Location>) => Promise<void>;
};

const locationSchema = z.object({
  name: z.string().min(1, "Requerido"),
  address: z.string().min(1, "Requerida"),
  phone: z.string().optional(),
  fractionMinutes: z.coerce.number().min(1, "Mínimo 1").max(60, "Máximo 60"),
});

type LocationFormValues = z.infer<typeof locationSchema>;

export default function LocationManager({
  locations,
  onEdit,
}: LocationManagerProps) {
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const form = useForm<LocationFormValues>({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      name: "",
      address: "",
      phone: "",
      fractionMinutes: 5,
    },
  });

  const handleEdit = (location: Location) => {
    setEditingLocation(location);
    form.setValue("name", location.name);
    form.setValue("address", location.address);
    form.setValue("phone", location.phone || "");
    form.setValue("fractionMinutes", location.fractionMinutes || 5);
    setIsOpen(true);
  };

  const handleSubmit = async (values: LocationFormValues) => {
    if (!editingLocation) return;
    try {
      await onEdit(editingLocation.id, {
        name: values.name,
        address: values.address,
        phone: values.phone,
        fractionMinutes: values.fractionMinutes,
      });
      setIsOpen(false);
      setEditingLocation(null);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Locales</CardTitle>
          <CardDescription>Configura parámetros y opciones de operación</CardDescription>
        </div>
      </CardHeader>

      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Dirección</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Prórroga / Fracción</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acción</TableHead>
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
                <TableCell className="font-mono font-semibold text-primary">{location.fractionMinutes || 5} min</TableCell>
                <TableCell>
                  <Badge variant={location.isActive ? "default" : "secondary"}>
                    {location.isActive ? "Activo" : "Inactivo"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(location)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Parámetros del Local</DialogTitle>
              <DialogDescription>Configura el tiempo prorroga y datos fiscales.</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre de Negocio</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
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
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teléfono de contacto</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="fractionMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tiempo de Prórroga (Minutos)</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                      <FormDescription>Tiempo de tolerancia antes de cobrar el siguiente bloque completo.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="submit">Guardar Cambios</Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
