export type Rate = {
  id: 'A' | 'B';
  name: string;
  pricePerHour: number;
};

export type UsageMode = 'free' | 'prepaid';

export type PaymentMethod = 'efectivo' | 'yape' | 'otro';

export type MachineStatus = 'available' | 'occupied' | 'warning';

export type Session = {
  id: string;
  client?: string;
  startTime: number; // Date.now() timestamp
  usageMode: UsageMode;
  rateId: Rate['id'];
  prepaidHours?: number;
};

export type Machine = {
  id: number;
  name: string;
  status: MachineStatus;
  rateId?: Rate['id'];
  session?: Session;
};

export type Sale = {
  id: string;
  machineName: string;
  clientName?: string;
  startTime: number;
  endTime: number;
  totalMinutes: number;
  amount: number;
  rate: Rate;
  paymentMethod: PaymentMethod;
};
