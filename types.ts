
export enum ShareStatus {
  Unpaid = 'ODENMEDI',
  Paid = 'ODENDI',
  Partial = 'KISMI'
}

export enum SlaughterStatus {
  Pending = 'SIRADA',       // Kesim Yolu
  Cut = 'KESILDI',          // Kesildi
  Chopping = 'PARCALANIYOR',// Parçalanıyor
  Sharing = 'PAY_EDILIYOR', // Pay Ediliyor
  Delivered = 'TESLIM_EDILDI' // Teslim Edildi
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

export interface PaymentTransaction {
  id: string;
  share_id: string;
  amount: number;
  type: 'PAYMENT' | 'REFUND' | 'SALE_INIT';
  description?: string;
  created_at: string;
}

export interface Animal {
  id: string;
  tag_number: string;
  type: string;
  weight_kg: number;
  total_price: number;
  notes?: string;
  image_url?: string;
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
  animal_types?: string[];
  bank_accounts?: BankAccount[];
  active_announcement?: string; 
  announcement_duration_sec?: number; // Changed to seconds
  announcement_timestamp?: string; // To trigger sound
  notification_sound?: 'ding' | 'gong' | 'bell';
  site_title?: string;
  logo_url?: string;
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
