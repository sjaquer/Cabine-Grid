"use client";

import { z } from "zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Machine } from "@/lib/types";
import { clients, rates } from "@/lib/data";

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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Clock } from "lucide-react";

const OCCASIONAL_CLIENT_VALUE = "__ocasional__";

const formSchema = z.object({
  client: z.string().optional(),
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

type AssignPCDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  machine: Machine | null;
  onAssign: (values: AssignPCFormValues) => void;
};

export default function AssignPCDialog({
  isOpen,
  onOpenChange,
  machine,
  onAssign,
}: AssignPCDialogProps) {
  const form = useForm<AssignPCFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      client: undefined,
      usageMode: 'free',
      prepaidHours: 1,
    },
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({
        client: undefined,
        usageMode: 'free',
        prepaidHours: 1,
      });
    }
  }, [isOpen, form]);
  
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

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden">
        <div className="bg-gradient-to-r from-primary/20 via-transparent to-accent/20 p-6 border-b">
          <DialogHeader className="space-y-1">
            <DialogTitle className="font-headline text-2xl flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/30">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              Asignar {machine?.name}
            </DialogTitle>
            <DialogDescription className="text-sm">
              Configura la sesión del cliente
            </DialogDescription>
          </DialogHeader>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 p-6" id="assignPC-form">
            
            {/* Cliente */}
            <FormField
              control={form.control}
              name="client"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold">Cliente (Opcional)</FormLabel>
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
                      {clients.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Modo de Uso */}
            <FormField
              control={form.control}
              name="usageMode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold">Modo de Uso</FormLabel>
                  <div className="grid grid-cols-2 gap-3">
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
                  <p className="text-lg font-bold text-green-500 font-mono">
                    S/. {(effectiveRate.pricePerHour * (Number(form.watch('prepaidHours')) || 0)).toFixed(2)}
                  </p>
                </div>
              )}
            </div>
          </form>
        </Form>

        <DialogFooter className="p-6 border-t bg-secondary/30 gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="assignPC-form" disabled={isSubmitting}>
            {isSubmitting ? "Iniciando..." : "Iniciar Sesión"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
