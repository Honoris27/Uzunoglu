
export enum AnimalType {
  Big = 'BUYUKBAS',
  Small = 'KUCUKBAS'
}

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
  type: AnimalType;
  weight_kg: number;
  total_price: number;
  notes?: string;
  image_url?: string;
  year: number;
  max_shares: number; // Set on first sale or creation
  slaughter_status: SlaughterStatus;
  created_at?: string;
  shares?: Shareholder[]; 
}

export interface AppSettings {
  id: number;
  admin_password?: string; // Stored simply for this demo
  default_image_url?: string;
  theme: 'light' | 'dark';
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
