"use client";

import { z } from "zod";
import { useEffect, useMemo, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Customer, Station } from "@/lib/types";
import { rates } from "@/lib/data";

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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Clock, Search, X } from "lucide-react";

const OCCASIONAL_CLIENT_VALUE = "__ocasional__";

const formSchema = z.object({
  customerId: z.string().optional(),
  usageMode: z.enum(['free', 'prepaid']),
  prepaidHours: z.coerce.number().positive("Las horas deben ser mayor a 0").optional(),
}).refine((data) => {
  if (data.usageMode === 'prepaid' && !data.prepaidHours) {
    return false;
  }
  return true;
}, {
  message: "Debes especificar las horas prepagadas",
  path: ["prepaidHours"],
});

export type AssignPCFormValues = z.infer<typeof formSchema>;

const quickCustomerSchema = z.object({
  customerCode: z.string().trim().min(1, "El codigo es obligatorio"),
  fullName: z.string().trim().min(2, "Ingresa el nombre completo"),
  age: z
    .union([z.coerce.number().int().min(5, "Edad minima 5").max(110, "Edad maxima 110"), z.nan()])
    .optional()
    .transform((value) => (typeof value === "number" && Number.isFinite(value) ? value : undefined)),
  phone: z.string().trim().optional(),
  email: z.string().trim().email("Email invalido").optional().or(z.literal("")),
  favoriteGamesText: z.string().trim().optional(),
});

type QuickCustomerFormValues = z.infer<typeof quickCustomerSchema>;

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function customerMatchScore(customer: Customer, query: string): number {
  const needle = normalizeText(query);
  if (!needle) return 0;

  const name = normalizeText(customer.fullName);
  const code = normalizeText(customer.customerCode);

  if (code === needle) return 1200;
  if (name === needle) return 1100;
  if (code.startsWith(needle)) return 900;
  if (name.startsWith(needle)) return 800;

  let score = 0;
  if (code.includes(needle)) score += 600;
  if (name.includes(needle)) score += 500;

  const terms = needle.split(/\s+/).filter(Boolean);
  const termHits = terms.reduce((acc, term) => acc + (name.includes(term) || code.includes(term) ? 1 : 0), 0);
  score += termHits * 60;

  return score;
}

type AssignPCDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  machine: Station | null;
  customers: Customer[];
  onCreateCustomer: (payload: Omit<Customer, "id">) => Promise<Customer>;
  onAssign: (values: AssignPCFormValues) => void;
};

