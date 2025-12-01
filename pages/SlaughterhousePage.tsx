
import React, { useState, useEffect, useMemo } from 'react';
import { Animal, SlaughterStatus } from '../types';
import { animalService, configService } from '../services/supabaseService';
import Modal from '../components/Modal';

interface Props {
  animals: Animal[];
  refresh: () => void;
}

const SlaughterhousePage: React.FC<Props> = ({ animals, refresh }) => {
  const [announcement, setAnnouncement] = useState('');
  const [duration, setDuration] = useState('60');
  const [loading, setLoading] = useState(false);
  const [isSelectModalOpen, setIsSelectModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

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

  const handleAddToQueue = async (animalId: string) => {
      await handleUpdateStatus(animalId, SlaughterStatus.Pending);
      setIsSelectModalOpen(false);
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

  // Animals available to be added to the queue (Status = Barn or null)
  const barnAnimals = useMemo(() => {
      return animals.filter(a => a.slaughter_status === SlaughterStatus.Barn || !a.slaughter_status)
        .filter(a => a.tag_number.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [animals, searchTerm]);

  const columns = [
      { id: SlaughterStatus.Pending, label: 'KESİM SIRA (KUYRUK)', bg: 'bg-indigo-50 dark:bg-indigo-900/10', border: 'border-indigo-200 dark:border-indigo-800', text: 'text-indigo-600 dark:text-indigo-400' },
      { id: SlaughterStatus.Cut, label: 'KESİLDİ', bg: 'bg-red-50 dark:bg-red-900/10', border: 'border-red-200 dark:border-red-800', text: 'text-red-600 dark:text-red-400' },
      { id: SlaughterStatus.Chopping, label: 'PARÇALAMA', bg: 'bg-orange-50 dark:bg-orange-900/10', border: 'border-orange-200 dark:border-orange-800', text: 'text-orange-600 dark:text-orange-400' },
      { id: SlaughterStatus.Sharing, label: 'PAYLAMA', bg: 'bg-yellow-50 dark:bg-yellow-900/10', border: 'border-yellow-200 dark:border-yellow-800', text: 'text-yellow-600 dark:text-yellow-400' },
      { id: SlaughterStatus.Delivered, label: 'TESLİM', bg: 'bg-emerald-50 dark:bg-emerald-900/10', border: 'border-emerald-200 dark:border-emerald-800', text: 'text-emerald-600 dark:text-emerald-400' }
  ];

  // Logic to sort animals: Pending gets Sorted by UpdatedAt ASC (FIFO), Others by UpdatedAt DESC (Recent at top)
  const getSortedAnimals = (status: SlaughterStatus) => {
      return animals
        .filter(a => a.slaughter_status === status)
        .sort((a, b) => {
            const timeA = new Date(a.updated_at || a.created_at || 0).getTime();
            const timeB = new Date(b.updated_at || b.created_at || 0).getTime();
            // Queue: FIFO (Oldest first)
            if (status === SlaughterStatus.Pending) return timeA - timeB; 
            // Others: Show oldest updated first too to match the queue flow visual
            return timeA - timeB;
        });
  };

  return (
    <div className="pb-10 h-[calc(100vh-140px)] flex flex-col font-sans">
        <div className="flex justify-between items-center mb-6">
            <div>
                 <h2 className="text-3xl font-black text-gray-800 dark:text-white flex items-center gap-3">
                    <span className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 text-white rounded-xl shadow-lg shadow-purple-500/30">🔪</span> 
                    Kesimhane Operasyonu
                </h2>
                <p className="text-sm text-gray-500 mt-1 dark:text-gray-400 font-medium">Canlı akış ve süreç yönetimi</p>
            </div>
            
            <div className="flex gap-4">
                <button
                onClick={() => setIsSelectModalOpen(true)}
                className="bg-gray-800 dark:bg-gray-700 text-white px-6 py-3 rounded-xl font-bold hover:bg-gray-700 flex items-center gap-2 shadow-lg transition-transform hover:-translate-y-1"
                >
                    <span className="text-lg">+</span> Sıraya Ekle
                </button>
                <button
                onClick={() => window.open(window.location.href.split('?')[0] + '?mode=tv', '_blank')}
                className="bg-gradient-to-r from-red-600 to-rose-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-red-500/30 hover:shadow-red-500/50 flex items-center gap-2 hover:scale-105 transition-all"
                >
                    <svg className="w-5 h-5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    TV Yayınını Başlat
                </button>
            </div>
        </div>

        {/* Broadcast Control Bar */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md p-4 rounded-2xl shadow-sm border border-gray-200/50 dark:border-gray-700/50 mb-6 flex flex-col md:flex-row gap-4 items-center">
            <div className="flex items-center gap-3 px-4 border-r border-gray-200 dark:border-gray-700">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.6)]"></div>
                <span className="font-bold tracking-widest text-xs text-gray-400 uppercase">Yayın Paneli</span>
            </div>
            <div className="flex-1 w-full flex gap-4">
                <div className="flex-1">
                    <input 
                        type="text" 
                        value={announcement}
                        onChange={e => setAnnouncement(e.target.value)}
                        placeholder="📢 Duyuru metnini buraya yazın..."
                        className="w-full bg-gray-100 dark:bg-gray-900 border-none rounded-xl px-4 py-3 text-gray-800 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 outline-none transition-shadow shadow-inner"
                    />
                </div>
                <div className="w-24 relative">
                    <input 
                        type="number" 
                        value={duration}
                        onChange={e => setDuration(e.target.value)}
                        className="w-full bg-gray-100 dark:bg-gray-900 border-none rounded-xl px-4 py-3 text-gray-800 dark:text-white text-center font-bold outline-none shadow-inner"
                    />
                    <span className="absolute right-2 top-3.5 text-[10px] text-gray-400 font-bold">SN</span>
                </div>
            </div>
            <button 
                onClick={updateAnnouncement}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-bold uppercase tracking-wider text-sm transition-all shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50"
            >
                {loading ? '...' : 'Yayınla'}
            </button>
        </div>

        {/* Kanban Board */}
        <div className="flex-1 overflow-x-auto pb-4">
            <div className="flex gap-4 min-w-[1400px] h-full">
                {columns.map(col => {
                    const colAnimals = getSortedAnimals(col.id);
                    return (
                        <div key={col.id} className={`flex-1 flex flex-col ${col.bg} rounded-2xl border ${col.border} backdrop-blur-sm bg-opacity-60 transition-colors`}>
                            <div className={`p-4 border-b ${col.border} flex justify-between items-center sticky top-0 bg-inherit rounded-t-2xl z-10 backdrop-blur-md`}>
                                <span className={`font-black text-xs tracking-[0.1em] uppercase ${col.text}`}>{col.label}</span>
                                <span className={`text-xs font-bold px-2.5 py-1 rounded-lg bg-white/80 dark:bg-black/20 shadow-sm ${col.text}`}>
                                    {colAnimals.length}
                                </span>
                            </div>
                            <div className="flex-1 p-3 overflow-y-auto custom-scrollbar space-y-3">
                                {colAnimals.map((animal, idx) => (
                                    <div key={animal.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-xl hover:scale-[1.02] transition-all group relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800"></div>
                                        <div className="flex justify-between items-start mb-2 pl-2">
                                            <div>
                                                <div className="text-xs text-gray-400 font-bold mb-0.5">#{idx + 1}</div>
                                                <span className="text-2xl font-black text-gray-800 dark:text-white tracking-tight">#{animal.tag_number}</span>
                                            </div>
                                            <span className="text-[10px] uppercase font-bold text-gray-500 bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded-md">{animal.type}</span>
                                        </div>
                                        <div className="flex gap-2 pl-2 mt-4 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                            {col.id !== SlaughterStatus.Pending && (
                                                <button 
                                                    onClick={() => handleUpdateStatus(animal.id, getPrevStatus(col.id))}
                                                    className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-gray-500 dark:text-gray-300 transition-colors flex items-center justify-center text-xs font-bold"
                                                    title="Geri Al"
                                                >
                                                    ↩ Geri
                                                </button>
                                            )}
                                            {col.id !== SlaughterStatus.Delivered && (
                                                <button 
                                                    onClick={() => handleUpdateStatus(animal.id, getNextStatus(col.id))}
                                                    className={`flex-1 py-2 rounded-lg text-white font-bold transition-all flex items-center justify-center text-xs shadow-md ${col.id === SlaughterStatus.Pending ? 'bg-indigo-600 hover:bg-indigo-500 w-full' : 'bg-blue-600 hover:bg-blue-500'}`}
                                                    title="Sonraki Aşama"
                                                >
                                                    İlerle ➝
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {colAnimals.length === 0 && (
                                    <div className="h-24 flex items-center justify-center border-2 border-dashed border-gray-300/30 rounded-xl m-2">
                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Boş</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>

        {/* Select Animal Modal */}
        <Modal isOpen={isSelectModalOpen} onClose={() => setIsSelectModalOpen(false)} title="Kesim Sırasına Ekle">
            <div className="space-y-4">
                <input 
                    autoFocus
                    type="text" 
                    placeholder="Küpe No Ara..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full p-4 bg-gray-50 dark:bg-gray-800 border-none rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-lg font-bold"
                />
                <div className="max-h-[60vh] overflow-y-auto space-y-2">
                    {barnAnimals.length === 0 ? (
                        <p className="text-center text-gray-500 py-8">Ahırda bekleyen hayvan bulunamadı.</p>
                    ) : (
                        barnAnimals.map(animal => (
                            <div key={animal.id} className="flex items-center justify-between p-4 bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-xl shadow-sm hover:border-indigo-500 transition-colors group">
                                <div>
                                    <div className="text-xl font-bold dark:text-white">#{animal.tag_number}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-300">{animal.type} • {animal.shares?.length || 0} Hissedar</div>
                                </div>
                                <button 
                                    onClick={() => handleAddToQueue(animal.id)}
                                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform"
                                >
                                    Seç
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </Modal>
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
