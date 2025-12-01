
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
  updated_at?: string; // New field for sorting
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
  announcement_duration_sec?: number;
  announcement_timestamp?: string;
  notification_sound?: 'ding' | 'gong' | 'bell' | 'siren' | 'horn' | 'whistle' | 'custom'; // Updated to include all used sounds
  custom_sound_url?: string; // New field for Base64 audio
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
