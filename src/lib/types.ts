import type { User as FirebaseUser } from "firebase/auth";
import type { Timestamp } from "firebase/firestore";

export type PaymentMethod = 'efectivo' | 'yape' | 'otro' | 'deuda';

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
  clientId?: string;
  clientCode?: string;
  startTime: number;
  rateId?: string;
  hourlyRate?: number;
  usageMode: UsageMode;
  prepaidHours?: number;
  soldProducts?: SoldProduct[];
  userId?: string;
  discount?: {
    amount: number;
    reason: string;
  };
  isUnpaid?: boolean;
  appliedCards?: string[];
  extraMinutes?: number;
};

export type CardItemType = 'time' | 'discount' | 'challenge' | 'reward';

export type CardItem = {
  id: string;
  name: string;
  type: CardItemType;
  value?: number;
  description?: string;
  isUsed?: boolean;
  createdAt?: Timestamp;
  expiresAt?: Timestamp;
  usedAt?: Timestamp;
};

export type StationType = 'PC' | 'PS5' | 'XBOX' | 'PS4' | 'PS3' | 'NINTENDO' | 'VR' | 'SIMULADOR';

export type Station = {
  id: string;
  name: string;
  type: StationType;
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
  costPrice?: number;
  category: string;
  description?: string;
  stock?: number;
  minStock?: number;
  supplierInfo?: string;
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
  customerId?: string;
  customerCode?: string;
  startTime: Timestamp;
  endTime: Timestamp;
  totalMinutes: number;
  grossAmount?: number;
  discountAmount?: number;
  discountReason?: string;
  netAmount?: number;
  amount: number;
  hourlyRate?: number;
  rate?: Rate;
  paymentMethod: PaymentMethod;
  isUnpaid?: boolean;
  soldProducts?: SoldProduct[];
  operator?: {
    id?: string;
    email?: string | null;
  }
  extraMinutes?: number;
  appliedCards?: string[];
};

export type UserRole = 'admin' | 'manager' | 'operator' | 'view-only';

export type CustomerMetrics = {
  totalSessions: number;
  totalMinutesRented: number;
  totalProductsBought: number;
  totalSpent?: number;
  machineUsage?: Record<string, number>;
  visitsByWeekday?: Record<string, number>;
  visitHours?: Record<string, number>;
  lastVisitAt?: Timestamp;
};

export type Customer = {
  id: string;
  customerCode: string;
  fullName: string;
  age?: number;
  phone?: string;
  email?: string;
  favoriteGames?: string[];
  isActive?: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdBy?: {
    id?: string;
    email?: string;
  };
  metrics?: CustomerMetrics;
  dni?: string;
  whatsapp?: string;
  loyaltyLevel?: 'bronze' | 'silver' | 'gold';
  debt?: number;
  inventoryCards?: CardItem[];
  loyaltyPoints?: number;
  totalSpent?: number;
  lastVisit?: Timestamp;
  notes?: string;
};

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

export type StockMovementType = 'sale' | 'entry' | 'adjustment' | 'return' | 'damaged';

export type Inventory = {
  id?: string;
  locationId: string;
  productId: string;
  productName: string;
  currentStock: number;
  minStock?: number;
  reorderPoint?: number;
  lastUpdated?: Timestamp;
};

export type StockMovement = {
  id?: string;
  locationId: string;
  productId: string;
  productName: string;
  type: StockMovementType;
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  reason?: string;
  saleId?: string;
  shiftId?: string;
  approvedBy?: {
    id?: string;
    email?: string;
  };
  createdAt?: Timestamp;
};

export type AuthContextType = {
  user: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  logout: (payload?: {
    countedCash?: number;
    countedYape?: number;
    countedOther?: number;
    inventoryChecked?: boolean;
    discrepancyReason?: string;
  }) => Promise<void>;
};
