
import React, { useState } from 'react';
import { AppSettings, BankAccount } from '../types';
import { configService } from '../services/supabaseService';
import { TrashIcon, PlusIcon } from '../components/Icons';

interface Props {
  settings: AppSettings;
  availableYears: number[];
  onRefresh: () => void;
}

const SettingsPage: React.FC<Props> = ({ settings, availableYears, onRefresh }) => {
  const [form, setForm] = useState<AppSettings>(settings);
  const [newYear, setNewYear] = useState('');
  const [newType, setNewType] = useState('');
  const [newBank, setNewBank] = useState<BankAccount>({ bank_name: '', iban: '', name: '' });

  const handleSave = async () => {
    try {
      await configService.updateSettings({
        admin_password: form.admin_password,
        default_image_url: form.default_image_url,
        theme: form.theme,
        animal_types: form.animal_types,
        bank_accounts: form.bank_accounts
      });
      alert("Ayarlar başarıyla kaydedildi.");
      onRefresh();
    } catch (e) {
      alert("Hata oluştu");
      console.error(e);
    }
  };

  const handleAddYear = async () => {
    if(!newYear) return;
    try {
      await configService.addYear(Number(newYear));
      setNewYear('');
      onRefresh();
    } catch(e) { alert("Yıl eklenemedi"); }
  };

  const addType = () => {
      if (!newType) return;
      setForm(prev => ({
          ...prev,
          animal_types: [...(prev.animal_types || []), newType]
      }));
      setNewType('');
  };

  const removeType = (index: number) => {
      setForm(prev => ({
          ...prev,
          animal_types: prev.animal_types?.filter((_, i) => i !== index)
      }));
  };

  const addBank = () => {
      if (!newBank.bank_name || !newBank.iban) return;
      setForm(prev => ({
          ...prev,
          bank_accounts: [...(prev.bank_accounts || []), newBank]
      }));
      setNewBank({ bank_name: '', iban: '', name: '' });
  };

  const removeBank = (index: number) => {
      setForm(prev => ({
          ...prev,
          bank_accounts: prev.bank_accounts?.filter((_, i) => i !== index)
      }));
  };

  return (
    <div className="max-w-4xl space-y-8 pb-10">
      <h2 className="text-2xl font-bold mb-6 dark:text-white">Sistem Ayarları</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* General Settings */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
           <h3 className="text-lg font-bold mb-4 dark:text-white flex items-center gap-2">
               <span>🛠️</span> Genel Ayarlar
           </h3>
           <div className="space-y-4">
             <div>
               <label className="block text-sm mb-1 dark:text-gray-300">Yönetici Şifresi</label>
               <input 
                 type="text" 
                 value={form.admin_password || ''} 
                 onChange={e => setForm({...form, admin_password: e.target.value})}
                 className="w-full border p-2 rounded dark:bg-gray-700 dark:text-white"
               />
             </div>
             <div>
               <label className="block text-sm mb-1 dark:text-gray-300">Tema</label>
               <select 
                  value={form.theme}
                  onChange={e => setForm({...form, theme: e.target.value as any})}
                  className="w-full border p-2 rounded dark:bg-gray-700 dark:text-white"
               >
                 <option value="light">Aydınlık (Light)</option>
                 <option value="dark">Karanlık (Dark)</option>
               </select>
             </div>
             <div>
               <label className="block text-sm mb-1 dark:text-gray-300">Varsayılan Hayvan Resmi URL</label>
               <input 
                 type="text" 
                 value={form.default_image_url || ''} 
                 onChange={e => setForm({...form, default_image_url: e.target.value})}
                 className="w-full border p-2 rounded dark:bg-gray-700 dark:text-white"
                 placeholder="https://..."
               />
             </div>
           </div>
        </div>

        {/* Year Management */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
           <h3 className="text-lg font-bold mb-4 dark:text-white flex items-center gap-2">
               <span>📅</span> Çalışma Yılları
           </h3>
           <div className="flex gap-2 mb-4">
             <input 
                type="number" 
                placeholder="Yıl (örn: 2026)" 
                value={newYear} 
                onChange={e => setNewYear(e.target.value)}
                className="flex-1 border p-2 rounded dark:bg-gray-700 dark:text-white"
             />
             <button onClick={handleAddYear} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Ekle</button>
           </div>
           <div className="space-y-2 max-h-40 overflow-y-auto">
             {availableYears.map(y => (
               <div key={y} className="flex justify-between items-center bg-gray-50 dark:bg-gray-700 p-2 rounded">
                  <span className="font-mono font-bold dark:text-white">{y}</span>
                  <span className="text-xs text-gray-400">Aktif</span>
               </div>
             ))}
           </div>
        </div>

        {/* Animal Types */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
           <h3 className="text-lg font-bold mb-4 dark:text-white flex items-center gap-2">
               <span>🐮</span> Hayvan Türleri
           </h3>
           <div className="flex gap-2 mb-4">
             <input 
                type="text" 
                placeholder="Tür (örn: Deve)" 
                value={newType} 
                onChange={e => setNewType(e.target.value)}
                className="flex-1 border p-2 rounded dark:bg-gray-700 dark:text-white"
             />
             <button onClick={addType} className="bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700">
                 <PlusIcon className="w-5 h-5"/>
             </button>
           </div>
           <div className="space-y-2">
               {form.animal_types?.map((type, i) => (
                   <div key={i} className="flex justify-between items-center bg-gray-50 dark:bg-gray-700 p-2 rounded">
                       <span className="dark:text-white">{type}</span>
                       <button onClick={() => removeType(i)} className="text-red-500 hover:text-red-700">
                           <TrashIcon className="w-4 h-4"/>
                       </button>
                   </div>
               ))}
           </div>
        </div>

        {/* Bank Accounts */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
           <h3 className="text-lg font-bold mb-4 dark:text-white flex items-center gap-2">
               <span>🏦</span> Banka Hesapları (Makbuz İçin)
           </h3>
           <div className="space-y-3 mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
             <input 
                type="text" 
                placeholder="Banka Adı" 
                value={newBank.bank_name} 
                onChange={e => setNewBank({...newBank, bank_name: e.target.value})}
                className="w-full border p-2 rounded dark:bg-gray-700 dark:text-white text-sm"
             />
             <input 
                type="text" 
                placeholder="Alıcı Adı Soyadı" 
                value={newBank.name} 
                onChange={e => setNewBank({...newBank, name: e.target.value})}
                className="w-full border p-2 rounded dark:bg-gray-700 dark:text-white text-sm"
             />
             <input 
                type="text" 
                placeholder="IBAN (TR...)" 
                value={newBank.iban} 
                onChange={e => setNewBank({...newBank, iban: e.target.value})}
                className="w-full border p-2 rounded dark:bg-gray-700 dark:text-white text-sm"
             />
             <button onClick={addBank} className="w-full bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 text-sm">Hesap Ekle</button>
           </div>
           <div className="space-y-2">
               {form.bank_accounts?.map((bank, i) => (
                   <div key={i} className="flex justify-between items-start bg-gray-50 dark:bg-gray-700 p-2 rounded text-sm">
                       <div className="dark:text-gray-300">
                           <div className="font-bold">{bank.bank_name}</div>
                           <div>{bank.name}</div>
                           <div className="font-mono text-xs">{bank.iban}</div>
                       </div>
                       <button onClick={() => removeBank(i)} className="text-red-500 hover:text-red-700">
                           <TrashIcon className="w-4 h-4"/>
                       </button>
                   </div>
               ))}
           </div>
        </div>

      </div>

      <div className="fixed bottom-0 left-64 right-0 p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button onClick={handleSave} className="bg-primary-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-primary-700 shadow-lg hover:scale-105 transition-transform">
              Tüm Ayarları Kaydet
          </button>
      </div>
    </div>
  );
};

export default SettingsPage;
