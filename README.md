# Cabine Grid 🎮💼

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![Firebase](https://img.shields.io/badge/Firebase-Auth%20%26%20Firestore-orange?style=flat-square&logo=firebase)](https://firebase.google.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

[**Español**](#español) | [**English**](#english)

---

<a name="english"></a>
## 🇺🇸 English

**Cabine Grid** is a comprehensive management system designed for internet cabins (LAN centers) and cyber-cafés. It provides real-time control over PC sessions, inventory management, sales tracking, and operational auditing.

### ✨ Key Features
- **Real-time Monitoring:** Assign, monitor, and charge sessions directly from a grid-based dashboard.
- **Integrated POS:** Register product sales linked to active sessions or stand-alone sales.
- **Inventory Control:** Manage stock across multiple locations with movement history and low-stock alerts.
- **Shift Management:** Structured shift closure with automated reports and cash-flow reconciliation.
- **Security:** Role-based access control (RBAC) via Firestore Security Rules.
- **Auditing:** Complete logs of sensitive operations for administrative review.

### 🛠 Tech Stack
- **Framework:** Next.js 15 (App Router) + React 19
- **Language:** TypeScript
- **Backend/Database:** Firebase (Authentication + Firestore)
- **Styling:** Tailwind CSS + Radix UI (Shadcn/UI)
- **State Management:** Zustand

### 🚀 Getting Started

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/cabine-grid.git
   cd cabine-grid
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env.local` file based on `.env.example`:
   ```bash
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
   NEXT_PUBLIC_FIREBASE_API_KEY=...
   # ... add other variables from .env.example
   ```

4. **Run development server:**
   ```bash
   npm run dev
   ```

---

<a name="español"></a>
## 🇪🇸 Español

**Cabine Grid** es un sistema de gestión integral diseñado para cabinas de internet (LAN centers) y cyber-cafés. Proporciona control en tiempo real sobre las sesiones de PC, gestión de inventario, seguimiento de ventas y auditoría operativa.

### ✨ Características Principales
- **Monitoreo en Tiempo Real:** Asigne, monitoree y cobre sesiones directamente desde un panel en cuadrícula.
- **Punto de Venta (POS) Integrado:** Registre ventas de productos vinculadas a sesiones activas o ventas independientes.
- **Control de Inventario:** Gestione stock en múltiples locales con historial de movimientos y alertas de stock bajo.
- **Gestión de Turnos:** Cierre de turno estructurado con reportes automáticos y conciliación de caja.
- **Seguridad:** Control de acceso basado en roles (RBAC) mediante Reglas de Seguridad de Firestore.
- **Auditoría:** Registros completos de operaciones sensibles para revisión administrativa.

### 🛠 Tecnologías
- **Framework:** Next.js 15 (App Router) + React 19
- **Lenguaje:** TypeScript
- **Backend/Base de Datos:** Firebase (Authentication + Firestore)
- **Estilos:** Tailwind CSS + Radix UI (Shadcn/UI)
- **Estado:** Zustand

### 🚀 Inicio Rápido

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/tu-usuario/cabine-grid.git
   cd cabine-grid
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Configurar Variables de Entorno:**
   Cree un archivo `.env.local` basado en `.env.example`:
   ```bash
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
   NEXT_PUBLIC_FIREBASE_API_KEY=...
   # ... completar con sus credenciales de Firebase
   ```

4. **Ejecutar servidor de desarrollo:**
   ```bash
   npm run dev
   ```

---

## 📄 License | Licencia
Distributed under the MIT License. See `LICENSE` for more information.
Distribuido bajo la Licencia MIT. Vea el archivo `LICENSE` para más información.
