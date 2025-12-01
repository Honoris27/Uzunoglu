
import React, { useState, useEffect } from 'react';
import { Animal, SlaughterStatus } from '../types';
import { animalService, configService } from '../services/supabaseService';

interface Props {
  animals: Animal[];
  refresh: () => void;
}

const SlaughterhousePage: React.FC<Props> = ({ animals, refresh }) => {
  const [announcement, setAnnouncement] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
     configService.getSettings().then(s => {
         if(s.active_announcement) setAnnouncement(s.active_announcement);
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
          await configService.updateSettings({ active_announcement: announcement });
          alert("Duyuru ekrana gönderildi.");
      } catch(e) { alert("Hata"); }
      setLoading(false);
  };

  const columns = [
      { id: SlaughterStatus.Pending, label: 'KESİM YOLU / SIRA', color: 'bg-gray-200 text-gray-800' },
      { id: SlaughterStatus.Cut, label: 'KESİLDİ', color: 'bg-red-600 text-white' },
      { id: SlaughterStatus.Chopping, label: 'PARÇALANIYOR', color: 'bg-orange-500 text-white' },
      { id: SlaughterStatus.Sharing, label: 'PAY EDİLİYOR', color: 'bg-yellow-500 text-white' },
      { id: SlaughterStatus.Delivered, label: 'TESLİM EDİLDİ', color: 'bg-green-600 text-white' }
  ];

  return (
    <div className="pb-10">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold dark:text-white">Kesimhane Yönetimi</h2>
            <button
               onClick={() => window.open(window.location.href.split('?')[0] + '?mode=tv', '_blank')}
               className="bg-purple-600 text-white px-6 py-2 rounded-lg font-bold shadow-lg hover:bg-purple-700 flex items-center gap-2"
            >
                📺 TV Yayınını Başlat
            </button>
        </div>

        {/* Announcement Section */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm mb-8 flex gap-4 items-center">
            <div className="flex-1">
                <label className="text-xs font-bold uppercase text-gray-500 mb-1 block">TV Duyuru Paneli</label>
                <input 
                    type="text" 
                    value={announcement}
                    onChange={e => setAnnouncement(e.target.value)}
                    placeholder="Ekranda görünecek duyuru metnini giriniz (Örn: Öğle molası 1 saattir)"
                    className="w-full border p-2 rounded dark:bg-gray-700 dark:text-white"
                />
            </div>
            <button 
                onClick={updateAnnouncement}
                disabled={loading}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 h-full mt-5"
            >
                {loading ? '...' : 'YAYINLA'}
            </button>
        </div>

        {/* Board */}
        <div className="grid grid-cols-5 gap-4 overflow-x-auto min-w-[1000px]">
            {columns.map(col => (
                <div key={col.id} className="flex flex-col h-[calc(100vh-250px)] bg-gray-50 dark:bg-gray-800/50 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                    <div className={`${col.color} p-3 text-center font-bold text-sm tracking-wide shadow-sm z-10`}>
                        {col.label}
                    </div>
                    <div className="flex-1 p-2 overflow-y-auto space-y-2">
                        {animals.filter(a => a.slaughter_status === col.id).map(animal => (
                            <div key={animal.id} className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-100 dark:border-gray-600 hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-lg font-black dark:text-white">#{animal.tag_number}</span>
                                    <span className="text-xs bg-gray-100 dark:bg-gray-700 px-1 rounded">{animal.type}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-1 mt-2">
                                    {/* Navigation Buttons */}
                                    {col.id !== SlaughterStatus.Pending && (
                                        <button 
                                            onClick={() => handleUpdateStatus(animal.id, getPrevStatus(col.id))}
                                            className="bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs py-1 rounded"
                                        >
                                            &lt; Geri
                                        </button>
                                    )}
                                    {col.id !== SlaughterStatus.Delivered && (
                                        <button 
                                            onClick={() => handleUpdateStatus(animal.id, getNextStatus(col.id))}
                                            className={`text-white text-xs py-1 rounded col-span-${col.id === SlaughterStatus.Pending ? '2' : '1'} bg-blue-600 hover:bg-blue-700`}
                                        >
                                            İleri &gt;
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
