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

const formSchema = z.object({
    machineId: z.string().min(1, "Debe seleccionar una PC."),
    client: z.string().optional(),
    rateId: z.enum(["A", "B"], { required_error: "Debe seleccionar una tarifa." }),
    usageMode: z.enum(["free", "prepaid"]),
    prepaidInputMode: z.enum(['time', 'amount']).default('time'),
    prepaidValue: z.coerce.number({ invalid_type_error: 'Debe ser un número' }).positive("Debe ser mayor a 0").optional(),
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
      rateId: "A",
      prepaidInputMode: 'amount',
    },
  });

  useEffect(() => {
    if (machine) {
      form.setValue('machineId', String(machine.id));
      form.setValue('rateId', machine.rateId || 'A');
    } else {
        form.reset({
            usageMode: "free",
            rateId: "A",
            prepaidInputMode: 'amount',
            client: undefined,
            prepaidValue: undefined,
        });
    }
  }, [machine, form, isOpen]);
  
  const { formState: { isSubmitting } } = form;
  const usageMode = form.watch("usageMode");
  const prepaidInputMode = form.watch("prepaidInputMode");
  const prepaidValue = form.watch("prepaidValue");
  const rateId = form.watch("rateId");
  const selectedRate = rates.find(r => r.id === rateId);
  
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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-headline">Asignar {machine?.name}</DialogTitle>
          <DialogDescription>
            Configure la sesión del cliente para esta cabina.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
             <FormField
              control={form.control}
              name="client"
              render={({ field }) => (
                 <FormItem>
                  <FormLabel>Cliente (Opcional)</FormLabel>
                   <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Cliente ocasional" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client} value={client}>
                          {client}
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
              name="rateId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tarifa</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar tarifa..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {rates.map((rate) => (
                        <SelectItem key={rate.id} value={rate.id}>
                          {`${rate.name} (${formatCurrency(rate.pricePerHour)}/hr)`}
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
              name="usageMode"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Modo de Uso</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="grid grid-cols-2 gap-4"
                    >
                      <FormItem>
                        <RadioGroupItem value="free" id="free" className="peer sr-only" />
                        <Label htmlFor="free" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                          Tiempo Libre
                        </Label>
                      </FormItem>
                       <FormItem>
                        <RadioGroupItem value="prepaid" id="prepaid" className="peer sr-only" />
                        <Label htmlFor="prepaid" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                          Prepago
                        </Label>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {usageMode === "prepaid" && (
             <div className="p-4 border rounded-md space-y-4">
                <FormField
                    control={form.control}
                    name="prepaidInputMode"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Método de Prepago</FormLabel>
                            <FormControl>
                                <Tabs
                                    value={field.value}
                                    onValueChange={field.onChange}
                                    className="w-full"
                                >
                                    <TabsList className="grid w-full grid-cols-2">
                                        <TabsTrigger value="amount">Por Monto</TabsTrigger>
                                        <TabsTrigger value="time">Por Tiempo</TabsTrigger>
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
                        <FormLabel>{prepaidInputMode === 'amount' ? 'Monto a Pagar (PEN)' : 'Horas a Jugar'}</FormLabel>
                        <FormControl>
                        <Input type="number" step="0.5" placeholder={prepaidInputMode === 'amount' ? 'Ej: 10.00' : 'Ej: 1.5'} {...field} value={field.value ?? ''} />
                        </FormControl>
                        {calculatedValue && <FormDescription>Equivale a: {calculatedValue}</FormDescription>}
                        <FormMessage />
                    </FormItem>
                    )}
                />
             </div>
            )}
            <DialogFooter className="pt-4">
              <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                {isSubmitting ? 'Iniciando...' : 'Iniciar Sesión'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
