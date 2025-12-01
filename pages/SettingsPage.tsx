import React, { useState, useRef } from 'react';
import { AppSettings, BankAccount } from '../types';
import { configService, animalService } from '../services/supabaseService';
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
  const [restoring, setRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    try {
      await configService.updateSettings({
        admin_password: form.admin_password,
        default_image_url: form.default_image_url,
        theme: form.theme,
        animal_types: form.animal_types,
        bank_accounts: form.bank_accounts,
        notification_sound: form.notification_sound,
        custom_sound_url: form.custom_sound_url,
        site_title: form.site_title,
        logo_url: form.logo_url
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

  const handleBackup = async () => {
      try {
          const data = await animalService.getAllForBackup();
          const backupObj = {
              timestamp: new Date().toISOString(),
              data: data
          };
          const blob = new Blob([JSON.stringify(backupObj, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `kurban_yedek_${new Date().toLocaleDateString('tr-TR')}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
      } catch (e) {
          alert("Yedekleme başarısız.");
          console.error(e);
      }
  };

  const handleRestoreClick = () => {
      if (confirm("DİKKAT! Yükleme işlemi mevcut verileri SİLECEK ve yedek dosyasındaki verileri yükleyecektir. Emin misiniz?")) {
          fileInputRef.current?.click();
      }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
          try {
              setRestoring(true);
              const json = JSON.parse(event.target?.result as string);
              if (json && json.data) {
                  await animalService.restoreData(json.data);
                  alert("Veriler başarıyla yüklendi. Sayfa yenileniyor...");
                  window.location.reload();
              } else {
                  throw new Error("Geçersiz yedek dosyası");
              }
          } catch (err) {
              alert("Yükleme hatası: Dosya bozuk veya uyumsuz.");
              console.error(err);
          } finally {
              setRestoring(false);
          }
      };
      reader.readAsText(file);
      e.target.value = ''; // Reset input
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              setForm(prev => ({ ...prev, logo_url: reader.result as string }));
          };
          reader.readAsDataURL(file);
      }
  };

  const handleSoundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          if (file.size > 2 * 1024 * 1024) {
              alert("Ses dosyası 2MB'dan büyük olamaz!");
              return;
          }
          const reader = new FileReader();
          reader.onloadend = () => {
              setForm(prev => ({ ...prev, custom_sound_url: reader.result as string, notification_sound: 'custom' }));
          };
          reader.readAsDataURL(file);
      }
  };

  const playPreviewSound = () => {
      if (form.notification_sound === 'custom' && form.custom_sound_url) {
          const audio = new Audio(form.custom_sound_url);
          audio.play().catch(e => alert("Ses çalınamadı."));
          return;
      }
      // Default fallback tone
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4 mb-6">
          <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center text-xl">⚙️</div>
          <h2 className="text-3xl font-bold dark:text-white">Ayarlar</h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Site Identity Settings */}
        <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-md p-6 rounded-2xl shadow-sm border border-white/20">
           <h3 className="text-sm font-bold uppercase text-gray-400 mb-4 tracking-wider">Site Kimliği</h3>
           <div className="space-y-4">
             <div>
               <label className="block text-sm font-semibold mb-1 dark:text-gray-300">Uygulama Adı</label>
               <input 
                 type="text" 
                 value={form.site_title || 'BANA Kurban'} 
                 onChange={e => setForm({...form, site_title: e.target.value})}
                 className="w-full border-none bg-white dark:bg-gray-900/50 p-3 rounded-xl shadow-inner dark:text-white"
               />
             </div>
             <div>
               <label className="block text-sm font-semibold mb-1 dark:text-gray-300">Logo</label>
               <div className="flex gap-4 items-center">
                   {form.logo_url && (
                       <img src={form.logo_url} alt="Logo" className="h-12 w-12 object-contain bg-white rounded-lg p-1 shadow-sm" />
                   )}
                   <input 
                     type="file" 
                     accept="image/*"
                     onChange={handleLogoUpload}
                     className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                   />
               </div>
             </div>
           </div>
        </div>

        {/* General Settings */}
        <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-md p-6 rounded-2xl shadow-sm border border-white/20">
           <h3 className="text-sm font-bold uppercase text-gray-400 mb-4 tracking-wider">Genel</h3>
           <div className="space-y-4">
             <div>
               <label className="block text-sm font-semibold mb-1 dark:text-gray-300">Yönetici Şifresi</label>
               <input 
                 type="password" 
                 value={form.admin_password || ''} 
                 onChange={e => setForm({...form, admin_password: e.target.value})}
                 className="w-full border-none bg-white dark:bg-gray-900/50 p-3 rounded-xl shadow-inner dark:text-white"
               />
             </div>
             <div>
               <label className="block text-sm font-semibold mb-1 dark:text-gray-300">Tema</label>
               <select 
                  value={form.theme}
                  onChange={e => setForm({...form, theme: e.target.value as any})}
                  className="w-full border-none bg-white dark:bg-gray-900/50 p-3 rounded-xl shadow-inner dark:text-white"
               >
                 <option value="light">Aydınlık (Light)</option>
                 <option value="dark">Karanlık (Dark)</option>
               </select>
             </div>
             
             {/* Sound Settings */}
             <div className="bg-gray-50/50 dark:bg-gray-700/30 p-4 rounded-xl border border-gray-100 dark:border-gray-600">
               <label className="block text-sm font-bold dark:text-white mb-2">TV Bildirim Sesi</label>
               <div className="flex gap-2 items-center mb-3">
                   <select 
                      value={form.notification_sound || 'ding'}
                      onChange={e => setForm({...form, notification_sound: e.target.value as any})}
                      className="flex-1 border-none bg-white dark:bg-gray-800 p-2 rounded-lg shadow-sm dark:text-white"
                   >
                     <option value="ding">Ding</option>
                     <option value="bell">Zil</option>
                     <option value="gong">Gong</option>
                     <option value="custom">Özel Yükle...</option>
                   </select>
                   <button 
                     onClick={playPreviewSound}
                     className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center hover:bg-blue-200 transition-colors"
                   >
                       🔊
                   </button>
               </div>
               
               {form.notification_sound === 'custom' && (
                   <div className="text-xs">
                       <input 
                         type="file" 
                         accept="audio/*"
                         onChange={handleSoundUpload}
                         className="w-full text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-gray-200"
                       />
                       {form.custom_sound_url ? <span className="text-green-600 font-bold block mt-1">✓ Ses yüklü</span> : <span className="text-red-500 block mt-1">Dosya seçin (Max 2MB)</span>}
                   </div>
               )}
             </div>
           </div>
        </div>

        {/* Bank Accounts */}
        <div className="md:col-span-2 bg-white/60 dark:bg-gray-800/60 backdrop-blur-md p-6 rounded-2xl shadow-sm border border-white/20">
           <h3 className="text-sm font-bold uppercase text-gray-400 mb-4 tracking-wider">Banka Hesapları (Makbuz İçin)</h3>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {form.bank_accounts?.map((bank, i) => (
                   <div key={i} className="flex justify-between items-start bg-white dark:bg-gray-900/50 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 group">
                       <div className="dark:text-gray-300">
                           <div className="font-bold text-gray-900 dark:text-white">{bank.bank_name}</div>
                           <div className="text-xs text-gray-500">{bank.name}</div>
                           <div className="font-mono text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded mt-1">{bank.iban}</div>
                       </div>
                       <button onClick={() => removeBank(i)} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                           <TrashIcon className="w-5 h-5"/>
                       </button>
                   </div>
               ))}
           </div>

           <div className="flex flex-col md:flex-row gap-3 p-4 bg-gray-50/50 dark:bg-gray-700/30 rounded-xl border border-dashed border-gray-300 dark:border-gray-600">
             <input 
                type="text" 
                placeholder="Banka Adı" 
                value={newBank.bank_name} 
                onChange={e => setNewBank({...newBank, bank_name: e.target.value})}
                className="flex-1 p-2 rounded-lg border-none bg-white dark:bg-gray-800 shadow-sm dark:text-white"
             />
             <input 
                type="text" 
                placeholder="Alıcı Adı" 
                value={newBank.name} 
                onChange={e => setNewBank({...newBank, name: e.target.value})}
                className="flex-1 p-2 rounded-lg border-none bg-white dark:bg-gray-800 shadow-sm dark:text-white"
             />
             <input 
                type="text" 
                placeholder="IBAN" 
                value={newBank.iban} 
                onChange={e => setNewBank({...newBank, iban: e.target.value})}
                className="flex-1 p-2 rounded-lg border-none bg-white dark:bg-gray-800 shadow-sm dark:text-white"
             />
             <button onClick={addBank} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700">Ekle</button>
           </div>
        </div>

        {/* Data Backup */}
        <div className="md:col-span-2 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 p-6 rounded-2xl shadow-sm border border-purple-100 dark:border-purple-800">
            <h3 className="text-sm font-bold uppercase text-purple-800 dark:text-purple-300 mb-4 tracking-wider">Veri Yönetimi</h3>
            <div className="flex flex-col md:flex-row gap-6 items-center">
               <div className="flex-1">
                   <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                       Tüm verileri indirerek yedekleyebilirsiniz.
                   </p>
                   <button onClick={handleBackup} className="bg-white text-purple-700 border border-purple-200 px-6 py-2 rounded-lg font-bold hover:bg-purple-50 transition-colors shadow-sm">
                       Yedek İndir (.json)
                   </button>
               </div>
               <div className="w-px h-12 bg-purple-200 dark:bg-purple-800 hidden md:block"></div>
               <div className="flex-1">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                       Yedek dosyasını geri yükleyin. <span className="text-red-500 font-bold">Mevcut veriler silinir!</span>
                   </p>
                   <input type="file" accept=".json" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />
                   <button onClick={handleRestoreClick} disabled={restoring} className="bg-purple-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-purple-700 transition-colors shadow-lg shadow-purple-500/20 disabled:opacity-50">
                       {restoring ? 'Yükleniyor...' : 'Yedek Yükle'}
                   </button>
               </div>
           </div>
        </div>

      </div>

      <div className="fixed bottom-6 right-8 z-50">
          <button 
            onClick={handleSave} 
            className="bg-gray-900 dark:bg-white dark:text-gray-900 text-white px-8 py-4 rounded-full font-bold shadow-2xl hover:scale-105 transition-transform flex items-center gap-2"
          >
              <span>💾</span> Ayarları Kaydet
          </button>
      </div>
    </div>
  );
};

export default SettingsPage;