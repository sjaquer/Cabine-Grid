"use client";

import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { collection, getDocs } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import type { Station, Product } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { Cpu, ShoppingBag, User, PlusCircle, Search } from "lucide-react";
import { useRouter } from "next/navigation";

interface CommandPaletteProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CommandPalette({ isOpen, onOpenChange }: CommandPaletteProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [stations, setStations] = useState<Station[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const firestore = useFirestore();
  const router = useRouter();

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      return;
    }

    const loadData = async () => {
      try {
        const stationsSnap = await getDocs(collection(firestore, "stations"));
        const productsSnap = await getDocs(collection(firestore, "products"));
        
        setStations(stationsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Station)));
        setProducts(productsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
      } catch (e) {
        console.error("Error loading command palette data:", e);
      }
    };
    void loadData();
  }, [isOpen, firestore]);

  // Opciones de Comandos
  const options = useMemo(() => {
    const queryStr = searchQuery.toLowerCase().trim();
    const result: Array<{
      label: string;
      icon: any;
      category: string;
      action: () => void;
    }> = [];

    // 1. Acciones generales
    const generalActions = [
      { label: "Asignar PC / Consola", icon: PlusCircle, category: "Acciones", action: () => { router.push("/"); onOpenChange(false); } },
      { label: "Ver CRM Clientes", icon: User, category: "Acciones", action: () => { router.push("/clientes"); onOpenChange(false); } },
      { label: "Ver Inventario", icon: ShoppingBag, category: "Acciones", action: () => { router.push("/inventario"); onOpenChange(false); } },
    ];

    generalActions.forEach(act => {
      if (act.label.toLowerCase().includes(queryStr)) {
        result.push(act);
      }
    });

    // 2. Opciones de estaciones (Si escribe '12' o 'PC 12')
    stations.forEach(station => {
      const nameMatch = station.name.toLowerCase().includes(queryStr);
      const numberMatch = searchQuery && !isNaN(Number(searchQuery)) && station.name.includes(searchQuery);
      
      if (nameMatch || numberMatch) {
        result.push({
          label: `Gestionar ${station.name} (${station.status === 'occupied' ? 'Ocupado' : 'Libre'})`,
          icon: Cpu,
          category: "Estaciones",
          action: () => {
            router.push(`/?stationId=${station.id}`);
            onOpenChange(false);
          }
        });
      }
    });

    // 3. Productos
    products.forEach(prod => {
      if (prod.name.toLowerCase().includes(queryStr)) {
        result.push({
          label: `Añadir ${prod.name} - ${formatCurrency(prod.price)}`,
          icon: ShoppingBag,
          category: "Productos",
          action: () => {
            router.push(`/?addProd=${prod.id}`);
            onOpenChange(false);
          }
        });
      }
    });

    return result;
  }, [searchQuery, stations, products, router, onOpenChange]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey && e.key.toLowerCase() === "k") || e.key === "F1") {
        e.preventDefault();
        onOpenChange(!isOpen);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onOpenChange]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 overflow-hidden max-w-lg border-slate-800 bg-slate-950 text-slate-50 top-[20%] translate-y-0 shadow-2xl shadow-slate-950/80">
        <DialogHeader className="p-4 border-b border-slate-800 flex flex-row items-center gap-3">
          <Search className="w-5 h-5 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Escribe un comando, número de PC, o snack..."
            className="border-none bg-transparent text-slate-50 focus-visible:ring-0 text-base p-0 h-auto"
            autoFocus
          />
        </DialogHeader>
        <div className="max-h-[300px] overflow-y-auto p-2">
          {options.length === 0 ? (
            <div className="p-4 text-sm text-slate-400 text-center">
              No se encontraron coincidencias
            </div>
          ) : (
            <div className="space-y-2">
              {options.map((opt, idx) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={idx}
                    onClick={opt.action}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800/60 text-left transition-all group"
                  >
                    <div className="p-1.5 bg-slate-900 rounded-lg text-slate-400 group-hover:text-primary transition-colors">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-slate-200 group-hover:text-slate-50">{opt.label}</span>
                      <span className="text-[10px] text-slate-500 font-bold tracking-wider uppercase">{opt.category}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="p-2 bg-slate-900/40 border-t border-slate-900 flex items-center justify-between text-[10px] text-slate-500 px-4 py-2">
          <span>Presiona <kbd className="bg-slate-800 text-slate-300 px-1 rounded">↑↓</kbd> para navegar</span>
          <span><kbd className="bg-slate-800 text-slate-300 px-1 rounded font-bold">Esc</kbd> para salir</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
