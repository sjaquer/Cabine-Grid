import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format as formatDateFns } from "date-fns"
import type { Timestamp } from "firebase/firestore";


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function calculateCost(minutesUsed: number, pricePerHour: number, roundToNearestQuarterHour: boolean = false): number {
  if (minutesUsed <= 0) return 0;
  
  if (roundToNearestQuarterHour) {
      const quarterHours = Math.ceil(minutesUsed / 15);
      return (quarterHours * pricePerHour) / 4;
  }

  // Original logic: round up to the nearest hour
  // This is very punitive for short times.
  // Let's change to charge per minute.
  const pricePerMinute = pricePerHour / 60;
  // Let's round the final cost to the nearest 10 cents.
  const totalCost = minutesUsed * pricePerMinute;
  return Math.ceil(totalCost * 10) / 10;
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

export function formatDateTime(timestamp: number | Date | Timestamp): string {
  const date = timestamp instanceof Date 
    ? timestamp 
    : typeof timestamp === 'number' 
      ? new Date(timestamp) 
      : (timestamp as Timestamp).toDate();
  return formatDateFns(date, 'HH:mm');
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
