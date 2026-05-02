import { NextResponse } from "next/server";
import { ai } from "@/ai/genkit";

type FinanceReportPayload = {
  filters: {
    startDate: string;
    endDate: string;
    locationId?: string;
    operatorId?: string;
    paymentMethod?: string;
  };
  totals: {
    revenue: number;
    grossRevenue: number;
    discounts: number;
    salesCount: number;
    avgTicket: number;
    estimatedMargin: number;
    estimatedMarginPercent: number;
  };
  forecast: {
    projectedRevenue: number;
    projectedSalesCount: number;
  };
  risk: {
    criticalOrHighCount: number;
    averageRisk: number;
    sample: Array<{
      action?: string;
      severity?: string;
      anomalyScore?: number;
      locationId?: string;
    }>;
  };
  topLocation: null | {
    locationId: string;
    revenue: number;
    salesCount: number;
    avgTicket: number;
    marginPercent: number;
  };
  topProducts: Array<{
    name: string;
    quantity: number;
    revenue: number;
    ratio: number;
  }>;
  operators: Array<{
    operatorId: string;
    operatorEmail: string;
    revenue: number;
    salesCount: number;
    avgAttentionMinutes: number;
    errorsCount: number;
    inconsistenciesCount: number;
  }>;
  closures: Array<{
    locationId: string;
    totalSales: number;
    expectedCash: number;
    countedCash: number;
    cashDifference: number;
    salesCount: number;
  }>;
  insightsSeed: Array<{
    title: string;
    detail: string;
    action: string;
    tone: string;
  }>;
};

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY no esta configurada." }, { status: 500 });
  }

  let payload: FinanceReportPayload;
  try {
    payload = await req.json();
  } catch (error) {
    return NextResponse.json({ error: "Solicitud invalida." }, { status: 400 });
  }

  const prompt = `Eres un analista financiero para un cyber cafe. Genera un reporte accionable en Espanol.

Reglas:
- No inventes datos.
- Usa SOLO los numeros provistos.
- Resumen conciso y util.
- Formato con secciones cortas y viñetas.

Datos:
${JSON.stringify(payload)}

Entrega este formato:
1) Resumen ejecutivo (2-3 bullets)
2) Tendencias y riesgo (2-4 bullets)
3) Proyeccion proxima hora (1-2 bullets)
4) Recomendaciones anti-merma (2-4 bullets)
5) Alertas de auditoria (1-3 bullets)
`;

  try {
    const result = await ai.generate({ prompt });
    const reportText = result.text || "";
    return NextResponse.json({ report: reportText });
  } catch (error) {
    console.error("AI report error:", error);
    return NextResponse.json({ error: "No se pudo generar el reporte IA." }, { status: 500 });
  }
}
