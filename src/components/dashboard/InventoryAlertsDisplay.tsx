'use client';

import { AlertCircle, AlertTriangle, Package } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import type { StockAlert } from '@/hooks/useInventoryAlerts';

interface InventoryAlertsDisplayProps {
  alerts: StockAlert[];
  maxDisplay?: number;
}

const severityConfig = {
  critical: {
    icon: AlertCircle,
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
    borderColor: 'border-destructive/30',
    label: 'Sin stock',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
    label: 'Stock bajo',
  },
  low: {
    icon: Package,
    color: 'text-blue-600',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    label: 'Reorden pronto',
  },
};

export default function InventoryAlertsDisplay({
  alerts,
  maxDisplay = 5,
}: InventoryAlertsDisplayProps) {
  if (alerts.length === 0) {
    return null;
  }

  const displayedAlerts = alerts.slice(0, maxDisplay);
  const hiddenCount = Math.max(0, alerts.length - maxDisplay);

  return (
    <Alert className={`${severityConfig[displayedAlerts[0]?.severity || 'low'].bgColor} border ${severityConfig[displayedAlerts[0]?.severity || 'low'].borderColor}`}>
      <AlertCircle className={`h-4 w-4 ${severityConfig[displayedAlerts[0]?.severity || 'low'].color}`} />
      <AlertTitle>Alertas de Inventario</AlertTitle>
      <AlertDescription>
        <div className="space-y-2 mt-2">
          {displayedAlerts.map((alert) => {
            const config = severityConfig[alert.severity];
            return (
              <div
                key={alert.productId}
                className="flex items-center justify-between p-2 rounded-md bg-background/40 border border-border/20"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{alert.productName}</p>
                  <p className="text-xs text-muted-foreground">
                    Stock: {alert.currentStock} {alert.minStock > 0 && `(mínimo: ${alert.minStock})`}
                  </p>
                </div>
                <Badge
                  variant="secondary"
                  className={`${config.color} ml-2 flex-shrink-0`}
                >
                  {config.label}
                </Badge>
              </div>
            );
          })}
          {hiddenCount > 0 && (
            <p className="text-xs text-muted-foreground pt-2 border-t border-border/20">
              +{hiddenCount} alerta{hiddenCount > 1 ? 's' : ''} más
            </p>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
