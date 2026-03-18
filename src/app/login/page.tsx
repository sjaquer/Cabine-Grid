"use client";

import { useState, useEffect } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useFirebaseAuthInstance, useAuth } from '@/firebase';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Cpu, LogIn, Sparkles } from 'lucide-react';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"

const loginSchema = z.object({
  email: z.string().email('Email inválido.'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres.'),
});

type LoginFields = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { user } = useAuth();
  const auth = useFirebaseAuthInstance();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // Redirect to home if already logged in
  useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  const form = useForm<LoginFields>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit: SubmitHandler<LoginFields> = async (data) => {
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, data.email, data.password);
      toast({
        title: 'Inicio de sesión exitoso',
        description: 'Bienvenido de nuevo.',
      });
      router.push('/');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error de inicio de sesión',
        description: error.message || 'Credenciales incorrectas.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center p-4 md:p-8">
      <div className="absolute inset-0 -z-10">
        <div className="absolute left-[-12rem] top-[-12rem] h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute right-[-10rem] bottom-[-10rem] h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
      </div>

      <div className="grid w-full max-w-5xl overflow-hidden rounded-2xl border border-border/70 bg-card/85 shadow-2xl shadow-black/20 backdrop-blur-xl md:grid-cols-2">
        <section className="hidden md:flex flex-col justify-between border-r border-border/70 bg-gradient-to-br from-primary/25 via-primary/10 to-transparent p-10">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-primary/40 bg-primary/20 p-2">
              <Cpu className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-headline text-xl font-bold">Cabine Grid</p>
              <p className="text-sm text-muted-foreground">Control de cabinas en tiempo real</p>
            </div>
          </div>
          <div className="space-y-3">
            <p className="font-headline text-3xl leading-tight">
              Opera tu local con una experiencia moderna y clara.
            </p>
            <p className="text-sm text-muted-foreground">
              Administra sesiones, cobros y productos desde un panel optimizado para velocidad.
            </p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs text-accent">
            <Sparkles className="h-3.5 w-3.5" />
            Diseño renovado UX/UI
          </div>
        </section>

        <section className="p-6 sm:p-8 md:p-10">
          <div className="mb-6 md:hidden flex items-center justify-center gap-2">
            <Cpu className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-headline font-bold">Cabine Grid</h1>
          </div>

          <h2 className="text-2xl font-headline font-bold">Iniciar sesión</h2>
          <p className="mt-1 mb-6 text-sm text-muted-foreground">
            Ingresa tus credenciales para acceder al panel de operaciones.
          </p>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="text-left">
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="admin@cabinegrid.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem className="text-left">
                    <FormLabel>Contraseña</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isLoading} className="mt-2 w-full h-11 font-semibold">
                {isLoading ? 'Ingresando...' : <><LogIn className="mr-2 h-4 w-4" />Ingresar</>}
              </Button>
            </form>
          </Form>
          <p className="text-xs text-muted-foreground mt-6">
            © {new Date().getFullYear()} Cabine Grid. Todos los derechos reservados.
          </p>
        </section>
      </div>
    </main>
  );
}