export default function AssignPCDialog({
  isOpen,
  onOpenChange,
  machine,
  customers,
  onCreateCustomer,
  onAssign,
}: AssignPCDialogProps) {
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const weekdayLabels = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];

  const searchInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<AssignPCFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerId: undefined,
      usageMode: 'free',
      prepaidHours: 1,
    },
  });

  const quickCustomerForm = useForm<QuickCustomerFormValues>({
    resolver: zodResolver(quickCustomerSchema),
    defaultValues: {
      customerCode: "",
      fullName: "",
      age: undefined,
      phone: "",
      email: "",
      favoriteGamesText: "",
    },
  });

  const sortedCustomers = useMemo(
    () => [...customers].filter((customer) => customer.isActive !== false).sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [customers]
  );

  const filteredCustomers = useMemo(() => {
    const needle = normalizeText(customerSearch);
    if (!needle) return sortedCustomers;

    return sortedCustomers.filter((customer) => {
      const fullName = normalizeText(customer.fullName);
      const code = normalizeText(customer.customerCode);
      return fullName.includes(needle) || code.includes(needle);
    });
  }, [customerSearch, sortedCustomers]);

  const selectedCustomerId = form.watch("customerId");
  const selectedCustomer = useMemo(() => {
    if (!selectedCustomerId) return null;
    return customers.find((customer) => customer.id === selectedCustomerId) ?? null;
  }, [customers, selectedCustomerId]);

  useEffect(() => {
    if (isOpen) {
      form.reset({
        customerId: undefined,
        usageMode: 'free',
        prepaidHours: 1,
      });
      quickCustomerForm.reset({
        customerCode: "",
        fullName: "",
        age: undefined,
        phone: "",
        email: "",
        favoriteGamesText: "",
      });
      setCustomerSearch("");
      
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, form, quickCustomerForm]);
  
  const { formState: { isSubmitting } } = form;
  const currentMode = form.watch('usageMode');

  // Resetear prepaidHours cuando cambias de modo
  useEffect(() => {
    if (currentMode === 'free') {
      form.setValue('prepaidHours', undefined);
    } else if (currentMode === 'prepaid') {
      if (!form.getValues('prepaidHours')) {
        form.setValue('prepaidHours', 1);
      }
    }
  }, [currentMode, form]);

  // Obtener la tarifa de la máquina
  const machineRate = machine?.rateId ? rates.find(r => r.id === machine.rateId) : null;
  const effectiveRate = machineRate || (machine?.hourlyRate ? { id: 'custom', name: 'Tarifa Personalizada', pricePerHour: machine.hourlyRate, description: 'Tarifa definida en máquina' } : null);

  const onSubmit = (values: AssignPCFormValues) => {
    onAssign(values);
    form.reset();
  };

  const handleSearchEnter = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();

    const bestMatch = [...filteredCustomers]
      .sort((a, b) => customerMatchScore(b, customerSearch) - customerMatchScore(a, customerSearch))[0];

    if (!bestMatch) return;

    form.setValue("customerId", bestMatch.id, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    setCustomerSearch(bestMatch.fullName);

    setTimeout(() => {
      void form.handleSubmit(onSubmit)();
    }, 0);
  };

  const handleQuickCreateCustomer = async (values: QuickCustomerFormValues) => {
    try {
      setIsCreatingCustomer(true);

      const created = await onCreateCustomer({
        customerCode: values.customerCode.trim().toUpperCase(),
        fullName: values.fullName.trim(),
        ...(typeof values.age === "number" ? { age: values.age } : {}),
        ...(values.phone?.trim() ? { phone: values.phone.trim() } : {}),
        ...(values.email?.trim() ? { email: values.email.trim() } : {}),
        favoriteGames: (values.favoriteGamesText || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        isActive: true,
      });

      form.setValue("customerId", created.id, {
        shouldValidate: true,
        shouldDirty: true,
      });

      quickCustomerForm.reset({
        customerCode: "",
        fullName: "",
        age: undefined,
        phone: "",
        email: "",
        favoriteGamesText: "",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo crear el cliente";
      quickCustomerForm.setError("root", { message });
    } finally {
      setIsCreatingCustomer(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-[500px] p-0 overflow-hidden max-h-[100dvh] flex flex-col">
        <div className="bg-gradient-to-r from-primary/20 via-transparent to-accent/20 p-5 sm:p-6 border-b shrink-0">
          <DialogHeader className="space-y-1">
            <DialogTitle className="font-headline text-xl sm:text-2xl flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/30">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              </div>
              Asignar {machine?.name}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Configura la sesión del cliente
            </DialogDescription>
          </DialogHeader>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 sm:space-y-5 p-4 sm:p-6 overflow-y-auto min-h-0 flex-1" id="assignPC-form">
            
            {/* Cliente */}
            <FormField
              control={form.control}
              name="customerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold">Cliente (Opcional)</FormLabel>
                  <div className="relative mb-2 flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                      <Input
                        ref={searchInputRef}
                        value={customerSearch}
                        onChange={(event) => setCustomerSearch(event.target.value)}
                        onKeyDown={handleSearchEnter}
                        placeholder="Buscar cliente por nombre o codigo"
                        className="pl-9 pr-9"
                      />
                      {customerSearch && (
                        <button
                          type="button"
                          onClick={() => {
                            setCustomerSearch("");
                            field.onChange(undefined);
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          aria-label="Limpiar búsqueda"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                      
                      {customerSearch && filteredCustomers.length > 0 && (
                        <div className="absolute z-50 w-full bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl mt-1.5 max-h-[300px] overflow-y-auto divide-y divide-zinc-800/50">
                          {filteredCustomers.map((customer) => (
                            <div
                              key={customer.id}
                              className="p-4 hover:bg-zinc-800 cursor-pointer text-base flex justify-between items-center transition-all active:bg-zinc-800/50"
                              onClick={() => {
                                field.onChange(customer.id);
                                setCustomerSearch(customer.fullName);
                              }}
                            >
                              <span className="font-semibold text-zinc-100 tracking-tight">{customer.fullName}</span>
                              <span className="text-xs font-bold font-mono bg-zinc-950 text-emerald-400 py-1 px-2 rounded-md border border-zinc-800">
                                {customer.customerCode}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <Select
                    onValueChange={(value) => field.onChange(value === OCCASIONAL_CLIENT_VALUE ? undefined : value)}
                    value={field.value ?? OCCASIONAL_CLIENT_VALUE}
                  >
                    <FormControl>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Cliente ocasional" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={OCCASIONAL_CLIENT_VALUE}>Cliente ocasional</SelectItem>
                      {filteredCustomers.length === 0 ? (
                        <div className="p-2 text-center text-xs text-muted-foreground">
                          No se encontraron clientes
                        </div>
                      ) : (
                        filteredCustomers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.fullName} ({customer.customerCode})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {filteredCustomers.length} cliente(s) encontrado(s)
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedCustomer && (
              <Card className="border border-primary/20 bg-primary/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Resumen del cliente seleccionado</CardTitle>
                  <CardDescription>
                    {selectedCustomer.fullName} - Codigo {selectedCustomer.customerCode}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  {(() => {
                    const metrics = selectedCustomer.metrics;
                    const totalSessions = metrics?.totalSessions ?? 0;
                    const totalSpent = metrics?.totalSpent ?? 0;
                    const avgTicket = totalSessions > 0 ? totalSpent / totalSessions : 0;
                    const topDay = Object.entries(metrics?.visitsByWeekday ?? {}).sort((a, b) => b[1] - a[1])[0]?.[0];
                    const topHour = Object.entries(metrics?.visitHours ?? {}).sort((a, b) => b[1] - a[1])[0]?.[0];

                    return (
                      <>
                  <div>
                    <p className="text-xs text-muted-foreground">Sesiones</p>
                    <p className="font-semibold">{totalSessions}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Horas acumuladas</p>
                    <p className="font-semibold">{((metrics?.totalMinutesRented ?? 0) / 60).toFixed(1)} h</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Productos comprados</p>
                    <p className="font-semibold">{metrics?.totalProductsBought ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Gasto acumulado</p>
                    <p className="font-semibold">S/. {totalSpent.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Ticket promedio</p>
                    <p className="font-semibold">S/. {avgTicket.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">PC frecuente</p>
                    <p className="font-semibold">
                      {Object.entries(metrics?.machineUsage ?? {}).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Dia/hora frecuente</p>
                    <p className="font-semibold">
                      {topDay !== undefined ? weekdayLabels[Number(topDay)] : "-"}
                      {topHour !== undefined ? ` ${String(Number(topHour)).padStart(2, "0")}:00` : ""}
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs text-muted-foreground">Juegos favoritos</p>
                    <p className="font-semibold truncate">{(selectedCustomer.favoriteGames ?? []).join(", ") || "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Ultima visita</p>
                    <p className="font-semibold">
                      {metrics?.lastVisitAt?.toDate
                        ? metrics.lastVisitAt.toDate().toLocaleString("es-PE", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "-"}
                    </p>
                  </div>
                      </>
                    );
                  })()}
                </CardContent>
              </Card>
            )}

            <Card className="border border-dashed">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Crear cliente rapido</CardTitle>
                <CardDescription>Registra un cliente sin salir de esta asignacion.</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...quickCustomerForm}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormField
                      control={quickCustomerForm.control}
                      name="customerCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Codigo</FormLabel>
                          <FormControl>
                            <Input placeholder="CLI-001" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={quickCustomerForm.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nombre completo</FormLabel>
                          <FormControl>
                            <Input placeholder="Cliente" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={quickCustomerForm.control}
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
                      control={quickCustomerForm.control}
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
                      control={quickCustomerForm.control}
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
                      control={quickCustomerForm.control}
                      name="favoriteGamesText"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Juegos favoritos</FormLabel>
                          <FormControl>
                            <Input placeholder="Valorant, Dota 2" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {quickCustomerForm.formState.errors.root?.message && (
                      <p className="sm:col-span-2 text-sm text-destructive">
                        {quickCustomerForm.formState.errors.root.message}
                      </p>
                    )}
                    <div className="sm:col-span-2 flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isCreatingCustomer}
                        onClick={quickCustomerForm.handleSubmit(handleQuickCreateCustomer)}
                      >
                        {isCreatingCustomer ? "Creando..." : "Crear cliente y seleccionar"}
                      </Button>
                    </div>
                  </div>
                </Form>
              </CardContent>
            </Card>

            {/* Modo de Uso */}
            <FormField
              control={form.control}
              name="usageMode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold">Modo de Uso</FormLabel>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div 
                      className={`cursor-pointer transition-all p-4 rounded-lg border-2 ${field.value === 'free' ? 'ring-2 ring-primary border-primary' : 'border-muted'}`}
                      onClick={() => field.onChange('free')}
                    >
                      <div className="space-y-3">
                        <div>
                          <h3 className="font-semibold text-base">Pago por Uso</h3>
                          <p className="text-xs text-muted-foreground">Cobro según tiempo real</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input 
                            type="radio" 
                            id="free" 
                            name="usageMode"
                            value="free"
                            checked={field.value === 'free'}
                            onChange={() => field.onChange('free')}
                            className="cursor-pointer"
                          />
                          <label htmlFor="free" className="font-normal cursor-pointer text-sm">Activar</label>
                        </div>
                      </div>
                    </div>

                    <div 
                      className={`cursor-pointer transition-all p-4 rounded-lg border-2 ${field.value === 'prepaid' ? 'ring-2 ring-primary border-primary' : 'border-muted'}`}
                      onClick={() => field.onChange('prepaid')}
                    >
                      <div className="space-y-3">
                        <div>
                          <h3 className="font-semibold text-base">Prepagado</h3>
                          <p className="text-xs text-muted-foreground">Horas compradas por adelantado</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input 
                            type="radio" 
                            id="prepaid" 
                            name="usageMode"
                            value="prepaid"
                            checked={field.value === 'prepaid'}
                            onChange={() => field.onChange('prepaid')}
                            className="cursor-pointer"
                          />
                          <label htmlFor="prepaid" className="font-normal cursor-pointer text-sm">Activar</label>
                        </div>
                      </div>
                    </div>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Horas Prepagadas (si es prepaid) */}
            {currentMode === 'prepaid' && (
              <FormField
                control={form.control}
                name="prepaidHours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold">Horas a Prepagar</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="Ej: 2" 
                        min="0.5" 
                        step="0.5"
                        {...field}
                      />
                    </FormControl>
                    {effectiveRate && field.value && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Total: S/. {(effectiveRate.pricePerHour * field.value).toFixed(2)}
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Información de la máquina y tarifa */}
            <div className="p-4 rounded-lg bg-secondary/30 border border-border/50 space-y-3">
              <div className="text-sm">
                <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Máquina asignada</p>
                <p className="text-lg font-bold text-foreground">{machine?.name}</p>
              </div>
              {effectiveRate && (
                <div className="text-sm">
                  <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Tarifa a aplicar</p>
                  <p className="text-lg font-bold text-accent font-mono">
                    {effectiveRate.name} - S/. {effectiveRate.pricePerHour.toFixed(2)}/hora
                  </p>
                </div>
              )}
              {currentMode === 'prepaid' && form.watch('prepaidHours') && effectiveRate && (
                <div className="text-sm">
                  <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Total a cobrar</p>
                  <p className="text-sm md:text-lg font-bold text-green-500 font-mono">
                    S/. {(effectiveRate.pricePerHour * (Number(form.watch('prepaidHours')) || 0)).toFixed(2)}
                  </p>
                </div>
              )}
            </div>
          </form>
        </Form>

        <DialogFooter className="p-4 sm:p-6 border-t bg-secondary/30 gap-2 sm:gap-3 shrink-0 flex-col sm:flex-row">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Cancelar
          </Button>
          <Button type="submit" form="assignPC-form" disabled={isSubmitting} className="w-full sm:w-auto">
            {isSubmitting ? "Iniciando..." : "Iniciar Sesión"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
