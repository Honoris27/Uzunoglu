
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../constants';
import { Animal, Shareholder, ShareStatus, AppSettings, PaymentTransaction } from '../types';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const animalService = {
  async getAll(year: number) {
    try {
      const { data, error } = await supabase
        .from('animals')
        .select('*, shares(*)')
        .eq('year', year)
        .order('created_at', { ascending: false });
      
      if (error) {
        if (error.code === '42P01') return [];
        throw error;
      }
      return data as Animal[];
    } catch (error) {
      console.error("Error fetching animals:", error);
      return [];
    }
  },

  async getAllForBackup() {
    const { data: animals } = await supabase.from('animals').select('*');
    const { data: shares } = await supabase.from('shares').select('*');
    const { data: payments } = await supabase.from('payment_transactions').select('*');
    return { animals, shares, payments };
  },

  async restoreData(backupData: any) {
      if (backupData.animals && Array.isArray(backupData.animals)) {
          // Clean existing (cascade will handle shares/payments usually, but being explicit is safe)
          await supabase.from('payment_transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          await supabase.from('shares').delete().neq('id', '00000000-0000-0000-0000-000000000000'); 
          await supabase.from('animals').delete().neq('id', '00000000-0000-0000-0000-000000000000');

          const { error: err1 } = await supabase.from('animals').insert(backupData.animals);
          if (err1) throw err1;
          
          if (backupData.shares && Array.isArray(backupData.shares) && backupData.shares.length > 0) {
              const { error: err2 } = await supabase.from('shares').insert(backupData.shares);
              if (err2) throw err2;
          }

          if (backupData.payments && Array.isArray(backupData.payments) && backupData.payments.length > 0) {
              const { error: err3 } = await supabase.from('payment_transactions').insert(backupData.payments);
              if (err3) throw err3;
          }
      }
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('animals')
      .select('*, shares(*)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as Animal;
  },

  async create(animal: Partial<Animal>) {
    const { data, error } = await supabase
      .from('animals')
      .insert([animal])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Partial<Animal>) {
    const payload = {
        ...updates,
        updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('animals')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    const { error } = await supabase.from('animals').delete().eq('id', id);
    if (error) throw error;
  },

  async resetShares(animalId: string) {
     const { error } = await supabase.from('shares').delete().eq('animal_id', animalId);
     if (error) throw error;
  }
};

export const shareService = {
  async create(share: Omit<Shareholder, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('shares')
      .insert([share])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Partial<Shareholder>) {
    const { data, error } = await supabase
      .from('shares')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    const { error } = await supabase.from('shares').delete().eq('id', id);
    if (error) throw error;
  }
};

export const paymentService = {
    async create(transaction: Omit<PaymentTransaction, 'id' | 'created_at'>) {
        try {
            const { error } = await supabase.from('payment_transactions').insert([transaction]);
            if (error) {
                // If table doesn't exist, ignore (backward compatibility for old setup)
                if (error.code === '42P01') return;
                throw error;
            }
        } catch (e) {
            console.warn("Payment log failed:", e);
        }
    },

    async getByShareId(shareId: string) {
        try {
            const { data, error } = await supabase
                .from('payment_transactions')
                .select('*')
                .eq('share_id', shareId)
                .order('created_at', { ascending: true });
            
            if (error) return [];
            return data as PaymentTransaction[];
        } catch (e) {
            return [];
        }
    }
};

export const configService = {
  async getSettings() {
    try {
      const { data, error } = await supabase.from('app_settings').select('*').limit(1).single();
      
      const defaults: AppSettings = { 
          id: 0,
          admin_password: 'admin123', 
          theme: 'light',
          animal_types: ['Büyükbaş'],
          bank_accounts: [],
          active_announcement: '',
          announcement_duration_sec: 60,
          announcement_timestamp: '',
          notification_sound: 'ding',
          custom_sound_url: '',
          site_title: 'BANA Kurban',
          logo_url: ''
      };

      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST116') {
            return defaults;
        }
        throw error;
      }
      return { ...defaults, ...data };
    } catch (error) {
      return { id: 0, admin_password: 'admin123', theme: 'light', animal_types: ['Büyükbaş'] } as AppSettings;
    }
  },
  
  async updateSettings(updates: Partial<AppSettings>) {
    const { data: existing } = await supabase.from('app_settings').select('id').limit(1).single();
    if (existing) {
        const payload = { ...updates };
        const { data, error } = await supabase.from('app_settings').update(payload).eq('id', existing.id).select().single();
        if (error) throw error;
        return data;
    }
  },

  async getYears() {
    try {
      const { data, error } = await supabase.from('years').select('year').order('year', { ascending: false });
      if (error) return [new Date().getFullYear()];
      return data?.map(y => y.year) || [];
    } catch (error) {
      return [new Date().getFullYear()];
    }
  },

  async addYear(year: number) {
    const { error } = await supabase.from('years').insert([{ year }]);
    if (error) throw error;
  },

  async deleteYear(year: number) {
    const { error } = await supabase.from('years').delete().eq('year', year);
    if (error) throw error;
  }
};
