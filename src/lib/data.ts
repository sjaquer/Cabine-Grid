import type { Machine, Rate } from './types';

export const rates: Rate[] = [
  { id: 'A', name: 'Tarifa A', pricePerHour: 3.00 },
  { id: 'B', name: 'Tarifa B', pricePerHour: 2.50 },
];

export const initialMachines: Machine[] = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  name: `PC ${String(i + 1).padStart(2, '0')}`,
  status: 'available',
  rateId: i < 6 ? 'A' : 'B', // First 6 are Rate A, rest are Rate B
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
