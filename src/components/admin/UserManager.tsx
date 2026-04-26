"use client";

import { useState } from "react";
import type { Location, UserProfile, UserRole } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Input } from "@/components/ui/input";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Shield, BarChart3, User } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const createUserSchema = z.object({
  name: z.string().trim().min(2, "Ingresa un nombre valido"),
  email: z.string().trim().email("Ingresa un correo valido"),
  password: z.string().min(6, "La contrasena debe tener al menos 6 caracteres"),
  role: z.enum(["admin", "manager", "operator", "view-only"]),
});

const userRoleSchema = z.object({
  role: z.enum(["admin", "manager", "operator", "view-only"]),
  locationId: z.string(),
  void_sales: z.boolean().default(false),
  free_time: z.boolean().default(false),
  cash_drawer: z.boolean().default(false),
}).superRefine((values, context) => {
  if (values.role === "operator" && values.locationId === "__none") {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["locationId"],
      message: "Selecciona un local para el operador",
    });
  }
});

type CreateUserFormValues = z.infer<typeof createUserSchema>;
type UserRoleFormValues = z.infer<typeof userRoleSchema>;

type UserManagerProps = {
  users: UserProfile[];
  locations: Location[];
  onCreateUser: (payload: CreateUserFormValues) => Promise<void>;
  onChangeRole: (userId: string, role: UserRole, locationIds: string[], permissions: string[]) => Promise<void>;
  onDeactivate: (userId: string) => Promise<void>;
};

const roleDescriptions = {
  admin: "Acceso total. Gestiona usuarios, locales, cabinas y productos.",
  manager: "Gestiona locales y cabinas. Acceso a reportes de ventas.",
  operator: "Opera máquinas y genera ventas.",
  "view-only": "Solo lectura. Visualiza reportes y estado de cabinas.",
};

const roleColors = {
  admin: "bg-red-500/20 text-red-600 border-red-300",
  manager: "bg-blue-500/20 text-blue-600 border-blue-300",
  operator: "bg-green-500/20 text-green-600 border-green-300",
  "view-only": "bg-gray-500/20 text-gray-600 border-gray-300",
};

const roleIcons = {
  admin: <Shield className="w-4 h-4" />,
  manager: <BarChart3 className="w-4 h-4" />,
  operator: <User className="w-4 h-4" />,
  "view-only": <User className="w-4 h-4" />,
};

