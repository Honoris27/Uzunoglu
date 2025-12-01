
export enum ShareStatus {
  Unpaid = 'ODENMEDI',
  Paid = 'ODENDI',
  Partial = 'KISMI'
}

export enum SlaughterStatus {
  Pending = 'SIRADA',
  Cutting = 'KESIMDE',
  Chopping = 'PARCALAMA',
  Packing = 'PAKETLEME',
  Done = 'TESLIM_EDILDI'
}

export interface Shareholder {
  id: string;
  animal_id: string;
  name: string;
  phone: string;
  amount_agreed: number;
  amount_paid: number;
  status: ShareStatus;
  created_at?: string;
}

export interface Animal {
  id: string;
  tag_number: string;
  type: string; // Changed from Enum to string for dynamic types
  weight_kg: number;
  total_price: number;
  notes?: string;
  image_url?: string; // Can be URL or Base64
  year: number;
  max_shares: number; 
  slaughter_status: SlaughterStatus;
  created_at?: string;
  shares?: Shareholder[]; 
}

export interface BankAccount {
  iban: string;
  name: string;
  bank_name: string;
}

export interface AppSettings {
  id: number;
  admin_password?: string;
  default_image_url?: string;
  theme: 'light' | 'dark';
  animal_types?: string[]; // Dynamic types
  bank_accounts?: BankAccount[]; // For receipts
}

export interface YearRecord {
  year: number;
  is_active: boolean;
}

export interface DashboardStats {
  totalAnimals: number;
  totalSoldShares: number;
  totalRevenue: number;
  totalPending: number;
}
