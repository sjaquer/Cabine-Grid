"use client";

import { useState } from "react";
import type { Machine } from "@/lib/types";
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
import { Plus, Pencil, Trash2, Power } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const machineSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  rateId: z.string().min(1, "Selecciona una tarifa"),
  specs: z.object({
    processor: z.string().optional(),
    ram: z.string().optional(),
    storage: z.string().optional(),
  }).optional(),
});

type MachineFormValues = z.infer<typeof machineSchema>;

type MachineManagerProps = {
  machines: Machine[];
  onAdd: (machine: Omit<Machine, 'id'>) => Promise<void>;
  onEdit: (id: string, machine: Partial<Machine>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onToggleStatus: (id: string, newStatus: Machine['status']) => Promise<void>;
};

export default function MachineManager({
  machines,
  onAdd,
  onEdit,
  onDelete,
  onToggleStatus,
}: MachineManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const form = useForm<MachineFormValues>({
    resolver: zodResolver(machineSchema),
    defaultValues: {
      name: "",
      rateId: "",
      specs: {},
    },
  });

  const handleSubmit = async (values: MachineFormValues) => {
    try {
      if (editingId) {
        await onEdit(editingId, {
          ...values,
          specs: values.specs,
        });
      } else {
        await onAdd({
          name: values.name,
          status: "available",
          rateId: values.rateId,
          specs: values.specs,
        });
      }
      form.reset();
      setIsOpen(false);
      setEditingId(null);
    } catch (error) {
      console.error("Error saving machine:", error);
      const errorMessage = error instanceof Error ? error.message : "Error al guardar la máquina";
      form.setError("root", { message: errorMessage });
    }
  };

  const handleEdit = (machine: Machine) => {
    setEditingId(machine.id);
    form.setValue("name", machine.name);
    form.setValue("rateId", machine.rateId || "");
    form.setValue("specs", machine.specs || {});
    setIsOpen(true);
  };

  const statusBadgeColor = {
    available: "bg-status-available text-black",
    occupied: "bg-status-occupied text-white",
    warning: "bg-status-warning text-black",
    maintenance: "bg-muted text-foreground",
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Gestión de Cabinas/Máquinas</CardTitle>
          <CardDescription>Administra todas las máquinas del local</CardDescription>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              setEditingId(null);
              form.reset();
            }} className="gap-2">
              <Plus className="w-4 h-4" />
              Nueva Máquina
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Máquina" : "Agregar Nueva Máquina"}</DialogTitle>
              <DialogDescription>
                Configure los detalles de la máquina
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre</FormLabel>
                      <FormControl>
                        <Input placeholder="PC 01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="rateId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tarifa Asignada</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona una tarifa" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="A">Tarifa Normal</SelectItem>
                          <SelectItem value="B">Tarifa Económica</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="specs.processor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Procesador (opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Intel i5" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="specs.ram"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Memoria RAM (opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="16GB" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="specs.storage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Almacenamiento (opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="512GB SSD" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit">
                    {editingId ? "Guardar Cambios" : "Agregar Máquina"}
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
              <TableHead>Estado</TableHead>
              <TableHead>Tarifa</TableHead>
              <TableHead>Especificaciones</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {machines.map((machine) => (
              <TableRow key={machine.id}>
                <TableCell className="font-medium">{machine.name}</TableCell>
                <TableCell>
                  <Badge className={statusBadgeColor[machine.status]}>
                    {machine.status === "available"
                      ? "Disponible"
                      : machine.status === "occupied"
                      ? "En Uso"
                      : machine.status === "warning"
                      ? "Alerta"
                      : "Mantenimiento"}
                  </Badge>
                </TableCell>
                <TableCell>{machine.rateId}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {machine.specs?.processor ? `${machine.specs.processor} • ${machine.specs.ram}` : "Sin especificaciones"}
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(machine)}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      onToggleStatus(
                        machine.id,
                        machine.status === "maintenance" ? "available" : "maintenance"
                      )
                    }
                  >
                    <Power className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(machine.id)}
                  >
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
