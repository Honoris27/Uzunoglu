
import React, { useState } from 'react';
import { AppSettings } from '../types';
import { configService } from '../services/supabaseService';

interface Props {
  settings: AppSettings;
  availableYears: number[];
  onRefresh: () => void;
}

const SettingsPage: React.FC<Props> = ({ settings, availableYears, onRefresh }) => {
  const [form, setForm] = useState(settings);
  const [newYear, setNewYear] = useState('');

  const handleSave = async () => {
    try {
      await configService.updateSettings({
        admin_password: form.admin_password,
        default_image_url: form.default_image_url,
        theme: form.theme
      });
      alert("Ayarlar kaydedildi.");
      onRefresh();
    } catch (e) {
      alert("Hata oluştu");
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

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold mb-6 dark:text-white">Ayarlar</h2>
      
      <div className="space-y-8">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
           <h3 className="text-lg font-bold mb-4 dark:text-white">Genel Ayarlar</h3>
           <div className="space-y-4">
             <div>
               <label className="block text-sm mb-1 dark:text-gray-300">Yönetici Şifresi</label>
               <input 
                 type="text" 
                 value={form.admin_password} 
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
                <button onClick={handleSave} className="bg-primary-600 text-white px-4 py-2 rounded hover:bg-primary-700">Kaydet</button>
             </div>
           </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
           <h3 className="text-lg font-bold mb-4 dark:text-white">Çalışma Yılları</h3>
           <div className="flex gap-2 mb-4">
             <input 
                type="number" 
                placeholder="Yıl (örn: 2026)" 
                value={newYear} 
                onChange={e => setNewYear(e.target.value)}
                className="border p-2 rounded dark:bg-gray-700 dark:text-white"
             />
             <button onClick={handleAddYear} className="bg-green-600 text-white px-4 py-2 rounded">Ekle</button>
           </div>
           <div className="space-y-2">
             {availableYears.map(y => (
               <div key={y} className="flex justify-between items-center bg-gray-50 dark:bg-gray-700 p-3 rounded">
                  <span className="dark:text-white">{y}</span>
                  {/* Prevent deleting current year logic could go here */}
               </div>
             ))}
           </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
