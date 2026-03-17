"use client";

import { useState } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useFirebaseAuthInstance, useAuth } from '@/firebase';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Cpu, LogIn } from 'lucide-react';
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

  if (user) {
    router.push('/');
    return null; 
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-secondary p-4">
      <div className="w-full max-w-sm text-center">
        <div className="flex justify-center items-center gap-2 mb-6">
            <Cpu className="h-10 w-10 text-primary" />
            <h1 className="text-3xl font-headline font-bold">CyberGrid Console</h1>
        </div>
        
        <div className="bg-card p-6 sm:p-8 rounded-lg shadow-md border">
            <h2 className="text-xl font-semibold mb-1">Inicio de Sesión</h2>
            <p className="text-muted-foreground mb-6 text-sm">Ingrese sus credenciales para acceder al panel.</p>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                 <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                        <FormItem className="text-left">
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                                <Input type="email" placeholder="admin@cybergrid.com" {...field} />
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
                <Button type="submit" disabled={isLoading} className="w-full">
                  {isLoading ? 'Ingresando...' : <> <LogIn className="mr-2 h-4 w-4"/> Ingresar</>}
                </Button>
              </form>
            </Form>
        </div>
        <p className="text-xs text-muted-foreground mt-6">
            © {new Date().getFullYear()} CyberGrid Console. Todos los derechos reservados.
        </p>
      </div>
    </main>
  );
}