export default function UserManager({ users, locations, onCreateUser, onChangeRole, onDeactivate }: UserManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  const createForm = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "operator",
    },
  });

  const form = useForm<UserRoleFormValues>({
    resolver: zodResolver(userRoleSchema),
    defaultValues: { role: "operator", locationId: "__none" },
  });

  const getUserLocationText = (user: UserProfile) => {
    if (!user.locationIds || user.locationIds.length === 0) {
      return "Sin local asignado";
    }

    const names = user.locationIds
      .map((locationId) => locations.find((location) => location.id === locationId)?.name)
      .filter((name): name is string => Boolean(name));

    if (names.length === 0) {
      return "Local no encontrado";
    }

    return names.join(", ");
  };

  const handleCreateUser = async (values: CreateUserFormValues) => {
    try {
      setIsCreatingUser(true);
      await onCreateUser(values);
      createForm.reset({
        name: "",
        email: "",
        password: "",
        role: "operator",
      });
    } catch (error) {
      console.error("Error creating user:", error);
      const errorMessage = error instanceof Error ? error.message : "Error al crear usuario";
      createForm.setError("root", { message: errorMessage });
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleEdit = (user: UserProfile) => {
    setEditingId(user.uid);
    form.setValue("role", user.role);
    form.setValue("locationId", user.locationIds?.[0] ?? "__none");
    
    const perms = user.permissions || [];
    form.setValue("void_sales", perms.includes("void_sales"));
    form.setValue("free_time", perms.includes("free_time"));
    form.setValue("cash_drawer", perms.includes("cash_drawer"));
    
    setIsOpen(true);
  };

  const handleSubmit = async (values: UserRoleFormValues) => {
    try {
      if (editingId) {
        const locationIds = values.locationId === "__none" ? [] : [values.locationId];
        
        const permissions: string[] = [];
        if (values.void_sales) permissions.push("void_sales");
        if (values.free_time) permissions.push("free_time");
        if (values.cash_drawer) permissions.push("cash_drawer");

        await onChangeRole(editingId, values.role, locationIds, permissions);
        setIsOpen(false);
        setEditingId(null);
        form.reset();
      }
    } catch (error) {
      console.error("Error changing user role:", error);
      const errorMessage = error instanceof Error ? error.message : "Error al cambiar el rol";
      form.setError("root", { message: errorMessage });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Gestión de Usuarios y Roles</CardTitle>
          <CardDescription>
            Administra los permisos y roles de los operadores
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent>
        <div className="mb-6 rounded-lg border p-4 sm:p-5 bg-card">
          <h3 className="font-semibold text-sm sm:text-base mb-1">Crear nuevo usuario</h3>
          <p className="text-xs sm:text-sm text-muted-foreground mb-4">
            Crea cuentas nuevas y asigna su rol inicial.
          </p>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleCreateUser)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={createForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej. Juan Perez" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Correo</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="usuario@cabinegrid.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contrasena</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Minimo 6 caracteres" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rol</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="manager">Gerente</SelectItem>
                        <SelectItem value="operator">Operador</SelectItem>
                        <SelectItem value="view-only">Lectura</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>{roleDescriptions[createForm.watch("role")]}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {createForm.formState.errors.root?.message && (
                <p className="md:col-span-2 text-sm text-destructive">
                  {createForm.formState.errors.root.message}
                </p>
              )}
              <div className="md:col-span-2 flex justify-end">
                <Button type="submit" disabled={isCreatingUser}>
                  {isCreatingUser ? "Creando..." : "Crear Usuario"}
                </Button>
              </div>
            </form>
          </Form>
        </div>

        <div className="mb-6 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <h3 className="font-semibold text-sm mb-3">Roles Disponibles:</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(Object.entries(roleDescriptions) as [UserRole, string][]).map(([role, desc]) => (
              <div key={role} className="flex gap-2 text-sm">
                <div className={`p-2 rounded flex-shrink-0 ${roleColors[role]}`}>
                  {roleIcons[role]}
                </div>
                <div>
                  <div className="font-medium capitalize">{role}</div>
                  <div className="text-xs text-muted-foreground">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre/Email</TableHead>
              <TableHead>Rol Actual</TableHead>
              <TableHead>Permisos</TableHead>
              <TableHead>Local asignado</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const perms = user.permissions || [];
              return (
                <TableRow key={user.uid}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{user.name || "Sin nombre"}</span>
                      <span className="text-sm text-muted-foreground">{user.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={`${roleColors[user.role]} border`}>
                      <span className="mr-1">{roleIcons[user.role]}</span>
                      {user.role === "admin"
                        ? "Administrador"
                        : user.role === "manager"
                        ? "Gerente"
                        : user.role === "operator"
                        ? "Operador"
                        : "Lectura"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-[220px]">
                      {perms.includes("void_sales") && <Badge variant="outline" className="text-[9px] border-zinc-700 bg-zinc-900">Anular</Badge>}
                      {perms.includes("free_time") && <Badge variant="outline" className="text-[9px] border-zinc-700 bg-zinc-900">Tiempo</Badge>}
                      {perms.includes("cash_drawer") && <Badge variant="outline" className="text-[9px] border-zinc-700 bg-zinc-900">Caja</Badge>}
                      {perms.length === 0 && <span className="text-[10px] text-zinc-500">-</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">{getUserLocationText(user)}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.isActive !== false ? "default" : "secondary"}>
                      {user.isActive !== false ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(user)}
                      disabled={user.uid === "self"}
                    >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeactivate(user.uid)}
                    disabled={user.uid === "self" || user.role === "admin"}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
        </Table>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Usuario</DialogTitle>
              <DialogDescription>
                Configura el rol y el local asignado para este usuario
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rol</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="admin">
                            <div className="flex items-center gap-2">
                              {roleIcons.admin}
                              Administrador
                            </div>
                          </SelectItem>
                          <SelectItem value="manager">
                            <div className="flex items-center gap-2">
                              {roleIcons.manager}
                              Gerente
                            </div>
                          </SelectItem>
                          <SelectItem value="operator">
                            <div className="flex items-center gap-2">
                              {roleIcons.operator}
                              Operador
                            </div>
                          </SelectItem>
                          <SelectItem value="view-only">
                            <div className="flex items-center gap-2">
                              {roleIcons["view-only"]}
                              Lectura
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        {roleDescriptions[form.watch("role")]}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="locationId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Local asignado</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona un local" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__none">Sin local asignado</SelectItem>
                          {locations.map((location) => (
                            <SelectItem key={location.id} value={location.id}>
                              {location.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Requerido para operadores. Para admin/gerente puede quedar sin local.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="border-t border-zinc-800 pt-3 space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Permisos Especiales</span>
                  
                  <FormField
                    control={form.control}
                    name="void_sales"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-xl border border-zinc-800 p-3 bg-zinc-900/40">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="text-xs font-semibold text-zinc-200">Puede anular ventas</FormLabel>
                          <FormDescription className="text-[10px] text-zinc-400">Habilita la anulacion de tickets generados</FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="free_time"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-xl border border-zinc-800 p-3 bg-zinc-900/40">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="text-xs font-semibold text-zinc-200">Puede regalar tiempo</FormLabel>
                          <FormDescription className="text-[10px] text-zinc-400">Acceso a otorgar tiempo libre/gratis</FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cash_drawer"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-xl border border-zinc-800 p-3 bg-zinc-900/40">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="text-xs font-semibold text-zinc-200">Puede abrir caja sin venta</FormLabel>
                          <FormDescription className="text-[10px] text-zinc-400">Apertura de cajon monedero manual</FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>

                {form.formState.errors.root?.message && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.root.message}
                  </p>
                )}
                <DialogFooter>
                  <Button type="submit">Guardar Cambios</Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
