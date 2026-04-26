"use client";

function cleanPayload<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(cleanPayload) as unknown as T;
  const result: any = {};
  for (const key in obj) {
    if (obj[key] !== undefined) result[key] = cleanPayload(obj[key]);
  }
  return result;
}


import { useState } from "react";
import type { Station, StationType } from "@/lib/types";
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
import { Plus, Pencil, Trash2, Power, Computer, Gamepad } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Location } from "@/lib/types";

const stationSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  type: z.enum(["PC", "PS5", "XBOX", "PS4", "PS3", "NINTENDO", "VR", "SIMULADOR"], { required_error: "El tipo de estación es requerido" }),
  hourlyRate: z.coerce.number().positive("El costo debe ser mayor a 0").max(100, "Máximo 100 soles por hora"),
  locationId: z.string().min(1, "Selecciona un local"),
  specs: z.object({
    processor: z.string().optional(),
    ram: z.string().optional(),
    storage: z.string().optional(),
  }).optional(),
});

type StationFormValues = z.infer<typeof stationSchema>;

type StationManagerProps = {
  machines: Station[]; // renamed for component compatibility
  locations: Location[];
  onAdd: (station: Omit<Station, 'id'>) => Promise<void>;
  onEdit: (id: string, station: Partial<Station>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onToggleStatus: (id: string, newStatus: Station['status']) => Promise<void>;
};

export default function MachineManager({
  machines: stations,
  locations,
  onAdd,
  onEdit,
  onDelete,
  onToggleStatus,
}: StationManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const form = useForm<StationFormValues>({
    resolver: zodResolver(stationSchema),
    defaultValues: {
      name: "",
      type: "PC",
      hourlyRate: 3.00,
      locationId: "",
      specs: {},
    },
  });

  const handleSubmit = async (values: StationFormValues) => {
    try {
      if (editingId) {
        await onEdit(editingId, cleanPayload({
          ...values,
          specs: values.specs,
        }));
      } else {
        await onAdd(cleanPayload({
          name: values.name,
          type: values.type,
          status: "available",
          hourlyRate: values.hourlyRate,
          locationId: values.locationId,
          specs: values.specs,
        }));
      }
      form.reset();
      setIsOpen(false);
      setEditingId(null);
    } catch (error) {
      console.error("Error saving station:", error);
      const errorMessage = error instanceof Error ? error.message : "Error al guardar la estación";
      form.setError("root", { message: errorMessage });
    }
  };

  const handleEdit = (station: Station) => {
    setEditingId(station.id);
    form.setValue("name", station.name);
    form.setValue("type", station.type || "PC");
    form.setValue("hourlyRate", station.hourlyRate || 3.00);
    form.setValue("locationId", station.locationId || "");
    form.setValue("specs", station.specs || {});
    setIsOpen(true);
  };

  const locationMap = new Map(locations.map((location) => [location.id, location.name]));

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
          <CardTitle>Gestión de Estaciones</CardTitle>
          <CardDescription>Administra todas las estaciones del negocio</CardDescription>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              setEditingId(null);
              form.reset();
            }} className="gap-2">
              <Plus className="w-4 h-4" />
              Nueva Estación
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Estación" : "Agregar Nueva Estación"}</DialogTitle>
              <DialogDescription>
                Configure los detalles de la estación
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
                        <Input placeholder="Estación 01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="PC">
                            <div className="flex items-center gap-2">
                              <Computer className="w-4 h-4 text-sky-500" /> PC Gamer
                            </div>
                          </SelectItem>
                          <SelectItem value="PS5">
                            <div className="flex items-center gap-2">
                              <Gamepad className="w-4 h-4 text-blue-600" /> PlayStation 5
                            </div>
                          </SelectItem>
                          <SelectItem value="PS4">
                            <div className="flex items-center gap-2">
                              <Gamepad className="w-4 h-4 text-blue-400" /> PlayStation 4
                            </div>
                          </SelectItem>
                          <SelectItem value="PS3">
                            <div className="flex items-center gap-2">
                              <Gamepad className="w-4 h-4 text-slate-600" /> PlayStation 3
                            </div>
                          </SelectItem>
                          <SelectItem value="XBOX">
                            <div className="flex items-center gap-2">
                              <Gamepad className="w-4 h-4 text-green-600" /> Xbox Series X/S
                            </div>
                          </SelectItem>
                          <SelectItem value="NINTENDO">
                            <div className="flex items-center gap-2">
                              <Gamepad className="w-4 h-4 text-red-600" /> Nintendo Switch
                            </div>
                          </SelectItem>
                          <SelectItem value="VR">
                            <div className="flex items-center gap-2">
                              <Gamepad className="w-4 h-4 text-purple-500" /> Realidad Virtual (VR)
                            </div>
                          </SelectItem>
                          <SelectItem value="SIMULADOR">
                            <div className="flex items-center gap-2">
                              <Gamepad className="w-4 h-4 text-orange-500" /> Simulador de Autos
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="hourlyRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Costo por Hora (S/.)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="3.00" step="0.50" min="0.50" {...field} />
                      </FormControl>
                      <FormDescription>Precio que cobra esta estación por cada hora de uso</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="locationId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Local</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona un local" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {locations.map((location) => (
                            <SelectItem key={location.id} value={location.id}>
                              {location.name}
                            </SelectItem>
                          ))}
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
                      <FormLabel>Procesador / Modelo (opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Intel i5 / Standard" {...field} />
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
                    {editingId ? "Guardar Cambios" : "Agregar Estación"}
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
              <TableHead>Tipo</TableHead>
              <TableHead>Local</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Tarifa</TableHead>
              <TableHead>Especificaciones</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stations.map((station) => (
              <TableRow key={station.id}>
                <TableCell className="font-medium">{station.name}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="gap-1">
                    {station.type === 'PS5' || station.type === 'XBOX' ? <Gamepad className="w-3 h-3" /> : <Computer className="w-3 h-3" />}
                    {station.type || 'PC'}
                  </Badge>
                </TableCell>
                <TableCell>{locationMap.get(station.locationId || "") || "Sin local"}</TableCell>
                <TableCell>
                  <Badge className={statusBadgeColor[station.status]}>
                    {station.status === "available"
                      ? "Disponible"
                      : station.status === "occupied"
                      ? "En Uso"
                      : station.status === "warning"
                      ? "Alerta"
                      : "Mantenimiento"}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono font-semibold">
                  S/. {(station.hourlyRate || 3.00).toFixed(2)}/hr
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {station.specs?.processor ? `${station.specs.processor} • ${station.specs.ram}` : "Sin especificaciones"}
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(station)}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      onToggleStatus(
                        station.id,
                        station.status === "maintenance" ? "available" : "maintenance"
                      )
                    }
                  >
                    <Power className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(station.id)}
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
