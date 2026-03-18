import DOMPurify from "dompurify";

/**
 * Sanitiza un string para prevenir XSS
 * Elimina scripts y tags HTML peligrosos
 */
export function sanitizeString(input: string | undefined | null): string {
  if (!input || typeof input !== "string") {
    return "";
  }
  
  // Usar DOMPurify en modo text-only para mantener el contenido pero eliminar cualquier HTML/Script
  const clean = DOMPurify.sanitize(input, { 
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [] 
  });
  
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
