"use client";

import type { Location } from "@/lib/types";
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
import { MapPin, Phone } from "lucide-react";

type LocationManagerProps = {
  locations: Location[];
  onAdd: (location: Omit<Location, 'id' | 'createdAt'>) => Promise<void>;
  onEdit: (id: string, location: Partial<Location>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

export default function LocationManager({
  locations,
}: LocationManagerProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Gestión de Locales</CardTitle>
          <CardDescription>Acceso bloqueado a local único principal</CardDescription>
        </div>
      </CardHeader>

      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Dirección</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Prórroga</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {locations.map((location) => (
              <TableRow key={location.id}>
                <TableCell className="font-medium">{location.name}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    {location.address}
                  </div>
                </TableCell>
                <TableCell>
                  {location.phone ? (
                    <div className="flex items-center gap-1">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      {location.phone}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>{location.fractionMinutes || 5} min</TableCell>
                <TableCell>
                  <Badge variant={location.isActive ? "default" : "secondary"}>
                    {location.isActive ? "Activo" : "Inactivo"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
