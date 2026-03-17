import type { User as FirebaseUser } from "firebase/auth";

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
  startTime: number;
  usageMode: UsageMode;
  rateId: Rate['id'];
  prepaidHours?: number;
  userId?: string;
};

export type Machine = {
  id: number;
  name: string;
  status: MachineStatus;
  rateId?: Rate['id'];
  session?: Session;
};

export type Product = {
  id: string;
  name: string;
  price: number;
  category: 'drink' | 'snack' | 'other';
}

export type SoldProduct = {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

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
  soldProducts?: SoldProduct[];
  operator?: {
    id?: string;
    email?: string | null;
  }
};

export type UserProfile = {
  uid: string;
  email: string;
  role: 'admin' | 'employee';
}

export type AuthContextType = {
  user: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
};
