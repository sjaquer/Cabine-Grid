"use client";

import { useState } from "react";
import type { Location, UserProfile, UserRole } from "@/lib/types";
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
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
  locationIds: z.array(z.string()).optional(),
});

const userRoleSchema = z.object({
  role: z.enum(["admin", "manager", "operator", "view-only"]),
  locationIds: z.array(z.string()).optional(),
});

type CreateUserFormValues = z.infer<typeof createUserSchema>;
type UserRoleFormValues = z.infer<typeof userRoleSchema>;

type UserManagerProps = {
  users: UserProfile[];
  locations: Location[];
  onCreateUser: (payload: CreateUserFormValues) => Promise<void>;
  onUpdateUserAccess: (userId: string, payload: { role: UserRole; locationIds: string[] }) => Promise<void>;
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

export default function UserManager({ users, locations, onCreateUser, onUpdateUserAccess, onDeactivate }: UserManagerProps) {
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
      locationIds: [],
    },
  });

  const form = useForm<UserRoleFormValues>({
    resolver: zodResolver(userRoleSchema),
    defaultValues: { role: "operator" },
  });

  const handleCreateUser = async (values: CreateUserFormValues) => {
    try {
      setIsCreatingUser(true);
      await onCreateUser(values);
      createForm.reset({
        name: "",
        email: "",
        password: "",
        role: "operator",
        locationIds: [],
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
    form.setValue("locationIds", user.locationIds ?? []);
    setIsOpen(true);
  };

  const handleSubmit = async (values: UserRoleFormValues) => {
    try {
      if (editingId) {
        await onUpdateUserAccess(editingId, {
          role: values.role,
          locationIds: values.locationIds ?? [],
        });
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
              <FormField
                control={createForm.control}
                name="locationIds"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Locales asignados</FormLabel>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-md border p-3">
                      {locations.map((location) => {
                        const checked = (field.value ?? []).includes(location.id);
                        return (
                          <label key={location.id} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(isChecked) => {
                                const base = field.value ?? [];
                                if (isChecked) {
                                  field.onChange(Array.from(new Set([...base, location.id])));
                                } else {
                                  field.onChange(base.filter((id) => id !== location.id));
                                }
                              }}
                            />
                            <span>{location.name}</span>
                          </label>
                        );
                      })}
                    </div>
                    <FormDescription>
                      Si no seleccionas locales, el acceso quedará sin restricción por local.
                    </FormDescription>
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
              <TableHead>Locales</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
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
                  <span className="text-sm text-muted-foreground">
                    {user.locationIds && user.locationIds.length > 0
                      ? user.locationIds
                          .map((id) => locations.find((location) => location.id === id)?.name || id)
                          .join(", ")
                      : "Sin restricción"}
                  </span>
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
                    disabled={user.uid === "self" || user.role === "admin"}
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
            ))}
          </TableBody>
        </Table>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Acceso de Usuario</DialogTitle>
              <DialogDescription>
                Ajusta rol y locales permitidos para este usuario.
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
                  name="locationIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Locales asignados</FormLabel>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-md border p-3">
                        {locations.map((location) => {
                          const checked = (field.value ?? []).includes(location.id);
                          return (
                            <label key={location.id} className="flex items-center gap-2 text-sm">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(isChecked) => {
                                  const base = field.value ?? [];
                                  if (isChecked) {
                                    field.onChange(Array.from(new Set([...base, location.id])));
                                  } else {
                                    field.onChange(base.filter((id) => id !== location.id));
                                  }
                                }}
                              />
                              <span>{location.name}</span>
                            </label>
                          );
                        })}
                      </div>
                      <FormDescription>
                        Si no seleccionas locales, el acceso quedará sin restricción por local.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
