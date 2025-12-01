
import React, { useEffect, useState, useRef } from 'react';
import { Animal, SlaughterStatus } from '../types';
import { animalService, configService } from '../services/supabaseService';

const LiveTVPage = () => {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [lastCuttingTag, setLastCuttingTag] = useState<string | null>(null);
  
  // Use a ref to prevent re-triggering sound on re-renders unless data changes specifically
  const cuttingRef = useRef<string | null>(null);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
        const years = await configService.getYears();
        const currentYear = years[0]; 
        const data = await animalService.getAll(currentYear);
        setAnimals(data);
        checkAlerts(data);
    } catch (e) {
        console.error("Live fetch error", e);
    }
  };

  const checkAlerts = (data: Animal[]) => {
      // Find the latest animal in cutting status
      // In a real app, we would sort by updated_at. Here we take the first one found or need a better heuristic.
      // Assuming 'data' is sorted by created_at desc, we might need to rely on client state tracking.
      
      const cuttingAnimals = data.filter(a => a.slaughter_status === SlaughterStatus.Cutting);
      
      if (cuttingAnimals.length > 0) {
          // Check if the top one (or any) is different from the last one we announced
          // For simplicity, we just check the first one in the list (assuming it's the active one)
          const currentTag = cuttingAnimals[0].tag_number;

          if (currentTag !== cuttingRef.current) {
             playAlert(currentTag);
             cuttingRef.current = currentTag;
          }
      }
  };

  const playAlert = (tag: string) => {
      // 1. Play Ding Sound (synthesized for browser compatibility)
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 600;
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);

      // 2. TTS
      setTimeout(() => {
          const msg = `Dikkat! ${tag} numaralı kurban kesime giriyor.`;
          const utterance = new SpeechSynthesisUtterance(msg);
          utterance.lang = 'tr-TR';
          utterance.rate = 0.9;
          window.speechSynthesis.speak(utterance);
      }, 600);
  };

  const filterByStatus = (status: SlaughterStatus) => animals.filter(a => a.slaughter_status === status);

  return (
    <div className="min-h-screen bg-black text-white p-4 font-sans overflow-hidden">
      <div className="text-center border-b border-gray-800 pb-4 mb-4 flex justify-between items-center px-8">
         <h1 className="text-4xl font-bold text-primary-500 tracking-widest">CANLI TAKİP</h1>
         <div className="text-3xl font-mono text-gray-400">{new Date().toLocaleTimeString()}</div>
      </div>

      <div className="grid grid-cols-4 gap-4 h-[calc(100vh-140px)]">
         <StatusColumn title="SIRA BEKLİYOR" color="bg-gray-800 border-gray-700" items={filterByStatus(SlaughterStatus.Pending)} />
         <StatusColumn title="KESİMDE" color="bg-red-900 border-red-700" items={filterByStatus(SlaughterStatus.Cutting)} animate />
         <StatusColumn title="PARÇALAMA" color="bg-orange-800 border-orange-700" items={filterByStatus(SlaughterStatus.Chopping)} />
         <StatusColumn title="PAKET / TESLİM" color="bg-green-900 border-green-700" items={filterByStatus(SlaughterStatus.Packing)} />
      </div>
    </div>
  );
};

const StatusColumn = ({ title, color, items, animate }: any) => (
    <div className={`rounded-2xl overflow-hidden flex flex-col ${color} border-2 shadow-2xl`}>
        <div className="p-5 bg-black/30 text-center font-black text-2xl tracking-widest border-b border-white/10 shadow-lg">
            {title}
        </div>
        <div className="p-4 space-y-4 overflow-y-auto flex-1 scrollbar-hide">
            {items.map((item: Animal) => (
                <div key={item.id} className={`p-6 bg-white/10 rounded-xl backdrop-blur-md border border-white/10 shadow-lg transform transition-all duration-500 ${animate ? 'animate-pulse ring-4 ring-red-500/50 scale-105' : 'hover:scale-105'}`}>
                    <div className="text-5xl font-black text-center text-white drop-shadow-md">#{item.tag_number}</div>
                    {item.shares && item.shares.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-white/10 text-center">
                             <div className="text-sm text-gray-300 font-medium">Hissedarlar</div>
                             <div className="text-xs text-gray-400 mt-1 line-clamp-2">
                                 {item.shares.map(s => s.name).join(', ')}
                             </div>
                        </div>
                    )}
                </div>
            ))}
            {items.length === 0 && (
                <div className="text-center text-white/20 mt-10 text-lg font-bold">BOŞ</div>
            )}
        </div>
    </div>
);

export default LiveTVPage;
