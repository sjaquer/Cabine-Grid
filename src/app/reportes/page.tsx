"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from "react";
import { useAuth, useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import RoleGuard from "@/components/auth/RoleGuard";
import type { Customer, Sale } from "@/lib/types";
import { collection, query, limit, orderBy } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";
import { Home, BarChart3, TrendingUp, Trophy, ShoppingBag, Users, Clock } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

export default function ReportesPage() {
  const firestore = useFirestore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const salesQuery = useMemoFirebase(() => query(collection(firestore, "sales"), limit(50)), [firestore]);
  const { data: salesData } = useCollection<Omit<Sale, "id">>(salesQuery);

  const customersQuery = useMemoFirebase(() => query(
    collection(firestore, "customers"),
    orderBy("metrics.totalSpent", "desc"),
    limit(10)
  ), [firestore]);
  const { data: customersData } = useCollection<Omit<Customer, "id">>(customersQuery);

  const sales = useMemo(() => (salesData ?? []) as Sale[], [salesData]);
  const customers = useMemo(() => (customersData ?? []) as Customer[], [customersData]);

  // 1. Mapa de calor de horas (0-23)
  const hourlyHeatmap = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({
      hour: `${String(i).padStart(2, "0")}:00`,
      ventas: 0,
    }));

    sales.forEach((sale) => {
      if (!sale.endTime) return;
      // Convert server Timestamp or standard Date
      const date = (sale.endTime as any).toDate ? (sale.endTime as any).toDate() : new Date((sale.endTime as any).seconds * 1000);
      const h = date.getHours();
      if (h >= 0 && h < 24) {
        hours[h].ventas += 1;
      }
    });

    return hours;
  }, [sales]);

  // 2. Top 10 Clientes del mes
  const topCustomers = useMemo(() => {
    return [...customers]
      .sort((a, b) => (b.metrics?.totalSpent ?? 0) - (a.metrics?.totalSpent ?? 0))
      .slice(0, 10)
      .map((c) => ({
        name: c.fullName,
        code: c.customerCode,
        totalSpent: c.metrics?.totalSpent ?? 0,
        sessions: c.metrics?.totalSessions ?? 0,
      }));
  }, [customers]);

  // 3. Top 5 Productos más vendidos
  const topProducts = useMemo(() => {
    const productCounts: Record<string, { name: string; qty: number }> = {};

    sales.forEach((sale) => {
      const sold = sale.soldProducts || [];
      sold.forEach((item) => {
        if (!productCounts[item.productId]) {
          productCounts[item.productId] = {
            name: item.productName || "Desconocido",
            qty: 0,
          };
        }
        productCounts[item.productId].qty += item.quantity;
      });
    });

    return Object.entries(productCounts)
      .map(([id, val]) => ({
        id,
        name: val.name,
        qty: val.qty,
      }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [sales]);

  // General stats
  const totalRevenue = useMemo(() => sales.reduce((acc, s) => acc + (s.amount || 0), 0), [sales]);
  const totalProductsSold = useMemo(() => {
    return sales.reduce((acc, s) => {
      const qty = (s.soldProducts || []).reduce((sum, p) => sum + p.quantity, 0);
      return acc + qty;
    }, 0);
  }, [sales]);

  if (!mounted) return null;

  return (
    <RoleGuard requiredRoles={["admin", "manager"]}>
      <div className="app-shell app-enter">
        {/* Header */}
        <header className="app-sticky-header">
          <div className="app-container">
            <div className="app-header-row">
              <div className="flex items-center gap-3">
                <div className="brand-chip">
                  <div className="brand-chip-icon">
                    <BarChart3 className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <span className="font-headline font-bold text-lg">Reportes</span>
                </div>
                <div className="hidden lg:block h-6 w-px bg-border/50"></div>
                <div className="flex flex-col gap-0.5">
                  <h1 className="text-xl font-headline font-bold">Analítica de Negocio</h1>
                  <p className="text-xs text-muted-foreground">Métricas y toma de decisiones</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" className="gap-2 h-9 text-muted-foreground hidden sm:flex pointer-events-none">
                  <Clock className="w-4 h-4" />
                  Últimos 30 días
                </Button>
                <Link href="/">
                  <Button variant="outline" size="sm" className="gap-2 h-9">
                    <Home className="w-4 h-4" />
                    Dashboard
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </header>

        <main className="app-container py-8 space-y-6">
          {/* Tarjetas de Resumen */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-card border-border shadow-sm bg-gradient-to-b from-primary/5 to-transparent">
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">INGRESOS TOTALES</CardTitle>
                <TrendingUp className="w-4 h-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black font-mono">{formatCurrency(totalRevenue)}</div>
                <p className="text-xs text-muted-foreground mt-1">Acumulado en auditoría</p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border shadow-sm">
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">PRODUCTOS VENDIDOS</CardTitle>
                <ShoppingBag className="w-4 h-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black font-mono">{totalProductsSold} pcs</div>
                <p className="text-xs text-muted-foreground mt-1">Movimientos totales del TPV</p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border shadow-sm">
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">CLIENTES REGISTRADOS</CardTitle>
                <Users className="w-4 h-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black font-mono">{customers.length}</div>
                <p className="text-xs text-muted-foreground mt-1">Base Mini-CRM activa</p>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico 1: Horas Frecuentes */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <Clock className="w-5 h-5 text-primary" /> Mapa de Calor por Horas
              </CardTitle>
              <CardDescription>Identifica los picos de demanda diaria en tu local</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourlyHeatmap}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                    <XAxis dataKey="hour" fontSize={11} tickLine={false} />
                    <YAxis allowDecimals={false} fontSize={11} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: "rgba(255, 255, 255, 0.05)" }}
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--foreground))" }}
                    />
                    <Bar dataKey="ventas" fill="#8884d8" radius={[4, 4, 0, 0]}>
                      {hourlyHeatmap.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.ventas > 5 ? "#ef4444" : entry.ventas > 2 ? "#f59e0b" : "#3b82f6"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gráfico 2: Top 10 Clientes */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Trophy className="w-5 h-5 text-amber-500" /> Top 10 Clientes
                </CardTitle>
                <CardDescription>Jugadores con mayor gasto acumulado</CardDescription>
              </CardHeader>
              <CardContent>
                {topCustomers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-10">Sin datos suficientes</p>
                ) : (
                  <div className="space-y-3">
                    {topCustomers.map((cust, idx) => (
                      <div key={cust.code} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/20">
                        <div className="flex items-center gap-3">
                          <Badge variant={idx === 0 ? "default" : "secondary"} className="font-bold h-6 w-6 flex items-center justify-center rounded-full p-0">
                            {idx + 1}
                          </Badge>
                          <div>
                            <div className="font-medium text-sm">{cust.name}</div>
                            <div className="text-xs text-muted-foreground font-mono">{cust.code}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-sm font-mono">{formatCurrency(cust.totalSpent)}</div>
                          <div className="text-xs text-muted-foreground">{cust.sessions} visitas</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Gráfico 3: Top 5 Productos */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShoppingBag className="w-5 h-5 text-emerald-500" /> Productos Más Vendidos
                </CardTitle>
                <CardDescription>Los 5 productos favoritos de tus clientes</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center min-h-[300px]">
                {topProducts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-10">Sin datos de ventas</p>
                ) : (
                  <div className="w-full h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topProducts} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                        <XAxis type="number" allowDecimals={false} fontSize={11} />
                        <YAxis type="category" dataKey="name" fontSize={11} width={100} />
                        <Tooltip
                          contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--foreground))" }}
                        />
                        <Bar dataKey="qty" radius={[0, 4, 4, 0]}>
                          {topProducts.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </RoleGuard>
  );
}
