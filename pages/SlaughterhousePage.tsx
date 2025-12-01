
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
      { id: SlaughterStatus.Pending, label: 'SIRA', bg: 'bg-white' },
      { id: SlaughterStatus.Cut, label: 'KESİM', bg: 'bg-red-50' },
      { id: SlaughterStatus.Chopping, label: 'PARÇALAMA', bg: 'bg-orange-50' },
      { id: SlaughterStatus.Sharing, label: 'PAYLAMA', bg: 'bg-blue-50' },
      { id: SlaughterStatus.Delivered, label: 'TESLİM', bg: 'bg-green-50' }
  ];

  const getSortedAnimals = (status: SlaughterStatus) => {
      return animals
        .filter(a => a.slaughter_status === status)
        .sort((a, b) => {
            const timeA = new Date(a.updated_at || a.created_at || 0).getTime();
            const timeB = new Date(b.updated_at || b.created_at || 0).getTime();
            return timeA - timeB;
        });
  };

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col font-sans">
        {/* Header Section */}
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Kesimhane Yönetimi</h2>
            
            <div className="flex gap-3">
                <button
                    onClick={() => setIsSelectModalOpen(true)}
                    className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors shadow-blue-200 shadow-lg flex items-center gap-2"
                >
                    <span>+</span> Sıraya Ekle
                </button>
                <button
                    onClick={() => window.open(window.location.href.split('?')[0] + '?mode=tv', '_blank')}
                    className="bg-slate-800 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-slate-900 transition-colors flex items-center gap-2 shadow-lg"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    Canlı Yayın Ekranı
                </button>
            </div>
        </div>

        {/* Minimal Announcement Bar */}
        <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-200 mb-6 flex items-center gap-3">
            <div className="pl-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Duyuru</div>
            <div className="h-4 w-px bg-slate-200"></div>
            <input 
                type="text" 
                value={announcement}
                onChange={e => setAnnouncement(e.target.value)}
                placeholder="Ekranda görünecek mesaj..."
                className="flex-1 bg-transparent border-none text-sm text-slate-800 placeholder-slate-400 outline-none font-medium"
            />
            <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
                <input 
                    type="number" 
                    value={duration}
                    onChange={e => setDuration(e.target.value)}
                    className="w-12 bg-transparent text-center text-sm font-bold outline-none text-blue-600"
                />
                <span className="text-[10px] text-slate-400 font-bold">SN</span>
            </div>
            <button 
                onClick={updateAnnouncement}
                disabled={loading}
                className="text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 px-4 py-2 rounded-lg transition-colors border border-blue-100"
            >
                YAYINLA
            </button>
        </div>

        {/* Minimal Kanban */}
        <div className="flex-1 overflow-x-auto pb-4">
            <div className="flex gap-4 min-w-[1200px] h-full">
                {columns.map(col => {
                    const colAnimals = getSortedAnimals(col.id);
                    return (
                        <div key={col.id} className={`flex-1 flex flex-col rounded-2xl border border-slate-200 overflow-hidden ${col.bg}`}>
                            {/* Column Header */}
                            <div className="p-4 flex justify-between items-center border-b border-slate-100/50 bg-white/50 backdrop-blur-sm">
                                <div className="font-bold text-xs text-slate-600 tracking-widest uppercase">{col.label}</div>
                                <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200 shadow-sm">
                                    {colAnimals.length}
                                </span>
                            </div>

                            {/* Cards Area */}
                            <div className="flex-1 p-3 overflow-y-auto custom-scrollbar space-y-3">
                                {colAnimals.map((animal, idx) => (
                                    <div key={animal.id} className="group bg-white p-4 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-all relative overflow-hidden">
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"></div>
                                        <div className="flex justify-between items-start mb-3 pl-2">
                                            <span className="text-xl font-black text-slate-800 tracking-tight">#{animal.tag_number}</span>
                                            <span className="text-[10px] text-slate-300 font-bold">#{idx + 1}</span>
                                        </div>
                                        
                                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-50 pl-2">
                                            {col.id !== SlaughterStatus.Pending ? (
                                                <button 
                                                    onClick={() => handleUpdateStatus(animal.id, getPrevStatus(col.id))}
                                                    className="text-slate-400 hover:text-slate-600 transition-colors"
                                                    title="Geri"
                                                >
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                                </button>
                                            ) : <div></div>}

                                            {col.id !== SlaughterStatus.Delivered && (
                                                <button 
                                                    onClick={() => handleUpdateStatus(animal.id, getNextStatus(col.id))}
                                                    className="bg-slate-50 text-slate-600 hover:bg-blue-50 hover:text-blue-600 p-2 rounded-lg transition-colors"
                                                    title="İlerle"
                                                >
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                
                                {colAnimals.length === 0 && (
                                    <div className="flex-1 flex items-center justify-center">
                                        <div className="text-slate-300 text-xs font-medium uppercase tracking-widest">Boş</div>
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
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-200 text-lg font-bold text-slate-800"
                />
                <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    {barnAnimals.length === 0 ? (
                        <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                             <p className="text-slate-400 text-sm font-medium">Ahırda bekleyen hayvan bulunamadı.</p>
                        </div>
                    ) : (
                        barnAnimals.map(animal => (
                            <div key={animal.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-xl hover:border-blue-300 hover:shadow-md cursor-pointer transition-all group" onClick={() => handleAddToQueue(animal.id)}>
                                <div>
                                    <div className="text-xl font-black text-slate-800 group-hover:text-blue-700">#{animal.tag_number}</div>
                                    <div className="text-xs text-slate-400 font-bold uppercase">{animal.type}</div>
                                </div>
                                <div className="w-10 h-10 flex items-center justify-center bg-slate-50 rounded-full text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
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
