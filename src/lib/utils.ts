import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format as formatDateFns } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function calculateCost(minutesUsed: number, pricePerHour: number): number {
  if (minutesUsed <= 0) return 0;
  const hours = Math.ceil(minutesUsed / 60);
  return hours * pricePerHour;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
  }).format(amount);
}

export function formatTime(totalSeconds: number): string {
  if (totalSeconds < 0) totalSeconds = 0;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  return [hours, minutes, seconds]
    .map(v => String(v).padStart(2, '0'))
    .join(':');
}

export function formatDateTime(timestamp: number): string {
  return formatDateFns(new Date(timestamp), 'HH:mm');
}

export function formatDuration(minutes: number): string {
  if (minutes < 1) return "<1m";
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);
  let result = '';
  if (hours > 0) {
    result += `${hours}h `;
  }
  result += `${remainingMinutes}m`;
  return result.trim();
}
