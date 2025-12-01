
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../constants';
import { Animal, Shareholder, ShareStatus, AppSettings } from '../types';

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
    return { animals, shares };
  },

  async restoreData(backupData: any) {
      // Very basic restore: Delete all and re-insert. Use with caution.
      // In a production app, you might want "merge" or "smart restore".
      if (backupData.animals && Array.isArray(backupData.animals)) {
          // Clean existing for safety if full restore
          await supabase.from('shares').delete().neq('id', '00000000-0000-0000-0000-000000000000'); 
          await supabase.from('animals').delete().neq('id', '00000000-0000-0000-0000-000000000000');

          const { error: err1 } = await supabase.from('animals').insert(backupData.animals);
          if (err1) throw err1;
          
          if (backupData.shares && Array.isArray(backupData.shares) && backupData.shares.length > 0) {
              const { error: err2 } = await supabase.from('shares').insert(backupData.shares);
              if (err2) throw err2;
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
    const { data, error } = await supabase
      .from('animals')
      .update(updates)
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
          announcement_duration_minutes: 0,
          announcement_start_time: '',
          notification_sound: 'ding',
          site_title: 'BANA Kurban',
          logo_url: ''
      };

      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST116') {
            console.warn("Settings table missing or empty. Using defaults.");
            return defaults;
        }
        throw error;
      }
      return { ...defaults, ...data };
    } catch (error) {
      console.warn("Failed to fetch settings (likely first run):", error);
      return { id: 0, admin_password: 'admin123', theme: 'light', animal_types: ['Büyükbaş'], site_title: 'BANA Kurban' } as AppSettings;
    }
  },
  
  async updateSettings(updates: Partial<AppSettings>) {
    const { data: existing } = await supabase.from('app_settings').select('id').limit(1).single();
    if (existing) {
        // Ensure complex types are passed correctly for JSONB
        const payload = { ...updates };
        const { data, error } = await supabase.from('app_settings').update(payload).eq('id', existing.id).select().single();
        if (error) throw error;
        return data;
    }
  },

  async getYears() {
    try {
      const { data, error } = await supabase.from('years').select('year').order('year', { ascending: false });
      if (error) {
        if (error.code === '42P01') return [new Date().getFullYear()];
        throw error;
      }
      return data?.map(y => y.year) || [];
    } catch (error) {
      console.warn("Failed to fetch years:", error);
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
