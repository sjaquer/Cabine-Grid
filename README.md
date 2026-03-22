# Cabine Grid

Cabine Grid es una aplicacion web privada para gestionar un negocio de cabinas de internet con ventas de productos, control de inventario, arqueo de caja y auditoria operativa.

## Objetivo del Sistema

- Gestion de cabinas en tiempo real (asignar, monitorear, cobrar)
- Punto de venta (TPV/POS) integrado por sesion
- Control de inventario por local con movimientos de stock
- Cierre de turno con validaciones y trazabilidad
- Reportes y auditoria para administracion

## Stack Tecnologico

- Next.js 15 + React 19 + TypeScript
- Firebase Auth + Firestore
- Tailwind + componentes UI reutilizables
- Reglas de seguridad Firestore por rol y local

## Estructura Principal

- `src/app/` rutas de la aplicacion
- `src/components/dashboard/` operacion diaria (cabinas, TPV, cobro)
- `src/components/admin/` gestion administrativa
- `src/firebase/` proveedor Firebase y contexto de autenticacion
- `src/lib/` logica de negocio (cierres, costos, auditoria, reportes)
- `firestore.rules` politicas de acceso a datos
- `next.config.ts` configuracion de build, headers y hardening HTTP

## Requisitos

- Node.js 20+
- npm 10+
- Proyecto Firebase con Auth + Firestore habilitado

## Variables de Entorno

Configura un archivo `.env.local` con:

```bash
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
```

Notas:

- Las variables `NEXT_PUBLIC_*` son usadas por el SDK cliente de Firebase.
- La seguridad real depende de `firestore.rules` y de los permisos de Firebase Auth.

## Instalacion y Ejecucion

```bash
npm install
npm run dev
```

Scripts utiles:

```bash
npm run dev
npm run typecheck
npm run lint
npm run build
npm run start
```

## Roles y Accesos

Roles soportados:

- `admin`
- `manager`
- `operator`
- `view-only`

Reglas generales:

- `admin/manager`: gestion global
- `operator`: operacion diaria y acceso por local asignado
- `view-only`: solo lectura segun reglas

## Modelo Operativo (Resumen)

1. Asignar sesion a cabina
2. Registrar productos consumidos en TPV
3. Cobrar y cerrar sesion con transaccion atomica

El cierre de sesion registra:

- venta
- rebaja de inventario
- movimiento de stock
- liberacion de cabina

## Seguridad y Privacidad (Modo App Privada)

El proyecto esta configurado para minimizar descubrimiento publico:

- `public/robots.txt` con `Disallow: /`
- metadata global con `robots: noindex, nofollow`
- header `X-Robots-Tag` global noindex/nofollow/noarchive
- headers de hardening HTTP (frame, sniffing, referrer, permissions)

Importante:

- Noindex reduce indexacion en buscadores, pero no reemplaza autenticacion.
- Para acceso realmente privado: limitar acceso por red, dominios internos y controles de identidad fuertes.

## Despliegue Recomendado (Privado)

1. Publicar solo en dominio controlado
2. Restringir usuarios autorizados en Firebase Auth
3. Aplicar reglas Firestore en produccion
4. Deshabilitar cuentas inactivas
5. Revisar logs de auditoria regularmente

## Checklist de Hardening

- [x] Reglas Firestore por rol
- [x] Controles por local para colecciones operativas
- [x] Noindex global en metadata + headers + robots
- [x] Bloqueo de iframe (clickjacking)
- [x] `X-Content-Type-Options: nosniff`
- [x] `Referrer-Policy: no-referrer`
- [x] Build con typecheck/lint habilitado

Recomendaciones adicionales:

- Habilitar MFA para cuentas admin/manager
- Configurar alertas de seguridad en Firebase
- Rotar claves y credenciales operativas periodicamente
- Implementar monitoreo de intentos de acceso inusual

## Troubleshooting Rapido

### Error en transacciones Firestore

Si aparece `Firestore transactions require all reads to be executed before all writes`, revisar que dentro de cada transaccion todas las lecturas ocurran antes de cualquier escritura.

### Sesiones que no cierran correctamente

- Verificar permisos del rol
- Validar `firestore.rules` desplegadas
- Revisar logs de auditoria para errores de cierre

## Estado del Proyecto

Cabine Grid esta orientado a uso interno/privado para operacion de negocio y no como sitio publico indexable.
