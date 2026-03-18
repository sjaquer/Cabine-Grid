"use client";

import { z } from "zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Machine } from "@/lib/types";
import { clients, rates } from "@/lib/data";
import { formatCurrency } from "@/lib/utils";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, DollarSign } from "lucide-react";

const formSchema = z.object({
    machineId: z.string().min(1, "Debe seleccionar una PC."),
    client: z.string().optional(),
    rateId: z.string({ required_error: "Debe seleccionar una tarifa." }),
    usageMode: z.enum(["free", "prepaid"]),
    prepaidInputMode: z.enum(['time', 'amount']).default('time'),
    prepaidValue: z.coerce.number({ invalid_type_error: 'Debe ser un número' }).positive("Debe ser mayor a 0").max(1000, "Máximo 1000 horas o soles").optional(),
  }).refine(data => {
      if (data.usageMode === 'prepaid') {
        return !!data.prepaidValue;
      }
      return true;
  }, {
      message: "Debe ingresar un valor.",
      path: ["prepaidValue"],
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
      usageMode: "free",
      rateId: rates[0]?.id || "A",
      prepaidInputMode: 'amount',
    },
  });

  useEffect(() => {
    if (machine) {
      form.setValue('machineId', String(machine.id));
      form.setValue('rateId', machine.rateId || rates[0]?.id || "A");
    } else {
        form.reset({
            usageMode: "free",
            rateId: rates[0]?.id || "A",
            prepaidInputMode: 'amount',
            client: undefined,
            prepaidValue: undefined,
        });
    }
  }, [machine?.id, isOpen]);
  
  const { formState: { isSubmitting } } = form;
  const usageMode = form.watch("usageMode");
  const prepaidInputMode = form.watch("prepaidInputMode");
  const prepaidValue = form.watch("prepaidValue");
  const rateId = form.watch("rateId");
  const selectedRate = rates.find(r => r.id === rateId);
  const client = form.watch("client");
  
  let calculatedValue = "";
  if (selectedRate && prepaidValue) {
    if (prepaidInputMode === 'amount') {
      const hours = prepaidValue / selectedRate.pricePerHour;
      calculatedValue = `${hours.toFixed(2)} horas`;
    } else { // time
      const amount = prepaidValue * selectedRate.pricePerHour;
      calculatedValue = formatCurrency(amount);
    }
  }

  function onSubmit(values: AssignPCFormValues) {
    onAssign(values);
    form.reset();
  }

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
              Configure rápidamente la sesión del cliente
            </DialogDescription>
          </DialogHeader>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 p-6">
            
            {/* Cliente - Simplificado */}
            <FormField
              control={form.control}
              name="client"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold">Cliente (Opcional)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Cliente ocasional" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {clients.length === 0 || !field.value ? (
                        <SelectItem value="ocasional" disabled>
                          Cliente ocasional
                        </SelectItem>
                      ) : null}
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

            {/* Tarifa - Con mejor visualización */}
            <FormField
              control={form.control}
              name="rateId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold">Tarifa</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {rates.map((rate) => (
                        <SelectItem key={rate.id} value={rate.id}>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{rate.name}</span>
                            <span className="text-muted-foreground">({formatCurrency(rate.pricePerHour)}/hr)</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Modo de Uso - Tab selecciona visualización */}
            <div className="space-y-3 p-4 rounded-lg bg-secondary/30 border border-border/50">
              <FormField
                control={form.control}
                name="usageMode"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel className="text-sm font-semibold">Modo de Uso</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="grid grid-cols-2 gap-3"
                      >
                        <Label className="flex items-center gap-3 p-3 rounded-lg border-2 border-muted bg-popover/50 hover:bg-secondary/50 cursor-pointer transition peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/10">
                          <RadioGroupItem value="free" className="sr-only" />
                          <div>
                            <div className="font-semibold text-sm">Tiempo Libre</div>
                            <div className="text-xs text-muted-foreground">Sin límite</div>
                          </div>
                        </Label>
                        <Label className="flex items-center gap-3 p-3 rounded-lg border-2 border-muted bg-popover/50 hover:bg-secondary/50 cursor-pointer transition peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/10">
                          <RadioGroupItem value="prepaid" className="sr-only" />
                          <div>
                            <div className="font-semibold text-sm">Prepago</div>
                            <div className="text-xs text-muted-foreground">Cantidad fija</div>
                          </div>
                        </Label>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Prepago detalles */}
            {usageMode === "prepaid" && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="space-y-4 pt-6">
                  <FormField
                    control={form.control}
                    name="prepaidInputMode"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Tabs
                            value={field.value}
                            onValueChange={field.onChange}
                            className="w-full"
                          >
                            <TabsList className="grid w-full grid-cols-2 bg-secondary/60">
                              <TabsTrigger value="amount" className="gap-2">
                                <DollarSign className="w-4 h-4" />
                                Por Monto
                              </TabsTrigger>
                              <TabsTrigger value="time" className="gap-2">
                                <Clock className="w-4 h-4" />
                                Por Tiempo
                              </TabsTrigger>
                            </TabsList>
                          </Tabs>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="prepaidValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">
                          {prepaidInputMode === 'amount' && 'Monto (PEN)'}
                          {prepaidInputMode === 'time' && 'Horas'}
                        </FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.5" 
                            placeholder={prepaidInputMode === 'amount' ? 'Ej: 10.00' : 'Ej: 1.5'} 
                            {...field} 
                            value={field.value ?? ''} 
                            className="h-10 text-lg font-semibold"
                            autoFocus
                          />
                        </FormControl>
                        {calculatedValue && (
                          <FormDescription className="text-sm font-medium text-accent">
                            ✓ Equivale a: {calculatedValue}
                          </FormDescription>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            )}

            {/* Resumen rápido */}
            <Card className="border-dashed border-secondary bg-card/50">
              <CardContent className="pt-4">
                <div className="space-y-2 text-sm">
                  {client && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Cliente:</span>
                      <span className="font-semibold">{client}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Cabina:</span>
                    <span className="font-semibold text-primary">{machine?.name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Tarifa:</span>
                    <span className="font-semibold">{selectedRate?.name}</span>
                  </div>
                  {usageMode === 'prepaid' && (
                    <div className="flex justify-between items-center pt-2 border-t border-border/50 text-primary">
                      <span className="font-semibold">Total:</span>
                      <span className="text-lg font-bold">{prepaidInputMode === 'amount' ? formatCurrency(prepaidValue || 0) : `${prepaidValue} hrs`}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <DialogFooter className="gap-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting} 
                className="flex-1 bg-gradient-to-r from-primary to-primary/80"
              >
                {isSubmitting ? 'Iniciando...' : 'Iniciar Sesión'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
