"use client";

import { z } from "zod";
import { useEffect } from "react";
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

const formSchema = z.object({
  machineId: z.string().min(1, "Debe seleccionar una PC."),
  client: z.string().min(1, "Debe seleccionar un cliente."),
  rateId: z.enum(["A", "B"], { required_error: "Debe seleccionar una tarifa." }),
  usageMode: z.enum(["free", "prepaid"]),
  prepaidHours: z.coerce.number().optional(),
}).refine(data => {
    if (data.usageMode === 'prepaid') {
      return data.prepaidHours && data.prepaidHours > 0;
    }
    return true;
}, {
    message: "Debe ingresar un número de horas válido.",
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
      usageMode: "free",
      rateId: "A",
    },
  });

  useEffect(() => {
    if (machine) {
      form.setValue('machineId', String(machine.id));
      form.setValue('rateId', machine.rateId || 'A');
    } else {
        form.reset();
    }
  }, [machine, form]);

  const { formState: { isSubmitting } } = form;
  const usageMode = form.watch("usageMode");

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
                  <FormLabel>Cliente</FormLabel>
                   <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar un cliente..." />
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
                      className="flex space-x-4"
                    >
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="free" />
                        </FormControl>
                        <FormLabel className="font-normal">Tiempo Libre</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="prepaid" />
                        </FormControl>
                        <FormLabel className="font-normal">Prepago</FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {usageMode === "prepaid" && (
              <FormField
                control={form.control}
                name="prepaidHours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Horas Prepago</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.5" placeholder="Ej: 1.5" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
