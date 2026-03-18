import type { User as FirebaseUser } from "firebase/auth";
import type { Timestamp } from "firebase/firestore";

export type PaymentMethod = 'efectivo' | 'yape' | 'otro';

export type UsageMode = 'free' | 'prepaid';

export type MachineStatus = 'available' | 'occupied' | 'warning' | 'maintenance';

export type Rate = {
  id: string;
  name: string;
  description?: string;
  pricePerHour: number;
};

export type Session = {
  id: string;
  client?: string;
  startTime: number;
  rateId?: string;
  hourlyRate?: number;
  usageMode: UsageMode;
  prepaidHours?: number;
  soldProducts?: SoldProduct[];
  userId?: string;
};

export type Machine = {
  id: string;
  name: string;
  status: MachineStatus;
  hourlyRate?: number;
  rateId?: string;
  session?: Session | null;
  locationId?: string;
  specs?: {
    processor?: string;
    ram?: string;
    storage?: string;
  };
};

export type Location = {
  id: string;
  name: string;
  address: string;
  phone?: string;
  isActive: boolean;
  fractionMinutes: number;
  createdAt: Timestamp;
  updateAt?: Timestamp;
};

export type Product = {
  id: string;
  name: string;
  price: number;
  category: 'drink' | 'snack' | 'food' | 'other';
  description?: string;
  stock?: number;
  isActive?: boolean;
  createdAt?: Timestamp;
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
  locationId?: string;
  receiptSeries?: string;
  receiptSequence?: number;
  receiptNumber?: string;
  shiftId?: string;
  clientName?: string;
  startTime: Timestamp;
  endTime: Timestamp;
  totalMinutes: number;
  amount: number;
  hourlyRate?: number;
  rate?: Rate;
  paymentMethod: PaymentMethod;
  soldProducts?: SoldProduct[];
  operator?: {
    id?: string;
    email?: string | null;
  }
};

export type UserRole = 'admin' | 'manager' | 'operator' | 'view-only';

export type UserProfile = {
  uid: string;
  email: string;
  name?: string;
  role: UserRole;
  locationIds?: string[];
  permissions?: string[];
  isActive?: boolean;
  createdAt?: Timestamp;
}

export type AuthContextType = {
  user: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  logout: (payload?: {
    countedCash?: number;
    inventoryChecked?: boolean;
    discrepancyReason?: string;
  }) => Promise<void>;
};
