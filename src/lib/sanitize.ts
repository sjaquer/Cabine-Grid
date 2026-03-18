/**
 * Sanitiza un string para prevenir XSS
 * Versión ligera que ya no depende de dompurify
 */
export function sanitizeString(input: string | undefined | null): string {
  if (!input || typeof input !== "string") {
    return "";
  }
  
  // Reemplazo básico de caracteres sensibles sin usar DOMPurify para mayor rapidez
  const clean = input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  
  return clean;
}

/**
 * Sanitiza un objeto de tipo string recursivamente
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  if (!obj || typeof obj !== "object") {
    return obj;
  }

  const sanitized = { ...obj };
  
  for (const [key, value] of Object.entries(sanitized)) {
    if (typeof value === "string") {
      (sanitized as any)[key] = sanitizeString(value);
    } else if (typeof value === "object" && value !== null) {
      (sanitized as any)[key] = sanitizeObject(value);
    }
  }

  return sanitized;
}
