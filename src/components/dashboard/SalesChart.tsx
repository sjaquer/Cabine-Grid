"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import type { Sale } from "@/lib/types"
import { format, getHours } from "date-fns"
import type { Timestamp } from "firebase/firestore"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { formatCurrency } from "@/lib/utils"

type SalesChartProps = {
  sales: Sale[]
}

export default function SalesChart({ sales }: SalesChartProps) {
  const chartData = React.useMemo(() => {
    const hourlySales = Array.from({ length: 24 }, (_, i) => ({
      hour: format(new Date(0, 0, 0, i), "HH:mm"),
      total: 0,
    }));

    sales.forEach(sale => {
      const saleDate = (sale.endTime as Timestamp).toDate();
      const hour = getHours(saleDate);
      if (hourlySales[hour]) {
        hourlySales[hour].total += sale.amount;
      }
    });

    return hourlySales.filter(d => d.total > 0);
  }, [sales]);

  const chartConfig = {
    sales: {
      label: "Ventas",
      color: "hsl(var(--primary))",
    },
  }

  if (chartData.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ventas por Hora</CardTitle>
        <CardDescription>Análisis de las ventas a lo largo del día.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
          <BarChart accessibilityLayer data={chartData}>
             <CartesianGrid vertical={false} />
            <XAxis
              dataKey="hour"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
            />
             <YAxis
                tickFormatter={(value) => formatCurrency(Number(value))}
             />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent 
                formatter={(value) => formatCurrency(Number(value))}
                />}
            />
            <Bar dataKey="total" fill="var(--color-sales)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
