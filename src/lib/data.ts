import type { Machine, Rate, Product } from './types';

export const rates: Rate[] = [
  { 
    id: 'A', 
    name: 'Tarifa Normal', 
    pricePerHour: 3.00,
    description: 'Acceso completo',
    isActive: true
  },
  { 
    id: 'B', 
    name: 'Tarifa Económica', 
    pricePerHour: 2.50,
    description: 'Tarifa reducida',
    isActive: true
  },
  { 
    id: 'C', 
    name: 'Tarifa Premium', 
    pricePerHour: 5.00,
    description: 'Máquinas gaming',
    isActive: true
  },
];

// This is now only used for seeding the database if it's empty.
// The main source of truth is Firestore.
export const initialMachines: Omit<Machine, 'id'>[] = Array.from({ length: 12 }, (_, i) => ({
  name: `PC ${String(i + 1).padStart(2, '0')}`,
  status: 'available',
  rateId: i < 6 ? 'A' : i < 10 ? 'B' : 'C',
  session: null,
}));


export const clients: string[] = [
  'PlayerOne',
  'Nexus',
  'Vortex',
  'ZeroCool',
  'AcidBurn',
  'Cygnus',
  'Phantom',
  'Glitch',
  'Raptor',
  'Striker',
  'Phoenix',
  'Shadow',
  'Nova',
];

export const products: Product[] = [
  { id: 'prod_1', name: 'Inka Kola 500ml', price: 2.50, category: 'drink', stock: 20, isActive: true },
  { id: 'prod_2', name: 'Coca Cola 500ml', price: 2.50, category: 'drink', stock: 25, isActive: true },
  { id: 'prod_3', name: 'Agua San Mateo 500ml', price: 1.50, category: 'drink', stock: 30, isActive: true },
  { id: 'prod_4', name: 'Piqueo Snax', price: 1.80, category: 'snack', stock: 15, isActive: true },
  { id: 'prod_5', name: 'Galleta Casino', price: 1.00, category: 'snack', stock: 40, isActive: true },
  { id: 'prod_6', name: 'Impresión B/N', price: 0.20, category: 'other', stock: 100, isActive: true },
  { id: 'prod_7', name: 'Impresión Color', price: 1.00, category: 'other', stock: 50, isActive: true },
  { id: 'prod_8', name: 'Doritos 45g', price: 1.50, category: 'snack', stock: 20, isActive: true },
  { id: 'prod_9', name: 'Papas Lays 45g', price: 1.50, category: 'snack', stock: 18, isActive: true },
  { id: 'prod_10', name: 'Jugo Natural 500ml', price: 3.00, category: 'drink', stock: 12, isActive: true },
];
