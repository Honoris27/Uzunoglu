
import React, { useEffect, useState } from 'react';
import { Animal, SlaughterStatus } from '../types';
import { animalService, configService } from '../services/supabaseService';

const LiveTVPage = () => {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [lastAnnounced, setLastAnnounced] = useState<string | null>(null);

  useEffect(() => {
    // Initial fetch
    fetchData();

    // Polling every 5 seconds
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
        // Assume current year for live tracking or fetch latest active
        const years = await configService.getYears();
        const currentYear = years[0]; 
        const data = await animalService.getAll(currentYear);
        setAnimals(data);
        checkAnnouncements(data);
    } catch (e) {
        console.error("Live fetch error", e);
    }
  };

  const checkAnnouncements = (data: Animal[]) => {
      // Find the most recently updated status (Simulated logic: find one in 'Cutting' that wasn't announced)
      // Since Supabase realtime isn't set up, we just check simple state changes or just announce 'Next'
      
      const cutting = data.filter(a => a.slaughter_status === SlaughterStatus.Cutting);
      if (cutting.length > 0) {
          const target = cutting[0];
          const msg = `Dikkat, Küpe numarası ${target.tag_number}. Kesime giriyor.`;
          
          if (lastAnnounced !== target.tag_number) {
             speak(msg);
             setLastAnnounced(target.tag_number);
          }
      }
  };

  const speak = (text: string) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'tr-TR';
      window.speechSynthesis.speak(utterance);
  };

  const filterByStatus = (status: SlaughterStatus) => animals.filter(a => a.slaughter_status === status);

  return (
    <div className="min-h-screen bg-black text-white p-4 font-sans">
      <div className="text-center border-b border-gray-800 pb-4 mb-4 flex justify-between items-center">
         <h1 className="text-4xl font-bold text-primary-500">KURBAN TAKİP EKRANI</h1>
         <div className="text-2xl text-gray-400">{new Date().toLocaleTimeString()}</div>
      </div>

      <div className="grid grid-cols-4 gap-4 h-[calc(100vh-120px)]">
         <StatusColumn title="SIRA BEKLİYOR" color="bg-gray-800" items={filterByStatus(SlaughterStatus.Pending)} />
         <StatusColumn title="KESİMDE" color="bg-red-900" items={filterByStatus(SlaughterStatus.Cutting)} animate />
         <StatusColumn title="PARÇALAMA" color="bg-orange-800" items={filterByStatus(SlaughterStatus.Chopping)} />
         <StatusColumn title="PAKETLEME / TESLİM" color="bg-green-900" items={filterByStatus(SlaughterStatus.Packing)} />
      </div>
    </div>
  );
};

const StatusColumn = ({ title, color, items, animate }: any) => (
    <div className={`rounded-xl overflow-hidden flex flex-col ${color} border border-gray-700`}>
        <div className="p-4 bg-black/20 text-center font-bold text-2xl tracking-wider border-b border-white/10">
            {title}
        </div>
        <div className="p-4 space-y-3 overflow-y-auto flex-1">
            {items.map((item: Animal) => (
                <div key={item.id} className={`p-4 bg-white/10 rounded-lg backdrop-blur-sm border border-white/5 ${animate ? 'animate-pulse' : ''}`}>
                    <div className="text-3xl font-bold text-center">#{item.tag_number}</div>
                    <div className="text-center text-sm opacity-70 mt-1">{item.shares?.map(s => s.name).join(', ').substring(0, 30)}...</div>
                </div>
            ))}
        </div>
    </div>
);

export default LiveTVPage;
