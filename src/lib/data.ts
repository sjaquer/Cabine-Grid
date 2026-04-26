import type { Station, Product, Rate } from './types';

export const rates: Rate[] = [
  { id: 'rate-normal', name: 'Tarifa Normal', pricePerHour: 3.00, description: 'Tarifa estándar' },
  { id: 'rate-economica', name: 'Tarifa Económica', pricePerHour: 2.50, description: 'Tarifa reducida' },
  { id: 'rate-premium', name: 'Tarifa Premium', pricePerHour: 5.00, description: 'Tarifa premium con soporte' },
];

// This is now only used for seeding the database if it's empty.
// The main source of truth is Firestore.
export const initialMachines: Omit<Station, 'id'>[] = Array.from({ length: 12 }, (_, i) => ({
  name: `PC ${String(i + 1).padStart(2, '0')}`,
  type: 'PC',
  status: 'available',
  rateId: i < 6 ? 'rate-normal' : i < 10 ? 'rate-economica' : 'rate-premium',
  hourlyRate: i < 6 ? 3.00 : i < 10 ? 2.50 : 5.00,
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

import { collection, getDocs, addDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import type { Customer } from './types';

export async function createCustomer(firestore: any, payload: Omit<Customer, 'id'>) {
  const docRef = await addDoc(collection(firestore, "customers"), {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    metrics: {
      totalSessions: 0,
      totalMinutesRented: 0,
      totalProductsBought: 0,
      totalSpent: 0,
      machineUsage: {},
      visitsByWeekday: {},
      visitHours: {},
    }
  });
  return docRef.id;
}

export async function getCustomers(firestore: any) {
  const querySnapshot = await getDocs(collection(firestore, "customers"));
  return querySnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Customer));
}

export async function updateCustomer(firestore: any, id: string, payload: Partial<Customer>) {
  const customerRef = doc(firestore, "customers", id);
  await updateDoc(customerRef, {
    ...payload,
    updatedAt: serverTimestamp()
  });
}

