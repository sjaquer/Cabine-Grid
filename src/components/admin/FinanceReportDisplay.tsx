"use client";

import { useMemo } from "react";
import { AlertTriangle, TrendingUp, Target, BarChart3 } from "lucide-react";

type Section = {
  title: string;
  items: string[];
};

function parseReport(text: string): Section[] {
  const sections: Section[] = [];
  const lines = text.split("\n").filter((line) => line.trim());

  let currentSection: Section | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Detecta secciones numeradas (1) Title, 2) Title, etc.)
    const sectionMatch = trimmed.match(/^(\d+)\)\s*([^:]+)(?::\s*(.*))?$/);
    if (sectionMatch) {
      if (currentSection) {
        sections.push(currentSection);
      }
      currentSection = {
        title: sectionMatch[2].trim(),
        items: sectionMatch[3] ? [sectionMatch[3].trim()] : [],
      };
    } else if (currentSection && trimmed.startsWith("-")) {
      // Items con guión
      currentSection.items.push(trimmed.substring(1).trim());
    } else if (currentSection && trimmed.startsWith("•")) {
      // Items con bullet
      currentSection.items.push(trimmed.substring(1).trim());
    } else if (currentSection && trimmed && !trimmed.match(/^(\d+)\)/)) {
      // Líneas adicionales de descripción
      if (currentSection.items.length === 0) {
        currentSection.items.push(trimmed);
      } else {
        // Agregar al último item
        currentSection.items[currentSection.items.length - 1] += " " + trimmed;
      }
    }
  }

  if (currentSection) {
    sections.push(currentSection);
  }

  return sections;
}

function getSectionIcon(title: string): React.ReactNode {
  const lower = title.toLowerCase();
  if (lower.includes("resumen") || lower.includes("ejecutivo")) {
    return <BarChart3 className="w-5 h-5" />;
  }
  if (lower.includes("tendencia") || lower.includes("variacion")) {
    return <TrendingUp className="w-5 h-5" />;
  }
  if (lower.includes("riesgo")) {
    return <AlertTriangle className="w-5 h-5" />;
  }
  if (lower.includes("recomendacion")) {
    return <Target className="w-5 h-5" />;
  }
  return <BarChart3 className="w-5 h-5" />;
}

function getSectionColor(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes("riesgo")) {
    return "border-amber-200 bg-amber-50 dark:border-amber-900/30 dark:bg-amber-950/10";
  }
  if (lower.includes("recomendacion")) {
    return "border-blue-200 bg-blue-50 dark:border-blue-900/30 dark:bg-blue-950/10";
  }
  if (lower.includes("resumen") || lower.includes("ejecutivo")) {
    return "border-slate-200 bg-slate-50 dark:border-slate-800/30 dark:bg-slate-950/10";
  }
  return "border-green-200 bg-green-50 dark:border-green-900/30 dark:bg-green-950/10";
}

export function FinanceReportDisplay({ report }: { report: string }) {
  const sections = useMemo(() => parseReport(report), [report]);

  if (!report.trim()) {
    return null;
  }

  return (
    <div className="space-y-4">
      {sections.map((section, index) => (
        <div
          key={`section-${index}`}
          className={`rounded-lg border p-4 space-y-3 ${getSectionColor(section.title)}`}
        >
          <div className="flex items-center gap-2">
            <div className="text-foreground/70">
              {getSectionIcon(section.title)}
            </div>
            <h3 className="font-semibold text-sm text-foreground">
              {section.title}
            </h3>
          </div>

          {section.items.length > 0 && (
            <ul className="space-y-2">
              {section.items.map((item, itemIndex) => (
                <li key={`item-${index}-${itemIndex}`} className="text-xs text-foreground/70 leading-relaxed">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-foreground/40 mr-2" />
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
