export enum AnimalType {
  Big = 'BUYUKBAS',
  Small = 'KUCUKBAS'
}

export enum ShareStatus {
  Unpaid = 'ODENMEDI',
  Paid = 'ODENDI',
  Partial = 'KISMI'
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
  created_at?: string;
  shares?: Shareholder[]; // Joined data
}

export interface DashboardStats {
  totalAnimals: number;
  totalSoldShares: number;
  totalRevenue: number;
  totalPending: number;
}
