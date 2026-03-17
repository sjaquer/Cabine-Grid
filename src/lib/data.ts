import type { Machine, Rate, Product } from './types';

export const rates: Rate[] = [
  { id: 'A', name: 'Tarifa Normal', pricePerHour: 3.00 },
  { id: 'B', name: 'Tarifa Económica', pricePerHour: 2.50 },
];

// This is now only used for seeding the database if it's empty.
// The main source of truth is Firestore.
export const initialMachines: Omit<Machine, 'id'>[] = Array.from({ length: 12 }, (_, i) => ({
  name: `PC ${String(i + 1).padStart(2, '0')}`,
  status: 'available',
  rateId: i < 6 ? 'A' : 'B',
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
];

export const products: Product[] = [
  { id: 'prod_1', name: 'Inka Kola 500ml', price: 2.50, category: 'drink' },
  { id: 'prod_2', name: 'Coca Cola 500ml', price: 2.50, category: 'drink' },
  { id: 'prod_3', name: 'Agua San Mateo 500ml', price: 1.50, category: 'drink' },
  { id: 'prod_4', name: 'Piqueo Snax', price: 1.80, category: 'snack' },
  { id: 'prod_5', name: 'Galleta Casino', price: 1.00, category: 'snack' },
  { id: 'prod_6', name: 'Impresión B/N', price: 0.20, category: 'other' },
  { id: 'prod_7', name: 'Impresión Color', price: 1.00, category: 'other' },
];
