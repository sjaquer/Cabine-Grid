"use client";

export const dynamic = 'force-dynamic';

import { useMemo, useState } from "react";
import { useAuth, useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import RoleGuard from "@/components/auth/RoleGuard";
import type { Customer, Sale } from "@/lib/types";
import { collection, query } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Home, Search, UserRound, Trophy, Gamepad2, CalendarDays, Clock, HardDrive } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";

const weekdayLabels = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];

export default function ClientesPage() {
  const firestore = useFirestore();
  const { userProfile } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGamer, setSelectedGamer] = useState<Customer | null>(null);

  const customersQuery = useMemoFirebase(() => query(collection(firestore, "customers")), [firestore]);
  const { data: customersData } = useCollection<Omit<Customer, "id">>(customersQuery);

  const customers = useMemo(() => (customersData ?? []) as Customer[], [customersData]);

  const filteredCustomers = useMemo(() => {
    const needle = searchTerm.toLowerCase().trim();
    if (!needle) return customers;

    return customers.filter((customer) => {
      const name = customer.fullName?.toLowerCase() || "";
      const code = customer.customerCode?.toLowerCase() || "";
      return name.includes(needle) || code.includes(needle);
    });
  }, [customers, searchTerm]);

  // Calculate helper stats for Gamer Profile
  const getTopStat = (map?: Record<string, number>) => {
    if (!map) return "N/A";
    let bestKey = "N/A";
    let bestValue = -1;
    Object.entries(map).forEach(([key, value]) => {
      if (value > bestValue) {
        bestKey = key;
        bestValue = value;
      }
    });
    return bestKey;
  };

  return (
    <RoleGuard>
      <div className="app-shell app-enter">
        {/* Header */}
        <header className="app-sticky-header">
          <div className="app-container">
            <div className="app-header-row">
              <div className="flex items-center gap-3">
                <div className="brand-chip">
                  <div className="brand-chip-icon">
                    <UserRound className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <span className="font-headline font-bold text-lg">Mini-CRM</span>
                </div>
                <div className="hidden lg:block h-6 w-px bg-border/50"></div>
                <div className="flex flex-col gap-0.5">
                  <h1 className="text-xl font-headline font-bold">Clientes</h1>
                  <p className="text-xs text-muted-foreground">Estrategia de fidelización de jugadores</p>
                </div>
              </div>
              <div>
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
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5 text-primary" /> Búsqueda y Filtros
              </CardTitle>
              <CardDescription>Localiza perfiles mediante Alias o DNI</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por Alias, Nombre o DNI..."
                  className="pl-9"
                />
              </div>
              <Badge variant="secondary" className="h-9 font-mono text-sm px-3">
                Total: {filteredCustomers.length}
              </Badge>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gamepad2 className="w-5 h-5" /> Lista de Gamers
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredCustomers.length === 0 ? (
                <div className="py-12 text-center">
                  <UserRound className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No se encontraron clientes</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-border/50 rounded-lg">
                  <Table>
                    <TableHeader className="bg-background/50">
                      <TableRow className="border-border/50 hover:bg-background/50">
                        <TableHead>Nombre / Alias</TableHead>
                        <TableHead>Código / DNI</TableHead>
                        <TableHead className="text-right">Horas Jugadas</TableHead>
                        <TableHead className="text-right">Gasto Total</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCustomers.map((customer) => (
                        <TableRow key={customer.id} className="border-border/30 hover:bg-background/30 transition-colors">
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <span className="p-1.5 rounded-md bg-primary/10 text-primary">
                                <UserRound className="w-4 h-4" />
                              </span>
                              <span>{customer.fullName}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono">{customer.customerCode}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {(((customer.metrics?.totalMinutesRented ?? 0) / 60)).toFixed(1)} h
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(customer.metrics?.totalSpent ?? 0)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="secondary"
                              size="sm"
                              className="gap-1.5"
                              onClick={() => setSelectedGamer(customer)}
                            >
                              <Trophy className="w-3.5 h-3.5 text-amber-500" />
                              Perfil Gamer
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </main>

        {/* MODAL PERFIL DEL GAMER */}
        <Dialog open={!!selectedGamer} onOpenChange={(open) => !open && setSelectedGamer(null)}>
          <DialogContent className="max-w-lg bg-background/95 border border-border/50 backdrop-blur-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Trophy className="w-6 h-6 text-amber-500 animate-pulse" /> Perfil del Gamer
              </DialogTitle>
              <DialogDescription>Analítica y preferencias de fidelización.</DialogDescription>
            </DialogHeader>

            {selectedGamer && (
              <div className="space-y-6 py-4">
                <div className="flex items-center gap-4 p-4 bg-primary/5 border border-primary/20 rounded-xl">
                  <div className="h-14 w-14 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                    <UserRound className="w-7 h-7" />
                  </div>
                  <div>
                    <h2 className="font-headline font-bold text-lg leading-tight">{selectedGamer.fullName}</h2>
                    <p className="text-xs font-mono text-muted-foreground mt-0.5">Código: {selectedGamer.customerCode}</p>
                    {selectedGamer.email && <p className="text-xs text-muted-foreground mt-1">{selectedGamer.email}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Card className="border-border/30">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="p-2 rounded-md bg-primary/10 text-primary">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-2xs text-muted-foreground uppercase tracking-wider">Tiempo total</p>
                        <p className="text-sm font-bold font-mono">
                          {(((selectedGamer.metrics?.totalMinutesRented ?? 0) / 60)).toFixed(1)} h
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="border-border/30">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="p-2 rounded-md bg-primary/10 text-primary">
                        <Trophy className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-2xs text-muted-foreground uppercase tracking-wider">Gasto total</p>
                        <p className="text-sm font-bold font-mono">
                          {formatCurrency(selectedGamer.metrics?.totalSpent ?? 0)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-bold flex items-center gap-2 px-1">
                    <Gamepad2 className="w-4 h-4 text-primary" /> Hábitos del Jugador
                  </h3>
                  
                  <div className="grid grid-cols-1 gap-2">
                    <div className="flex items-center justify-between p-2.5 bg-card border border-border/30 rounded-md text-sm">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <HardDrive className="w-3.5 h-3.5" /> Máquina Frecuente
                      </span>
                      <span className="font-bold font-mono">{getTopStat(selectedGamer.metrics?.machineUsage)}</span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 bg-card border border-border/30 rounded-md text-sm">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <CalendarDays className="w-3.5 h-3.5" /> Día Preferido
                      </span>
                      <span className="font-bold">
                        {(() => {
                          const day = getTopStat(selectedGamer.metrics?.visitsByWeekday);
                          return day !== "N/A" ? weekdayLabels[Number(day)] : "N/A";
                        })()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 bg-card border border-border/30 rounded-md text-sm">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5" /> Hora Frecuente
                      </span>
                      <span className="font-bold font-mono">
                        {(() => {
                          const hour = getTopStat(selectedGamer.metrics?.visitHours);
                          return hour !== "N/A" ? `${String(Number(hour)).padStart(2, "0")}:00` : "N/A";
                        })()}
                      </span>
                    </div>
                  </div>
                </div>

                {selectedGamer.favoriteGames && selectedGamer.favoriteGames.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground px-1">Juegos Favoritos:</p>
                    <div className="flex flex-wrap gap-1.5 px-1">
                      {selectedGamer.favoriteGames.map((game, idx) => (
                        <Badge key={idx} variant="secondary">{game}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </RoleGuard>
  );
}
