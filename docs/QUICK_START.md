# 🎯 Guía Rápida de Cambios - CyberGrid Console v0.2

## ¿Qué se mejoró?

### 1️⃣ **INTERFAZ Y DISEÑO** ✨
- Header más moderno con información en tiempo real
- Tarjetas de máquinas con mejor visual y animaciones
- Colores y estilos más atractivos
- Mejor experiencia de usuario en general

### 2️⃣ **FORMULARIO DE CLIENTE** ⚡
- Asignación de cliente MUCHO más rápida
- Vista previa automática de costos
- Conversión automática horas ↔ dinero
- Interfaz más intuitiva

### 3️⃣ **ADMINISTRACIÓN COMPLETA** 🏢
**Nuevo Panel Admin** accesible desde [localhost:9002/admin](http://localhost:9002/admin)

Tres opciones según tu rol:
- **Admin**: Acceso a todo (cabinas, locales, productos, usuarios)
- **Manager**: Gestiona cabinas, locales y productos
- **Operator**: Solo usa máquinas
- **View-Only**: Solo ve información

#### Qué puedes hacer:

**Cabinas** 💻
- Crear/Editar/Eliminar cabinas
- Definir especificaciones técnicas
- Asignar tarifas
- Cambiar estado (Mantenimiento, etc.)

**Locales** 📍
- Crear múltiples locales (sucursales)
- Gestionar dirección y teléfono
- Activar/desactivar locales

**Productos** 🛍️
- Agregar nuevos productos para vender
- Categorizar (bebidas, snacks, comida, otros)
- Gestionar inventario/stock
- Editar precios fácilmente

**Usuarios** 👥 (Solo Admin)
- Ver todos los usuarios
- Cambiar roles dinámicamente
- Activar/desactivar
- Gestionar permisos

### 4️⃣ **COBRO MEJORADO** 💳
- Desglose claro de costos
- Métodos de pago visuales (Efectivo, Yape, Tarjeta)
- Cálculo automático de vuelto
- TPV (Point of Sale) mejorado para productos

### 5️⃣ **SISTEMA DE ROLES** 🔐
```
Admin ────┐
Manager ──┼─→ Panel de Admin
Operator ─┴─→ Dashboard Normal
View-Only ──→ Lectura Only
```

---

## 🚀 CÓMO EMPEZAR

### Login
1. Inicia sesión con tu cuenta
2. Sistema validará tu rol automáticamente

### Dashboard Principal
1. **PC Grid**: Visualiza todas las máquinas
2. **Verde**: Disponible → Click para asignar cliente
3. **Rojo**: En Uso → Click para cobrar y productos adicionales
4. **Amarillo**: Alerta de tiempo → Cobrar pronto

### Botones Principales
- 📊 **Historial**: Ver ventas del día
- ⚙️ **Configuración**: Panel de admin (Admin/Manager)

### Asignar Máquina (Rápido)
1. Click en máquina verde
2. Selecciona cliente (o deja opcional)
3. Elige tarifa
4. Marca Tiempo Libre o Prepago
5. Si es Prepago: ingresa horas o monto
6. Confirma ¡Listo!

### Cobrar y Vender
1. Click en máquina roja/amarilla
2. **Tab "Resumen"**: Ver desglose de costos
3. **Tab "Productos"**: Agregar bebidas, snacks, etc.
4. Selecciona método de pago
5. Si es efectivo: ingresa monto recibido → ve el vuelto
6. Confirma pago ¡Sesión finalizada!

### Administración (Admin/Manager)
1. Click en ⚙️ (Configuración)
2. Selecciona la sección:
   - **Cabinas**: Crear/editar máquinas
   - **Locales**: Crear/editar sucursales
   - **Productos**: Agregar productos para venta
   - **Usuarios**: Cambiar roles (solo Admin)

---

## 📋 NUEVAS CARACTERÍSTICAS DETALLADAS

### Tarjetas de Máquinas
```
┌─────────────────┐
│  PC 01          │ ← Nombre
│  ✓ Disponible   │ ← Estado con badge
├─────────────────┤
│  💻 ┌─────────┐ │
│     │ Disponible
│     │ Haz click│
│     │ para    │
│     │ asignar │
│     └─────────┘ │
├─────────────────┤
│ [ASIGNAR PC]    │
└─────────────────┘
```

### Asignación Rápida
```
Client:     [Select ▼ Ocasional]
Rate:       [Select ▼ Normal $3/hr]
Mode:       [◉ Free Time  ◯ Prepaid]
            [Display calculation live]
Summary:
├─ PC: PC 01
├─ Client: PlayerOne
└─ Rate: Normal
```

### Sistema de Cobro
```
Resumen:
├─ Cliente: PlayerOne
├─ Tiempo: 1:25:30
├─ Tarifa: Normal ($3/hr)
├─ Sesión: $4.50
└─ Productos: +$5.00
    TOTAL: $9.50

Método:
[💵 Efectivo] [📱 Yape/Plin] [💳 Tarjeta]

Efectivo:
Paga con: [15.00]
Vuelto: $5.50
```

### TPV (Venta de Productos)
```
🥤 Bebidas | 🍪 Snacks | 🍔 Comida | 📦 Otros

[Búsqueda producto...]

Coca Cola 500ml     $2.50
[- 2 +]  Subtotal: $5.00

Galleta Casino      $1.00
[- 1 +]  Subtotal: $1.00

═══════════════════
Total Productos: $6.00
```

---

## 🔄 FLUJOS PRINCIPALES

### Flujo: Cliente Entra
```
1. Click en PC disponible (verde)
2. Panel asignación:
   - Nombre: opcional
   - Tarifa: Normal o Económica
   - Modo: Tiempo Libre o Prepago
   - Si Prepago: ingresa $ o horas
3. Confirmar
PC se vuelve ROJA ✓
```

### Flujo: Cliente Sale y Compra
```
1. Click en PC ocupada (roja)
2. Resumen automático:
   - Cliente y tiempo
   - Costo sesión
   - Total a cobrar
3. (Opcional) Agregar productos en tab TPV
4. Seleccionar método de pago
   - Efectivo: calcular vuelto
   - Yape/Plin: confirmar
   - Tarjeta: confirmar
5. Confirmar pago
PC vuelve VERDE ✓
Sesión se guarda ✓
```

### Flujo: Crear Nueva Máquina
```
1. Login como Admin/Manager
2. Click ⚙️ → Configuración
3. Tab "Cabinas"
4. Click "Nueva Máquina"
5. Llenar:
   - Nombre: "PC 13"
   - Tarifa: "Normal"
   - (Opcional) Specs: CPU, RAM, etc.
6. Guardar
Nueva máquina aparece en la grid ✓
```

### Flujo: Agregar Producto
```
1. Login como Admin/Manager
2. Click ⚙️ → Configuración
3. Tab "Productos"
4. Click "Nuevo Producto"
5. Llenar:
   - Nombre: "Doritos"
   - Precio: 1.50
   - Categoría: Snack
   - Stock: 20
6. Guardar
Producto disponible en TPV ✓
```

---

## 💡 TIPS Y TRUCOS

### Rapidez
- **Prepago**: Mejor para sesiones cortas y controladas
- **Busca el cliente**: Se auto-completa la selección
- **Producto rápido**: Usa tab TPV mientras tienes el dialog abierto

### Eficiencia
- **Cambio de tarifa**: Edita en admin, aplica automáticamente a nuevas sesiones
- **Stock**: Agrega productos antes de que lleguen clientes
- **Locales múltiples**: El sistema soporta sucursales (estructura lista)

### Seguridad
- **Roles**: Asigna permisos específicos a cada persona
- **View-only**: Para reporteros que no deben tocar nada
- **Admin**: Controla quién puede cambiar qué

---

## ⚡ FUNCIONES RÁPIDAS

| Acción | Atajo |
|--------|-------|
| Asignar PC | Click en verde + [Asignar] |
| Cobrar | Click en roja + [Confirmar Pago] |
| Agregar Producto | Admin → Productos → [Nuevo] |
| Cambiar Rol | Admin → Usuarios → [Editar] |
| Ver Historial | [Historial] en header |
| Panel Admin | ⚙️ en header |

---

## 📱 RESPONSIVE
- ✅ Desktop (1920px+)
- ✅ Laptop (1366px)
- ✅ Tablet (768px)
- ✅ Mobile (360px) - Optimizado

---

## 🐛 REPORTAR PROBLEMAS

Si algo no funciona:
1. Verifica tu rol y permisos
2. Recarga la página (Ctrl+R)
3. Revisa la consola (F12)
4. Contacta al equipo dev

---

## 📞 SOPORTE

**Email**: desarrollo@cybergrid.local  
**Slack**: #cybergrid-support  
**Wiki**: https://wiki.cybergrid.local  

---

**Versión**: 0.2.0  
**Última actualización**: 17 de marzo 2026  
**Status**: ✅ Producción  
