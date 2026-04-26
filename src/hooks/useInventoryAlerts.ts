'use client';

import { useMemo } from 'react';
import type { Inventory } from '@/lib/types';

export interface StockAlert {
  productId: string;
  productName: string;
  currentStock: number;
  minStock: number;
  reorderPoint?: number;
  severity: 'critical' | 'warning' | 'low';
}

/**
 * Hook to detect inventory items that need attention
 * 
 * Severity levels:
 * - critical: stock at 0
 * - warning: stock below minStock
 * - low: stock below reorderPoint
 * 
 * @param inventoryItems Array of inventory items from Firestore
 * @returns Array of alerts sorted by severity
 */
export function useInventoryAlerts(inventoryItems: Inventory[]): StockAlert[] {
  return useMemo(() => {
    const alerts: StockAlert[] = [];

    inventoryItems.forEach((item) => {
      const minStock = item.minStock ?? 0;
      const reorderPoint = item.reorderPoint ?? minStock;

      let severity: 'critical' | 'warning' | 'low' = 'low';

      if (item.currentStock === 0) {
        severity = 'critical';
      } else if (item.currentStock < minStock) {
        severity = 'warning';
      } else if (item.currentStock < reorderPoint) {
        severity = 'low';
      }

      // Only include items that need attention
      if (severity !== 'low' || item.currentStock < reorderPoint) {
        alerts.push({
          productId: item.productId,
          productName: item.productName,
          currentStock: item.currentStock,
          minStock,
          reorderPoint,
          severity,
        });
      }
    });

    // Sort by severity: critical first, then warning, then low
    const severityOrder = { critical: 0, warning: 1, low: 2 };
    return alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  }, [inventoryItems]);
}

/**
 * Hook to get summary statistics for inventory health
 */
export function useInventorySummary(inventoryItems: Inventory[]): {
  totalProducts: number;
  lowStockCount: number;
  outOfStockCount: number;
  healthPercentage: number; // % of items with adequate stock
} {
  return useMemo(() => {
    const totalProducts = inventoryItems.length;
    const outOfStockCount = inventoryItems.filter((i) => i.currentStock === 0).length;
    const lowStockCount = inventoryItems.filter(
      (i) => i.currentStock > 0 && i.currentStock < (i.minStock ?? 0),
    ).length;

    const healthyItems = totalProducts - outOfStockCount - lowStockCount;
    const healthPercentage = totalProducts > 0 ? Math.round((healthyItems / totalProducts) * 100) : 0;

    return {
      totalProducts,
      lowStockCount,
      outOfStockCount,
      healthPercentage,
    };
  }, [inventoryItems]);
}
