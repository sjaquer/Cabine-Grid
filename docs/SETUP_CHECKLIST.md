# ✅ CHECKLIST DE CONFIGURACIÓN

## 🚀 ANTES DE USAR EN PRODUCCIÓN

### 1. Instalación y Configuración Base
- [ ] Instalar dependencias: `npm install`
- [ ] Crear archivo `.env.local` con variables de Firebase
- [ ] Configurar Firebase proyecto
- [ ] Ejecutar migraciones de Firestore (si aplica)

### 2. Integración Firebase
**Archivo**: `src/firebase/config.ts`
```typescript
// Verifica estas variables:
- NEXT_PUBLIC_FIREBASE_API_KEY
- NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
- NEXT_PUBLIC_FIREBASE_PROJECT_ID
- NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
- NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
- NEXT_PUBLIC_FIREBASE_APP_ID
```

- [ ] Variables de Firebase correctas
- [ ] Firestore habilitado
- [ ] Authentication habilitada
- [ ] Permisos de Firestore configurados

### 3. Conectar Managers a Firestore
Los siguientes archivos tienen handlers listos pero necesitan ser conectados a Firestore:

**MachineManager** (`src/components/admin/MachineManager.tsx`)
- [ ] `onAdd`: Implementar `addDoc` a collection `machines`
- [ ] `onEdit`: Implementar `updateDoc` 
- [ ] `onDelete`: Implementar `deleteDoc`
- [ ] `onToggleStatus`: Implementar cambio de estado

**LocationManager** (`src/components/admin/LocationManager.tsx`)
- [ ] `onAdd`: Implementar `addDoc` a collection `locations`
- [ ] `onEdit`: Implementar `updateDoc`
- [ ] `onDelete`: Implementar `deleteDoc`

**ProductManager** (`src/components/admin/ProductManager.tsx`)
- [ ] `onAdd`: Implementar `addDoc` a collection `products`
- [ ] `onEdit`: Implementar `updateDoc`
- [ ] `onDelete`: Implementar `deleteDoc`

**UserManager** (`src/components/admin/UserManager.tsx`)
- [ ] `onChangeRole`: Implementar cambio de rol en `users` collection
- [ ] `onDeactivate`: Implementar soft delete

### 4. Firestore Collections Setup
Crear las siguientes colecciones en Firestore:

#### Collection: `machines`
```javascript
{
  name: string,
  status: 'available' | 'occupied' | 'warning' | 'maintenance',
  rateId: string,
  locationId?: string,
  specs?: {
    processor?: string,
    ram?: string,
    storage?: string
  },
  session?: {
    id: string,
    client?: string,
    startTime: number,
    usageMode: 'free' | 'prepaid',
    rateId: string,
    prepaidHours?: number,
    userId?: string
  },
  createdAt?: timestamp
}
```

#### Collection: `locations`
```javascript
{
  name: string,
  address: string,
  phone?: string,
  isActive: boolean,
  createdAt: timestamp,
  updateAt?: timestamp
}
```

#### Collection: `products`
```javascript
{
  name: string,
  price: number,
  category: 'drink' | 'snack' | 'food' | 'other',
  description?: string,
  stock?: number,
  isActive?: boolean,
  createdAt?: timestamp
}
```

#### Collection: `users` (Actualizar estructura)
```javascript
{
  email: string,
  name?: string,
  role: 'admin' | 'manager' | 'operator' | 'view-only',
  locationIds?: string[],
  permissions?: string[],
  isActive?: boolean,
  createdAt?: timestamp
}
```

#### Collection: `sales` (Asegurar compatibilidad)
```javascript
{
  machineName: string,
  clientName?: string,
  startTime: timestamp,
  endTime: timestamp,
  totalMinutes: number,
  amount: number,
  rate: {
    id: string,
    name: string,
    pricePerHour: number
  },
  paymentMethod: 'efectivo' | 'yape' | 'otro',
  soldProducts?: [{
    productId: string,
    productName: string,
    quantity: number,
    unitPrice: number
  }],
  operator?: {
    id: string,
    email: string
  }
}
```

