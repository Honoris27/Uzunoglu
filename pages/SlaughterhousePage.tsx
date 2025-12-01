
import React, { useState, useEffect } from 'react';
import { Animal, SlaughterStatus } from '../types';
import { animalService, configService } from '../services/supabaseService';

interface Props {
  animals: Animal[];
  refresh: () => void;
}

const SlaughterhousePage: React.FC<Props> = ({ animals, refresh }) => {
  const [announcement, setAnnouncement] = useState('');
  const [duration, setDuration] = useState('60');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
     configService.getSettings().then(s => {
         if(s.active_announcement) setAnnouncement(s.active_announcement);
         if(s.announcement_duration_sec) setDuration(s.announcement_duration_sec.toString());
     });
  }, []);

  const handleUpdateStatus = async (animalId: string, newStatus: SlaughterStatus) => {
      try {
          await animalService.update(animalId, { slaughter_status: newStatus });
          refresh();
      } catch (e) {
          alert("Güncelleme hatası");
      }
  };

  const updateAnnouncement = async () => {
      setLoading(true);
      try {
          await configService.updateSettings({ 
              active_announcement: announcement,
              announcement_duration_sec: Number(duration),
              announcement_timestamp: new Date().toISOString()
          });
          alert("Duyuru ekrana gönderildi.");
      } catch(e) { alert("Hata"); }
      setLoading(false);
  };

  const columns = [
      { id: SlaughterStatus.Pending, label: 'KESİM YOLU / SIRA', bg: 'bg-slate-50 dark:bg-slate-800', border: 'border-slate-200 dark:border-slate-700', text: 'text-slate-600 dark:text-slate-300' },
      { id: SlaughterStatus.Cut, label: 'KESİLDİ', bg: 'bg-red-50 dark:bg-red-900/10', border: 'border-red-200 dark:border-red-800', text: 'text-red-600 dark:text-red-400' },
      { id: SlaughterStatus.Chopping, label: 'PARÇALAMA', bg: 'bg-orange-50 dark:bg-orange-900/10', border: 'border-orange-200 dark:border-orange-800', text: 'text-orange-600 dark:text-orange-400' },
      { id: SlaughterStatus.Sharing, label: 'PAYLAMA', bg: 'bg-yellow-50 dark:bg-yellow-900/10', border: 'border-yellow-200 dark:border-yellow-800', text: 'text-yellow-600 dark:text-yellow-400' },
      { id: SlaughterStatus.Delivered, label: 'TESLİM', bg: 'bg-emerald-50 dark:bg-emerald-900/10', border: 'border-emerald-200 dark:border-emerald-800', text: 'text-emerald-600 dark:text-emerald-400' }
  ];

  return (
    <div className="pb-10 h-[calc(100vh-140px)] flex flex-col">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold dark:text-white flex items-center gap-2">
                <span className="p-2 bg-slate-200 dark:bg-slate-700 rounded-lg">🔪</span> Kesimhane Yönetimi
            </h2>
            <button
               onClick={() => window.open(window.location.href.split('?')[0] + '?mode=tv', '_blank')}
               className="bg-purple-600 text-white px-6 py-2 rounded-lg font-bold shadow-lg hover:bg-purple-700 flex items-center gap-2 hover:scale-105 transition-transform"
            >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                TV Yayınını Başlat
            </button>
        </div>

        {/* Broadcast Control Bar */}
        <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-xl mb-6 flex flex-col md:flex-row gap-4 items-center border border-slate-700">
            <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <span className="font-bold tracking-widest text-xs text-slate-400 uppercase">Canlı Yayın Paneli</span>
            </div>
            <div className="flex-1 w-full flex gap-4">
                <div className="flex-1">
                    <input 
                        type="text" 
                        value={announcement}
                        onChange={e => setAnnouncement(e.target.value)}
                        placeholder="📢 Duyuru metnini buraya yazın..."
                        className="w-full bg-slate-800 border-none rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                </div>
                <div className="w-24 relative">
                    <input 
                        type="number" 
                        value={duration}
                        onChange={e => setDuration(e.target.value)}
                        className="w-full bg-slate-800 border-none rounded-lg px-4 py-2 text-white text-center font-bold outline-none"
                    />
                    <span className="absolute right-2 top-2.5 text-[10px] text-slate-500">SN</span>
                </div>
            </div>
            <button 
                onClick={updateAnnouncement}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-2 rounded-lg font-bold uppercase tracking-wider text-sm transition-colors shadow-lg shadow-blue-500/30"
            >
                {loading ? '...' : 'Yayınla'}
            </button>
        </div>

        {/* Kanban Board */}
        <div className="flex-1 overflow-x-auto">
            <div className="flex gap-4 min-w-[1200px] h-full pb-4">
                {columns.map(col => (
                    <div key={col.id} className={`flex-1 flex flex-col ${col.bg} rounded-2xl border ${col.border} backdrop-blur-sm bg-opacity-80`}>
                        <div className={`p-4 border-b ${col.border} flex justify-between items-center sticky top-0 bg-inherit rounded-t-2xl z-10`}>
                            <span className={`font-black text-sm tracking-wide ${col.text}`}>{col.label}</span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-white/50 dark:bg-black/20 ${col.text}`}>
                                {animals.filter(a => a.slaughter_status === col.id).length}
                            </span>
                        </div>
                        <div className="flex-1 p-3 overflow-y-auto custom-scrollbar space-y-3">
                            {animals.filter(a => a.slaughter_status === col.id).map(animal => (
                                <div key={animal.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-lg transition-all group">
                                    <div className="flex justify-between items-start mb-3">
                                        <span className="text-2xl font-black text-slate-800 dark:text-white">#{animal.tag_number}</span>
                                        <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded">{animal.type}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        {col.id !== SlaughterStatus.Pending && (
                                            <button 
                                                onClick={() => handleUpdateStatus(animal.id, getPrevStatus(col.id))}
                                                className="flex-1 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg text-slate-500 dark:text-slate-300 transition-colors flex items-center justify-center"
                                                title="Geri Al"
                                            >
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                            </button>
                                        )}
                                        {col.id !== SlaughterStatus.Delivered && (
                                            <button 
                                                onClick={() => handleUpdateStatus(animal.id, getNextStatus(col.id))}
                                                className={`flex-1 py-2 rounded-lg text-white font-bold transition-colors flex items-center justify-center shadow-md ${col.id === SlaughterStatus.Pending ? 'bg-slate-800 hover:bg-slate-700 w-full' : 'bg-blue-600 hover:bg-blue-500'}`}
                                                title="Sonraki Aşama"
                                            >
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
  );
};

const getNextStatus = (current: SlaughterStatus) => {
    switch (current) {
        case SlaughterStatus.Pending: return SlaughterStatus.Cut;
        case SlaughterStatus.Cut: return SlaughterStatus.Chopping;
        case SlaughterStatus.Chopping: return SlaughterStatus.Sharing;
        case SlaughterStatus.Sharing: return SlaughterStatus.Delivered;
        default: return SlaughterStatus.Delivered;
    }
}

const getPrevStatus = (current: SlaughterStatus) => {
    switch (current) {
        case SlaughterStatus.Cut: return SlaughterStatus.Pending;
        case SlaughterStatus.Chopping: return SlaughterStatus.Cut;
        case SlaughterStatus.Sharing: return SlaughterStatus.Chopping;
        case SlaughterStatus.Delivered: return SlaughterStatus.Sharing;
        default: return SlaughterStatus.Pending;
    }
}

export default SlaughterhousePage;
