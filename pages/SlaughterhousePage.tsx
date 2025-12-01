
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
          alert("Duyuru yayınlandı.");
      } catch(e) { alert("Hata"); }
      setLoading(false);
  };

  const barnAnimals = useMemo(() => {
      return animals.filter(a => a.slaughter_status === SlaughterStatus.Barn || !a.slaughter_status)
        .filter(a => a.tag_number.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [animals, searchTerm]);

  const columns = [
      { id: SlaughterStatus.Pending, label: 'SIRA', color: 'indigo' },
      { id: SlaughterStatus.Cut, label: 'KESİM', color: 'rose' },
      { id: SlaughterStatus.Chopping, label: 'PARÇALAMA', color: 'orange' },
      { id: SlaughterStatus.Sharing, label: 'PAYLAMA', color: 'amber' },
      { id: SlaughterStatus.Delivered, label: 'TESLİM', color: 'emerald' }
  ];

  const getSortedAnimals = (status: SlaughterStatus) => {
      return animals
        .filter(a => a.slaughter_status === status)
        .sort((a, b) => {
            const timeA = new Date(a.updated_at || a.created_at || 0).getTime();
            const timeB = new Date(b.updated_at || b.created_at || 0).getTime();
            if (status === SlaughterStatus.Pending) return timeA - timeB; 
            return timeA - timeB;
        });
  };

  const getStatusColor = (color: string) => {
      const map: any = {
          indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-800',
          rose: 'bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800',
          orange: 'bg-orange-50 text-orange-700 border-orange-100 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800',
          amber: 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800',
          emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800'
      };
      return map[color];
  };

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col font-sans">
        {/* Header Section */}
        <div className="flex justify-between items-center mb-6 px-1">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Kesimhane Paneli</h2>
            
            <div className="flex gap-3">
                <button
                    onClick={() => setIsSelectModalOpen(true)}
                    className="bg-gray-900 dark:bg-white dark:text-gray-900 text-white px-5 py-2.5 rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity flex items-center gap-2"
                >
                    <span>+</span> Sıraya Ekle
                </button>
                <button
                    onClick={() => window.open(window.location.href.split('?')[0] + '?mode=tv', '_blank')}
                    className="bg-red-600 text-white px-5 py-2.5 rounded-lg font-semibold text-sm hover:bg-red-700 transition-colors flex items-center gap-2 shadow-sm"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    Canlı Yayın
                </button>
            </div>
        </div>

        {/* Minimal Announcement Bar */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border border-gray-100 dark:border-gray-700 mb-6 flex items-center gap-3">
            <div className="pl-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Duyuru</div>
            <div className="h-4 w-px bg-gray-200 dark:bg-gray-700"></div>
            <input 
                type="text" 
                value={announcement}
                onChange={e => setAnnouncement(e.target.value)}
                placeholder="Ekranda görünecek mesaj..."
                className="flex-1 bg-transparent border-none text-sm text-gray-800 dark:text-white placeholder-gray-400 outline-none"
            />
            <div className="flex items-center gap-2 border-l border-gray-200 dark:border-gray-700 pl-3">
                <input 
                    type="number" 
                    value={duration}
                    onChange={e => setDuration(e.target.value)}
                    className="w-12 bg-transparent text-center text-sm font-bold outline-none dark:text-white"
                />
                <span className="text-[10px] text-gray-400 font-bold">SN</span>
            </div>
            <button 
                onClick={updateAnnouncement}
                disabled={loading}
                className="text-xs font-bold bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 px-4 py-2 rounded-lg transition-colors"
            >
                YAYINLA
            </button>
        </div>

        {/* Minimal Kanban */}
        <div className="flex-1 overflow-x-auto pb-2">
            <div className="flex gap-4 min-w-[1200px] h-full">
                {columns.map(col => {
                    const colAnimals = getSortedAnimals(col.id);
                    return (
                        <div key={col.id} className="flex-1 flex flex-col bg-gray-50/50 dark:bg-gray-800/30 rounded-xl border border-gray-200/60 dark:border-gray-700/60">
                            {/* Column Header */}
                            <div className={`p-4 flex justify-between items-center border-b border-gray-100 dark:border-gray-700/50`}>
                                <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${col.color === 'indigo' ? 'bg-indigo-500' : col.color === 'rose' ? 'bg-rose-500' : col.color === 'orange' ? 'bg-orange-500' : col.color === 'amber' ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                                    <span className="font-bold text-xs text-gray-600 dark:text-gray-300 tracking-wide">{col.label}</span>
                                </div>
                                <span className="text-[10px] font-bold text-gray-400 bg-white dark:bg-gray-800 px-2 py-0.5 rounded-full border border-gray-100 dark:border-gray-700">
                                    {colAnimals.length}
                                </span>
                            </div>

                            {/* Cards Area */}
                            <div className="flex-1 p-3 overflow-y-auto custom-scrollbar space-y-3">
                                {colAnimals.map((animal, idx) => (
                                    <div key={animal.id} className="group bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-500 transition-all">
                                        <div className="flex justify-between items-start mb-3">
                                            <span className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">#{animal.tag_number}</span>
                                            <span className="text-[10px] text-gray-400 font-mono">#{idx + 1}</span>
                                        </div>
                                        
                                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-50 dark:border-gray-700/50">
                                            {col.id !== SlaughterStatus.Pending ? (
                                                <button 
                                                    onClick={() => handleUpdateStatus(animal.id, getPrevStatus(col.id))}
                                                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                                                    title="Geri"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                                </button>
                                            ) : <div></div>}

                                            {col.id !== SlaughterStatus.Delivered && (
                                                <button 
                                                    onClick={() => handleUpdateStatus(animal.id, getNextStatus(col.id))}
                                                    className="text-gray-900 dark:text-white hover:text-blue-600 transition-colors bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 p-1.5 rounded-md"
                                                    title="İlerle"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                
                                {colAnimals.length === 0 && (
                                    <div className="flex-1 flex items-center justify-center opacity-30 min-h-[100px]">
                                        <div className="w-12 h-1 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>

        <Modal isOpen={isSelectModalOpen} onClose={() => setIsSelectModalOpen(false)} title="Sıraya Ekle">
            <div className="space-y-4">
                <input 
                    autoFocus
                    type="text" 
                    placeholder="Küpe No Ara..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full p-3 bg-gray-50 dark:bg-gray-800 border-none rounded-lg outline-none focus:ring-1 focus:ring-gray-300 text-lg font-bold"
                />
                <div className="max-h-[50vh] overflow-y-auto space-y-2">
                    {barnAnimals.length === 0 ? (
                        <p className="text-center text-gray-500 py-6 text-sm">Bekleyen hayvan yok.</p>
                    ) : (
                        barnAnimals.map(animal => (
                            <div key={animal.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer" onClick={() => handleAddToQueue(animal.id)}>
                                <div>
                                    <div className="text-lg font-bold dark:text-white">#{animal.tag_number}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">{animal.type}</div>
                                </div>
                                <div className="w-8 h-8 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-full text-gray-500">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                </div>
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
