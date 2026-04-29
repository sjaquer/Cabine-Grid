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
import { Clock, Search, X, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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
  whatsapp: z.string().trim().optional(),
  email: z.string().trim().email("Email invalido").optional().or(z.literal("")),
  favoriteGamesText: z.string().trim().optional(),
});

type QuickCustomerFormValues = z.infer<typeof quickCustomerSchema>;

function normalizeText(value: string | undefined | null): string {
  if (!value) return "";
  return String(value)
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
      whatsapp: "",
      email: "",
      favoriteGamesText: "",
    },
  });

  const [showQuickCustomer, setShowQuickCustomer] = useState(false);
  const [showCustomerDetail, setShowCustomerDetail] = useState(false);
  const [showQuickMoreFields, setShowQuickMoreFields] = useState(false);

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
      setShowQuickCustomer(false);
      setShowCustomerDetail(false);
      setShowQuickMoreFields(false);
      form.reset({
        customerId: undefined,
        usageMode: 'free',
        prepaidHours: 1,
      });
      quickCustomerForm.reset({
        customerCode: "",
        fullName: "",
        age: undefined,
        whatsapp: "",
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
        ...(values.whatsapp?.trim() ? { whatsapp: values.whatsapp.trim() } : {}),
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

      setCustomerSearch(created.fullName);

      quickCustomerForm.reset({
        customerCode: "",
        fullName: "",
        age: undefined,
        whatsapp: "",
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
        <div className="p-5 sm:p-6 border-b border-border bg-card shrink-0 flex items-center justify-between shadow-sm z-10 relative">
          <DialogHeader className="space-y-1 text-left w-full">
            <DialogTitle className="font-headline text-xl sm:text-2xl flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 shadow-inner">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              Asignar <span className="text-primary font-black tracking-tight">{machine?.name}</span>
            </DialogTitle>
            <DialogDescription className="text-sm font-medium tracking-wide">
              Configura la sesión y modalidad de uso para el cliente.
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
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-sm font-semibold">Cliente (Opcional)</FormLabel>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowQuickCustomer(!showQuickCustomer)}
                      className="text-xs h-7 px-2 text-primary hover:text-primary hover:bg-primary/10"
                    >
                      {showQuickCustomer ? "Ocultar Registro" : "¿Cliente nuevo?"}
                    </Button>
                  </div>
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
                        <div className="absolute z-50 w-full bg-card border border-border rounded-xl shadow-2xl mt-1.5 max-h-[300px] overflow-y-auto divide-y divide-border/50">
                          {filteredCustomers.map((customer) => (
                            <div
                              key={customer.id}
                              className="p-4 hover:bg-secondary cursor-pointer text-base flex justify-between items-center transition-all active:bg-secondary/70"
                              onClick={() => {
                                field.onChange(customer.id);
                                setCustomerSearch(customer.fullName);
                              }}
                            >
                              <span className="font-semibold text-foreground tracking-tight">{customer.fullName}</span>
                              <span className="text-xs font-bold font-mono bg-background text-primary py-1 px-2 rounded-md border border-border">
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
                <CardContent className="space-y-3 text-sm">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Sesiones</p>
                      <p className="font-semibold">{selectedCustomer.metrics?.totalSessions ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Gasto total</p>
                      <p className="font-semibold">S/. {(selectedCustomer.metrics?.totalSpent ?? 0).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Horas</p>
                      <p className="font-semibold">{(((selectedCustomer.metrics?.totalMinutesRented ?? 0) / 60)).toFixed(1)} h</p>
                    </div>
                  </div>
                  <Collapsible open={showCustomerDetail} onOpenChange={setShowCustomerDetail}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-full justify-between text-xs">
                        Más detalle del cliente
                        <ChevronDown className={`h-4 w-4 transition-transform ${showCustomerDetail ? "rotate-180" : ""}`} />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-2">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
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
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </CardContent>
              </Card>
            )}

            {showQuickCustomer && (
              <Card className="border border-border bg-card/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Crear cliente rápido</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">Registra un cliente sin salir de esta asignación.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...quickCustomerForm}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <FormField
                        control={quickCustomerForm.control}
                        name="customerCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs text-foreground font-semibold">Código</FormLabel>
                            <FormControl>
                              <Input placeholder="CLI-001" {...field} className="h-9 text-xs bg-background border-border text-foreground focus-visible:ring-primary" />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={quickCustomerForm.control}
                        name="fullName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs text-foreground font-semibold">Nombre completo</FormLabel>
                            <FormControl>
                              <Input placeholder="Cliente" {...field} className="h-9 text-xs bg-background border-border text-foreground focus-visible:ring-primary" />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                      <div className="sm:col-span-2">
                        <Collapsible open={showQuickMoreFields} onOpenChange={setShowQuickMoreFields}>
                          <CollapsibleTrigger asChild>
                            <Button type="button" variant="ghost" size="sm" className="h-8 justify-between w-full text-xs">
                              Más datos del cliente
                              <ChevronDown className={`h-4 w-4 transition-transform ${showQuickMoreFields ? "rotate-180" : ""}`} />
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="pt-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <FormField
                        control={quickCustomerForm.control}
                        name="age"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs text-foreground font-semibold">Edad</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="5"
                                max="110"
                                placeholder="18"
                                className="h-9 text-xs bg-background border-border text-foreground focus-visible:ring-primary"
                                value={field.value ?? ""}
                                onChange={(event) => {
                                  const next = event.target.value;
                                  field.onChange(next === "" ? undefined : Number(next));
                                }}
                              />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={quickCustomerForm.control}
                        name="whatsapp"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs text-foreground font-semibold">WhatsApp</FormLabel>
                            <FormControl>
                              <Input placeholder="+51 900 123 456" {...field} className="h-9 text-xs bg-background border-border text-foreground focus-visible:ring-primary" />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={quickCustomerForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs text-foreground font-semibold">Correo electrónico</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="cliente@email.com" {...field} className="h-9 text-xs bg-background border-border text-foreground focus-visible:ring-primary" />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={quickCustomerForm.control}
                        name="favoriteGamesText"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs text-foreground font-semibold">Juegos favoritos</FormLabel>
                            <FormControl>
                              <Input placeholder="Valorant, Dota 2" {...field} className="h-9 text-xs bg-background border-border text-foreground focus-visible:ring-primary" />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </div>
                      {quickCustomerForm.formState.errors.root?.message && (
                        <p className="sm:col-span-2 text-xs text-destructive">
                          {quickCustomerForm.formState.errors.root.message}
                        </p>
                      )}
                      <div className="sm:col-span-2 flex justify-end pt-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-3 rounded-lg transition-all"
                          disabled={isCreatingCustomer}
                          onClick={quickCustomerForm.handleSubmit(handleQuickCreateCustomer)}
                        >
                          {isCreatingCustomer ? "Creando..." : "Guardar y vincular"}
                        </Button>
                      </div>
                    </div>
                  </Form>
                </CardContent>
              </Card>
            )}

            {/* Modo de Uso */}
            <FormField
              control={form.control}
              name="usageMode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold text-foreground tracking-wide">Modalidad de Uso</FormLabel>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div 
                      className={`group relative overflow-hidden transition-all duration-300 p-4 rounded-xl border-2 cursor-pointer flex flex-col justify-between h-full ${field.value === 'free' ? 'border-primary bg-primary/5 shadow-[0_0_15px_hsl(var(--primary)/0.12)] ring-1 ring-primary/20' : 'border-border/60 bg-card hover:bg-secondary/40 hover:border-border'}`}
                      onClick={() => field.onChange('free')}
                    >
                      <div className="flex justify-between items-start mb-3">
                          <div className={`p-2 rounded-lg ${field.value === 'free' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground group-hover:text-foreground'}`}>
                              <Clock className="w-5 h-5" />
                          </div>
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${field.value === 'free' ? 'border-primary' : 'border-muted-foreground/30'}`}>
                              {field.value === 'free' && <div className="w-2 h-2 bg-primary rounded-full" />}
                          </div>
                      </div>
                      <div>
                          <h3 className={`font-bold text-base tracking-tight ${field.value === 'free' ? 'text-primary' : 'text-foreground'}`}>Pago por Uso</h3>
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">Cobro dinámico según el tiempo real utilizado. Pago al finalizar.</p>
                      </div>
                    </div>

                    <div 
                      className={`group relative overflow-hidden transition-all duration-300 p-4 rounded-xl border-2 cursor-pointer flex flex-col justify-between h-full ${field.value === 'prepaid' ? 'border-primary bg-primary/5 shadow-[0_0_15px_hsl(var(--primary)/0.12)] ring-1 ring-primary/20' : 'border-border/60 bg-card hover:bg-secondary/40 hover:border-border'}`}
                      onClick={() => field.onChange('prepaid')}
                    >
                      <div className="flex justify-between items-start mb-3">
                          <div className={`p-2 rounded-lg ${field.value === 'prepaid' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground group-hover:text-foreground'}`}>
                              <Search className="w-5 h-5" />
                          </div>
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${field.value === 'prepaid' ? 'border-primary' : 'border-muted-foreground/30'}`}>
                              {field.value === 'prepaid' && <div className="w-2 h-2 bg-primary rounded-full" />}
                          </div>
                      </div>
                      <div>
                          <h3 className={`font-bold text-base tracking-tight ${field.value === 'prepaid' ? 'text-primary' : 'text-foreground'}`}>Prepagado</h3>
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">Horas compradas por adelantado. La sesión detiene la PC al agotar el tiempo.</p>
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
                  <FormItem className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <FormLabel className="text-sm font-semibold text-primary">Horas a Prepagar</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input 
                          type="number" 
                          placeholder="Ej: 2" 
                          min="0.5" 
                          step="0.5"
                          {...field}
                          className="h-12 text-lg font-mono pl-4 pr-12 bg-background border-primary/40 focus-visible:ring-primary shadow-sm"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">hrs</span>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Información de la máquina y tarifa */}
            <div className="p-4 rounded-xl bg-card border border-border shadow-sm space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-border/50">
                <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Estación Asignada</p>
                <p className="text-sm font-bold text-foreground bg-secondary/50 px-2.5 py-1 rounded-md">{machine?.name}</p>
              </div>
              
              {effectiveRate && (
                <div className="flex justify-between items-center pb-3 border-b border-border/50">
                  <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Tarifa Aplicada</p>
                  <p className="text-sm font-bold text-primary font-mono bg-primary/10 px-2.5 py-1 rounded-md border border-primary/20">
                    {effectiveRate.name} <span className="opacity-60">(S/ {effectiveRate.pricePerHour.toFixed(2)}/h)</span>
                  </p>
                </div>
              )}
              
              {currentMode === 'prepaid' && form.watch('prepaidHours') && effectiveRate && (
                <div className="flex justify-between items-center pt-1">
                  <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Total Prepagado</p>
                  <p className="text-2xl font-black text-status-success font-mono">
                    S/ {(effectiveRate.pricePerHour * (Number(form.watch('prepaidHours')) || 0)).toFixed(2)}
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
