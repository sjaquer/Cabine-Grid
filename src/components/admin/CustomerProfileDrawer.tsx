"use client";

import React, { useEffect, useState } from "react";
import type { Customer } from "@/lib/types";
import { useAuth, useFirestore } from "@/firebase";
import { doc, updateDoc, serverTimestamp, collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { logAuditAction } from "@/lib/audit-log";
import { formatCurrency } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Trophy, Clock, HardDrive, CalendarDays, Gamepad2, ShieldAlert, Save } from "lucide-react";

interface CustomerProfileDrawerProps {
  customer: Customer | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

export function CustomerProfileDrawer({
  customer,
  isOpen,
  onClose,
  onUpdated
}: CustomerProfileDrawerProps) {
  const firestore = useFirestore();
  const { user, userProfile } = useAuth();

  // Form fields
  const [dni, setDni] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [favoriteGamesText, setFavoriteGamesText] = useState("");
  const [notes, setNotes] = useState("");
  
  const [isSaving, setIsSaving] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  useEffect(() => {
    if (customer && isOpen) {
      setDni(customer.dni || "");
      setWhatsapp(customer.whatsapp || "");
      setFavoriteGamesText((customer.favoriteGames || []).join(", "));
      setNotes(customer.notes || "");

      if (userProfile?.role === "admin") {
        fetchAuditLogs(customer.id);
      }
    }
  }, [customer, isOpen, userProfile]);

  const fetchAuditLogs = async (customerId: string) => {
    try {
      const logsRef = collection(firestore, "auditLogs");
      const q = query(
        logsRef,
        where("targetId", "==", customerId),
        orderBy("createdAtMs", "desc"),
        limit(15)
      );
      const snapshot = await getDocs(q);
      const logs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAuditLogs(logs);
    } catch (e) {
      console.error("Error al cargar auditorías:", e);
    }
  };

  if (!customer) return null;

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const loyaltyColors = {
    gold: "text-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.2)]",
    silver: "text-zinc-400",
    bronze: "text-orange-600"
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const games = favoriteGamesText
        .split(",")
        .map((g) => g.trim())
        .filter(Boolean);

      const customerRef = doc(firestore, "customers", customer.id);
      
      // Build diff for logging
      const updates: any = {};
      const diffs: any = {};

      if (dni !== (customer.dni || "")) {
        updates.dni = dni;
        diffs.dni = { from: customer.dni || "", to: dni };
      }
      if (whatsapp !== (customer.whatsapp || "")) {
        updates.whatsapp = whatsapp;
        diffs.whatsapp = { from: customer.whatsapp || "", to: whatsapp };
      }
      if (JSON.stringify(games) !== JSON.stringify(customer.favoriteGames || [])) {
        updates.favoriteGames = games;
        diffs.favoriteGames = { from: customer.favoriteGames || [], to: games };
      }
      if (notes !== (customer.notes || "")) {
        updates.notes = notes;
        diffs.notes = { from: customer.notes || "", to: notes };
      }

      if (Object.keys(updates).length > 0) {
        await updateDoc(customerRef, {
          ...updates,
          updatedAt: serverTimestamp()
        });

        // Log audit
        await logAuditAction(firestore, {
          action: "update_customer_crm",
          target: "customers",
          targetId: customer.id,
          details: {
            customerAlias: customer.fullName,
            ...diffs
          },
          actor: {
            id: user?.uid || null,
            email: user?.email || null,
            role: userProfile?.role || null
          }
        });

        if (onUpdated) onUpdated();
      }
      onClose();
    } catch (error) {
      console.error("Falla al guardar CRM:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-md bg-zinc-950 border-l border-zinc-800/50 overflow-y-auto text-zinc-100 p-6">
        <SheetHeader className="text-left pb-4 border-b border-zinc-900">
          <SheetTitle className="flex items-center gap-2 text-xl font-headline font-bold">
            <Gamepad2 className="w-6 h-6 text-primary" /> Ficha de Jugador
          </SheetTitle>
          <SheetDescription className="text-xs text-zinc-400">
            Estadísticas avanzadas y CRM operativo.
          </SheetDescription>
        </SheetHeader>

        {/* Player Card visual */}
        <div className="mt-6 flex items-center gap-4 p-4 bg-zinc-900/40 border border-zinc-800/60 rounded-xl">
          <div className="h-14 w-14 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold font-headline text-lg">
            {getInitials(customer.fullName)}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-headline font-bold text-lg leading-tight truncate">
              {customer.fullName}
            </h2>
            <p className="text-xs font-mono text-zinc-400 mt-0.5">ID: {customer.customerCode}</p>
            
            {/* Loyalty level */}
            <Badge 
              variant="outline" 
              className={`text-xs font-bold tracking-wider uppercase mt-2 bg-zinc-950 ${loyaltyColors[customer.loyaltyLevel || 'bronze']}`}
            >
              Tier: {customer.loyaltyLevel || 'bronze'}
            </Badge>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-3 mt-6">
          <Card className="border-zinc-800/50 bg-zinc-900/20">
            <CardContent className="p-3 flex items-center gap-3">
              <Clock className="w-5 h-5 text-primary/70" />
              <div>
                <p className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold">Horas Jugadas</p>
                <p className="text-sm font-bold font-mono">
                  {(((customer.metrics?.totalMinutesRented ?? 0) / 60)).toFixed(1)} h
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-zinc-800/50 bg-zinc-900/20">
            <CardContent className="p-3 flex items-center gap-3">
              <Trophy className="w-5 h-5 text-primary/70" />
              <div>
                <p className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold">Gasto Total</p>
                <p className="text-sm font-bold font-mono">
                  {formatCurrency(customer.totalSpent ?? customer.metrics?.totalSpent ?? 0)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Form Fields */}
        <div className="space-y-4 mt-6 pt-4 border-t border-zinc-900">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-zinc-400 font-semibold">DNI (Legal)</Label>
              <Input
                value={dni}
                onChange={(e) => setDni(e.target.value)}
                placeholder="DNI"
                className="h-9 bg-zinc-900/50 border-zinc-800 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-zinc-400 font-semibold">WhatsApp</Label>
              <Input
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="+51 900 123 456"
                className="h-9 bg-zinc-900/50 border-zinc-800 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-zinc-400 font-semibold">Juegos Favoritos (Separados por coma)</Label>
            <Input
              value={favoriteGamesText}
              onChange={(e) => setFavoriteGamesText(e.target.value)}
              placeholder="Valorant, Dota 2, CS:GO"
              className="h-9 bg-zinc-900/50 border-zinc-800 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-zinc-400 font-semibold">Notas del Staff (Uso Interno)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Comportamiento, preferencias de PC, etc..."
              className="bg-zinc-900/50 border-zinc-800 text-xs resize-none min-h-[60px]"
            />
          </div>

          <Button 
            onClick={handleSave} 
            disabled={isSaving}
            className="w-full h-9 gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
          >
            <Save className="w-4 h-4" /> {isSaving ? "Guardando..." : "Guardar Cambios CRM"}
          </Button>
        </div>

        {/* Audit Logs (Only for admin) */}
        {userProfile?.role === "admin" && (
          <div className="space-y-3 mt-8 pt-4 border-t border-zinc-900">
            <h3 className="text-xs font-bold flex items-center gap-2 text-red-400">
              <ShieldAlert className="w-4 h-4" /> Historial de Auditoría
            </h3>
            <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
              {auditLogs.length === 0 ? (
                <p className="text-[10px] text-zinc-600 italic">Sin registros de cambios.</p>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="p-2 bg-zinc-950 border border-zinc-900 rounded text-[10px] leading-relaxed">
                    <span className="text-zinc-500 font-mono">
                      {log.createdAtMs ? new Date(log.createdAtMs).toLocaleDateString("es-PE") : "-"}
                    </span>
                    <span className="text-amber-400 font-semibold ml-1">
                      [{log.actor?.email?.split("@")[0] || "Staff"}]
                    </span>
                    <span className="text-zinc-300 ml-1">editó</span>
                    <div className="text-zinc-400 mt-1 font-mono text-[9px]">
                      {JSON.stringify(log.details || {})}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
