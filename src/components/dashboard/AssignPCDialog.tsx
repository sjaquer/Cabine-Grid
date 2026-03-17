"use client";

import { z } from "zod";
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
  availableMachines: Machine[];
  onAssign: (values: AssignPCFormValues) => void;
};

export default function AssignPCDialog({
  isOpen,
  onOpenChange,
  availableMachines,
  onAssign,
}: AssignPCDialogProps) {
  const form = useForm<AssignPCFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      usageMode: "free",
      rateId: "A",
    },
  });

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
          <DialogTitle className="font-headline">Asignar PC a Cliente</DialogTitle>
          <DialogDescription>
            Seleccione una PC disponible y configure la sesión del cliente.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="machineId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>PC Disponible</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar PC..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableMachines.map((machine) => (
                          <SelectItem key={machine.id} value={String(machine.id)}>
                            {machine.name}
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
                name="client"
                render={({ field }) => (
                   <FormItem>
                    <FormLabel>Cliente</FormLabel>
                     <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar cliente..." />
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
            </div>
            <FormField
              control={form.control}
              name="rateId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tarifa</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                      <Input type="number" placeholder="Ej: 1.5" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Iniciando...' : 'Iniciar Sesión'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
