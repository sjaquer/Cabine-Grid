"use client";

import { useMemo, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Customer } from "@/lib/types";
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
import { Input } from "@/components/ui/input";
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
import { Pencil, Plus, Search, Trash2, UserRound } from "lucide-react";

const customerSchema = z.object({
  customerCode: z.string().trim().min(1, "El codigo es obligatorio").max(30, "Maximo 30 caracteres"),
  fullName: z.string().trim().min(2, "Ingresa el nombre completo").max(120, "Maximo 120 caracteres"),
  age: z
    .union([z.coerce.number().int().min(5, "Edad minima 5").max(110, "Edad maxima 110"), z.nan()])
    .optional()
    .transform((value) => (typeof value === "number" && Number.isFinite(value) ? value : undefined)),
  phone: z.string().trim().optional(),
  email: z.string().trim().email("Email invalido").optional().or(z.literal("")),
  favoriteGamesText: z.string().trim().optional(),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

type CustomerManagerProps = {
  customers: Customer[];
  onAdd: (customer: Omit<Customer, "id">) => Promise<void>;
  onEdit: (id: string, updates: Partial<Customer>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

const weekdayLabels = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];

function getTopKey(map?: Record<string, number>, fallback = "-") {
  if (!map) return fallback;
  let bestKey: string | null = null;
  let bestValue = -1;

  Object.entries(map).forEach(([key, value]) => {
    if (value > bestValue) {
      bestKey = key;
      bestValue = value;
    }
  });

  return bestKey ?? fallback;
}

function toFavoriteGames(value?: string[]): string {
  if (!value || value.length === 0) return "-";
  return value.join(", ");
}

function parseFavoriteGames(input?: string): string[] {
  if (!input) return [];
  return input
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function formatLastVisit(customer: Customer): string {
  const value = customer.metrics?.lastVisitAt;
  if (!value || typeof value.toDate !== "function") return "-";
  return value.toDate().toLocaleString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CustomerManager({ customers, onAdd, onEdit, onDelete }: CustomerManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const sortedCustomers = useMemo(
    () => [...customers].sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [customers]
  );

  const filteredCustomers = useMemo(() => {
    const needle = normalizeText(searchTerm);
    if (!needle) return sortedCustomers;

    return sortedCustomers.filter((customer) => {
      const haystackName = normalizeText(customer.fullName);
      const haystackCode = normalizeText(customer.customerCode);
      return haystackName.includes(needle) || haystackCode.includes(needle);
    });
  }, [searchTerm, sortedCustomers]);

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      customerCode: "",
      fullName: "",
      age: undefined,
      phone: "",
      email: "",
      favoriteGamesText: "",
    },
  });

  const resetForm = () => {
    form.reset({
      customerCode: "",
      fullName: "",
      age: undefined,
      phone: "",
      email: "",
      favoriteGamesText: "",
    });
    setEditingId(null);
  };

  const handleEdit = (customer: Customer) => {
    setEditingId(customer.id);
    form.reset({
      customerCode: customer.customerCode,
      fullName: customer.fullName,
      age: customer.age,
      phone: customer.phone || "",
      email: customer.email || "",
      favoriteGamesText: customer.favoriteGames?.join(", ") || "",
    });
    setIsOpen(true);
  };

  const handleSubmit = async (values: CustomerFormValues) => {
    const payload: Omit<Customer, "id"> = {
      customerCode: values.customerCode.trim().toUpperCase(),
      fullName: values.fullName.trim(),
      ...(typeof values.age === "number" ? { age: values.age } : {}),
      ...(values.phone?.trim() ? { phone: values.phone.trim() } : {}),
      ...(values.email?.trim() ? { email: values.email.trim() } : {}),
      favoriteGames: parseFavoriteGames(values.favoriteGamesText),
      isActive: true,
    };

    try {
      if (editingId) {
        await onEdit(editingId, payload);
      } else {
        await onAdd(payload);
      }
      setIsOpen(false);
      resetForm();
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo guardar el cliente";
      form.setError("root", { message });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>CRM de Clientes</CardTitle>
          <CardDescription>
            Crea fichas de cliente y revisa comportamiento: compras, horas, frecuencia y preferencia de cabina.
          </CardDescription>
        </div>
        <Dialog
          open={isOpen}
          onOpenChange={(next) => {
            setIsOpen(next);
            if (!next) {
              resetForm();
            }
          }}
        >
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={resetForm}>
              <Plus className="w-4 h-4" />
              Nuevo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar cliente" : "Crear cliente"}</DialogTitle>
              <DialogDescription>
                Ingresa datos base para fidelizacion y analitica comercial.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="customerCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Codigo de cliente</FormLabel>
                      <FormControl>
                        <Input placeholder="CLI-001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre completo</FormLabel>
                      <FormControl>
                        <Input placeholder="Sebastian Jaque" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="age"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Edad</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="5"
                          max="110"
                          placeholder="18"
                          value={field.value ?? ""}
                          onChange={(event) => {
                            const next = event.target.value;
                            field.onChange(next === "" ? undefined : Number(next));
                          }}
                        />
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
                      <FormLabel>Número de celular</FormLabel>
                      <FormControl>
                        <Input placeholder="+51 900 123 456" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Correo electrónico</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="cliente@email.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="favoriteGamesText"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Juegos favoritos</FormLabel>
                      <FormControl>
                        <Input placeholder="Valorant, Dota 2, FC 25" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.formState.errors.root?.message && (
                  <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
                )}

                <DialogFooter>
                  <Button type="submit">{editingId ? "Guardar cambios" : "Crear cliente"}</Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent>
        {sortedCustomers.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Aun no hay clientes registrados.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
              <div className="relative w-full sm:max-w-sm">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Buscar por nombre o codigo"
                  className="pl-9"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {filteredCustomers.length} de {sortedCustomers.length} cliente(s)
              </p>
            </div>

            {filteredCustomers.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                No se encontraron clientes con ese nombre o codigo.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Codigo</TableHead>
                    <TableHead>Edad</TableHead>
                    <TableHead>Juegos</TableHead>
                    <TableHead>Sesiones</TableHead>
                    <TableHead>Compras</TableHead>
                    <TableHead>Horas</TableHead>
                    <TableHead>Gasto</TableHead>
                    <TableHead>Ticket prom.</TableHead>
                    <TableHead>PC Frecuente</TableHead>
                    <TableHead>Dias/Semana</TableHead>
                    <TableHead>Hora frecuente</TableHead>
                    <TableHead>Ultima visita</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.map((customer) => {
                    const metrics = customer.metrics;
                    const favoritePc = getTopKey(metrics?.machineUsage, "-");
                    const bestWeekday = getTopKey(metrics?.visitsByWeekday, "-");
                    const frequentHour = getTopKey(metrics?.visitHours, "-");
                    const weeklyDays = metrics?.visitsByWeekday
                      ? Object.values(metrics.visitsByWeekday).filter((count) => count > 0).length
                      : 0;
                    const totalSessions = metrics?.totalSessions ?? 0;
                    const totalSpent = metrics?.totalSpent ?? 0;
                    const avgTicket = totalSessions > 0 ? totalSpent / totalSessions : 0;

                    const weekdayText =
                      bestWeekday !== "-" && weekdayLabels[Number(bestWeekday)]
                        ? weekdayLabels[Number(bestWeekday)]
                        : "-";

                    return (
                      <TableRow key={customer.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="p-1.5 rounded-md bg-primary/10 text-primary">
                              <UserRound className="w-3.5 h-3.5" />
                            </span>
                            <span className="font-medium">{customer.fullName}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{customer.customerCode}</Badge>
                        </TableCell>
                        <TableCell>{customer.age ?? "-"}</TableCell>
                        <TableCell className="max-w-[220px] truncate">{toFavoriteGames(customer.favoriteGames)}</TableCell>
                        <TableCell>{totalSessions}</TableCell>
                        <TableCell>{metrics?.totalProductsBought ?? 0}</TableCell>
                        <TableCell>{((metrics?.totalMinutesRented ?? 0) / 60).toFixed(1)}</TableCell>
                        <TableCell>S/. {totalSpent.toFixed(2)}</TableCell>
                        <TableCell>S/. {avgTicket.toFixed(2)}</TableCell>
                        <TableCell>{favoritePc}</TableCell>
                        <TableCell>{weeklyDays > 0 ? weeklyDays : "-"}</TableCell>
                        <TableCell>
                          {frequentHour !== "-" ? `${String(Number(frequentHour)).padStart(2, "0")}:00` : "-"}
                          {weekdayText !== "-" ? ` (${weekdayText})` : ""}
                        </TableCell>
                        <TableCell>{formatLastVisit(customer)}</TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex items-center gap-2">
                            <Button variant="outline" size="icon" onClick={() => handleEdit(customer)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="destructive" size="icon" onClick={() => onDelete(customer.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
