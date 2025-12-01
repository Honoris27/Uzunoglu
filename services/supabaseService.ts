import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../constants';
import { Animal, AnimalType, Shareholder, ShareStatus } from '../types';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const animalService = {
  async getAll() {
    // Fetch animals and their associated shares
    const { data, error } = await supabase
      .from('animals')
      .select('*, shares(*)')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as Animal[];
  },

  async create(animal: Omit<Animal, 'id' | 'created_at' | 'shares'>) {
    const { data, error } = await supabase
      .from('animals')
      .insert([animal])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    const { error } = await supabase.from('animals').delete().eq('id', id);
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
