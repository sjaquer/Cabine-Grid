"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { UserProfile } from "@/lib/types";

type Approval = {
  id: string;
  type?: string;
  status?: "pending" | "approved" | "rejected";
  locationId?: string | null;
  requestedBy?: {
    email?: string | null;
    id?: string | null;
  };
  note?: string;
  createdAt?: unknown;
};

type SensitiveApprovalsManagerProps = {
  approvals: Approval[];
  userProfile: UserProfile | null;
  onApprove: (approvalId: string) => Promise<void>;
  onReject: (approvalId: string) => Promise<void>;
};

export default function SensitiveApprovalsManager({ approvals, userProfile, onApprove, onReject }: SensitiveApprovalsManagerProps) {
  const canReview = userProfile?.role === "admin";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Aprobaciones Sensibles</CardTitle>
        <CardDescription>
          Cambios de precio, ajustes grandes de inventario y correcciones quedan en cola para aprobación.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Solicitado por</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Nota</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {approvals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No hay solicitudes pendientes.
                  </TableCell>
                </TableRow>
              ) : (
                approvals.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.type || "-"}</TableCell>
                    <TableCell>{item.requestedBy?.email || "-"}</TableCell>
                    <TableCell>{item.locationId || "Global"}</TableCell>
                    <TableCell>
                      <Badge variant={item.status === "pending" ? "secondary" : "default"}>
                        {item.status || "pending"}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[280px] truncate">{item.note || "-"}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        size="sm"
                        onClick={() => onApprove(item.id)}
                        disabled={!canReview || item.status !== "pending"}
                      >
                        Aprobar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onReject(item.id)}
                        disabled={!canReview || item.status !== "pending"}
                      >
                        Rechazar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