### 5. Rules de Firestore
Ejemplo de reglas (ajusta según necesidad):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Admin tiene acceso total
    match /{document=**} {
      allow read, write: if request.auth.uid != null 
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Manager puede editar machines, locations, products
    match /{collection=machines|locations|products}/{document=**} {
      allow read: if request.auth.uid != null;
      allow write: if request.auth.uid != null &&
        (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin' ||
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'manager');
    }
    
    // Operators pueden leer y crear sales
    match /sales/{document=**} {
      allow read: if request.auth.uid != null;
      allow create: if request.auth.uid != null;
    }
  }
}
```

### 6. Rutas de Admin Protegidas
El archivo `/app/admin/page.tsx` está protegido con:
- ✅ `RoleGuard` component
- ✅ Requiere `admin` o `manager`
- ✅ Fallback automático

Asegurate que:
- [ ] Los usuarios admin/manager tengan rol correcto en Firestore
- [ ] `RoleGuard` esté importado correctamente
- [ ] La ruta `/admin` sea accesible

### 7. Datos Iniciales
El archivo `src/lib/data.ts` contiene datos de ejemplo:
- 3 tarifas (Normal, Económica, Premium)
- 13 clientes frecuentes
- 10 productos de muestra

Para usar datos reales:
- [ ] Importar datos desde archivo CSV/Excel
- [ ] Crear script de migración
- [ ] Popular Firestore con datos iniciales

### 8. Testing
- [ ] Probar flujo de cliente desde login hasta cobro
- [ ] Verificar cálculo de costos (hora/fracción)
- [ ] Verificar cálculo de vuelto
- [ ] Probar todos los métodos de pago
- [ ] Verificar permisos por rol
- [ ] Probar CRUD de cabinas
- [ ] Probar CRUD de productos
- [ ] Probar cambio de rol de usuario

### 9. Optimización
- [ ] Ejecutar `npm run build`
- [ ] Verificar que no hay errores de TypeScript
- [ ] Ejecutar `npm run typecheck`
- [ ] Optimizar imágenes
- [ ] Revisar performance (Lighthouse)

### 10. Seguridad
- [ ] Revisar variables de entorno (no commitear `.env.local`)
- [ ] Configurar CORS si aplica
- [ ] Revisar reglas de Firestore
- [ ] Implementar rate limiting
- [ ] Activar 2FA para admins
- [ ] Hacer backup de datos

### 11. Deployment
- [ ] Preparar servidor (Firebase Hosting o similar)
- [ ] Configurar dominio
- [ ] Setup de CI/CD
- [ ] backup automático
- [ ] Monitoreo de errores

---

## 📝 PRÓXIMAS FASES

### Fase 2: Analytics y Reportes
- [ ] Dashboard de ventas por período
- [ ] Gráficos de utilización de máquinas
- [ ] Reporte de clientes top
- [ ] Export a Excel/PDF

### Fase 3: Notificaciones
- [ ] Alertas de tiempo próximo a terminar
- [ ] Notificaciones de pago confirmado
- [ ] Push notifications en móvil
- [ ] SMS/Email de confirmación

### Fase 4: Integraciones
- [ ] Payment gateway (Culqi, Wompi, etc.)
- [ ] POS printer
- [ ] CCTV integración
- [ ] Contador de usar energía (IoT)

### Fase 5: Mobile App
- [ ] App móvil para operadores
- [ ] Interface touch-optimizada
- [ ] Notificaciones push
- [ ] Modo offline

---

## 🆘 TROUBLESHOOTING

### "Error: Module not found"
```bash
npm install
npm run build
```

### "Firestore permission denied"
- Verifica las rules de Firestore
- Asegúrate que el usuario está autenticado
- Revisa la colección existe

### "Componentes no cargan"
- Limpia cache: `npm run clean` (si existe)
- Reconstruye: `npm run build`
- Verifica imports relativos

### "Roles no funcionan"
- Verifica campo `role` en colección `users`
- Asegúrate que `RoleGuard` está correctamente importado
- Limpia cookies de sesión

---

## 📞 SOPORTE TÉCNICO

### Archivos Clave
| Archivo | Propósito |
|---------|-----------|
| `src/lib/types.ts` | Tipos TypeScript |
| `src/lib/data.ts` | Datos estáticos |
| `src/firebase/config.ts` | Config Firebase |
| `/app/admin/page.tsx` | Page administración |
| `src/components/admin/*` | Managers CRUD |

### Variables de Entorno Requeridas
```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

---

**Completado**: ____%  
**Fecha Inicio**: _______  
**Fecha Fin**: _______  
**Por**: _______  

