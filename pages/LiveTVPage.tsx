
import React, { useEffect, useState, useRef } from 'react';
import { Animal, SlaughterStatus, AppSettings } from '../types';
import { animalService, configService } from '../services/supabaseService';

interface AlertState {
    animal: Animal;
    status: SlaughterStatus;
    title: string;
    message: string;
}

const LiveTVPage = () => {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [announcement, setAnnouncement] = useState('');
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [activeAlert, setActiveAlert] = useState<AlertState | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  
  const prevStatuses = useRef<Map<string, SlaughterStatus>>(new Map());
  const lastAnnouncementTime = useRef<string>('');
  const isFirstLoad = useRef(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2000); 
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
        const appSettings = await configService.getSettings();
        setSettings(appSettings);
        
        // Announcement Check
        if (appSettings.active_announcement && appSettings.announcement_timestamp) {
            if (appSettings.announcement_timestamp !== lastAnnouncementTime.current) {
                lastAnnouncementTime.current = appSettings.announcement_timestamp;
                setAnnouncement(appSettings.active_announcement);
                setShowAnnouncement(true);
                if (audioEnabled) playTone('bell', appSettings); 
                const duration = (appSettings.announcement_duration_sec || 60) * 1000;
                setTimeout(() => setShowAnnouncement(false), duration);
            }
        }

        const years = await configService.getYears();
        const data = await animalService.getAll(years[0]);
        setAnimals(data);
        
        checkChanges(data, appSettings);
        isFirstLoad.current = false;
    } catch (e) { console.error(e); }
  };

  const checkChanges = (data: Animal[], currentSettings: AppSettings) => {
      const currentStatusMap = new Map();
      data.forEach(a => currentStatusMap.set(a.id, a.slaughter_status));

      if (isFirstLoad.current) {
          prevStatuses.current = currentStatusMap;
          return;
      }

      for (const animal of data) {
          const oldStatus = prevStatuses.current.get(animal.id);
          const newStatus = animal.slaughter_status;

          if (oldStatus && oldStatus !== newStatus && newStatus !== SlaughterStatus.Barn) {
              let title = "GÜNCELLEME";
              let message = "";
              let soundType = currentSettings.notification_sound || 'ding';

              switch (newStatus) {
                  case SlaughterStatus.Pending: title = "SIRADA"; message = "Sıraya alındı"; break;
                  case SlaughterStatus.Cut: title = "KESİLDİ"; message = "Kesim tamamlandı"; soundType = 'gong'; break;
                  case SlaughterStatus.Chopping: title = "PARÇALAMA"; message = "Parçalanıyor"; soundType = 'horn'; break;
                  case SlaughterStatus.Sharing: title = "PAYLAMA"; message = "Pay ediliyor"; soundType = 'whistle'; break;
                  case SlaughterStatus.Delivered: title = "TESLİM"; message = "Teslim edildi"; soundType = 'bell'; break;
              }

              setActiveAlert({ animal, status: newStatus, title, message });
              
              if (audioEnabled) {
                  playTone(soundType, currentSettings);
                  setTimeout(() => speak(message), 800);
              }
              
              setTimeout(() => setActiveAlert(null), 8000);
              break; 
          }
      }
      prevStatuses.current = currentStatusMap;
  };

  const playTone = (type: string, currentSettings?: AppSettings) => {
      if (currentSettings?.notification_sound === 'custom' && currentSettings.custom_sound_url) {
          const audio = new Audio(currentSettings.custom_sound_url);
          audio.play().catch(() => {});
          return;
      }
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      const now = ctx.currentTime;
      
      // Simple tone logic based on types (simplified for brevity)
      osc.frequency.setValueAtTime(type === 'gong' ? 100 : 800, now);
      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1);
      osc.start(now);
      osc.stop(now + 1);
  };

  const speak = (msg: string) => {
      const u = new SpeechSynthesisUtterance(msg);
      u.lang = 'tr-TR';
      window.speechSynthesis.speak(u);
  };

  const getSortedAnimals = (status: SlaughterStatus) => {
      return animals.filter(a => a.slaughter_status === status).sort((a, b) => {
            const timeA = new Date(a.updated_at || a.created_at || 0).getTime();
            const timeB = new Date(b.updated_at || b.created_at || 0).getTime();
            if (status === SlaughterStatus.Pending) return timeA - timeB; 
            return timeA - timeB;
      });
  };

  if (!audioEnabled) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-black text-white font-sans">
               <div className="text-center space-y-8 animate-in fade-in zoom-in duration-500">
                  <h1 className="text-8xl font-black tracking-tighter">CANLI TAKİP</h1>
                  <button onClick={() => setAudioEnabled(true)} className="border border-white/20 hover:bg-white hover:text-black px-12 py-4 rounded-full text-xl font-bold transition-all tracking-widest uppercase">
                      Yayını Başlat
                  </button>
               </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans overflow-hidden flex flex-col relative selection:bg-white selection:text-black">
      {/* Minimal Header */}
      <div className="h-20 flex justify-between items-center px-8 border-b border-white/10 shrink-0">
         <div className="flex items-center gap-4">
             <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
             <h1 className="text-2xl font-bold tracking-widest uppercase">{settings?.site_title || 'KURBAN'}</h1>
         </div>
         <div className="font-mono text-xl text-gray-400">
             {new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
         </div>
      </div>

      {/* Main Grid */}
      <div className="flex-1 p-6 grid grid-cols-5 gap-px bg-white/5">
         <TVColumn title="SIRA" items={getSortedAnimals(SlaughterStatus.Pending)} />
         <TVColumn title="KESİM" items={getSortedAnimals(SlaughterStatus.Cut)} highlight />
         <TVColumn title="PARÇALAMA" items={getSortedAnimals(SlaughterStatus.Chopping)} />
         <TVColumn title="PAYLAMA" items={getSortedAnimals(SlaughterStatus.Sharing)} />
         <TVColumn title="TESLİM" items={getSortedAnimals(SlaughterStatus.Delivered)} />
      </div>

      {/* Ticker */}
      {showAnnouncement && (
          <div className="absolute bottom-10 left-0 right-0 bg-white text-black py-4 z-50 overflow-hidden transform -rotate-1 shadow-2xl">
             <div className="animate-marquee whitespace-nowrap text-5xl font-black uppercase tracking-tight">
                 {announcement} &nbsp;&nbsp;&nbsp;&nbsp; {announcement} &nbsp;&nbsp;&nbsp;&nbsp; {announcement}
             </div>
          </div>
      )}

      {/* Alert Overlay */}
      {activeAlert && (
          <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center animate-in fade-in duration-300">
              <div className="w-full max-w-7xl p-8 flex flex-col md:flex-row gap-12 items-center justify-center">
                   {/* Left: Tag Info */}
                   <div className="text-center md:text-left space-y-4">
                       <div className="inline-block bg-white text-black px-6 py-2 text-2xl font-bold uppercase tracking-widest mb-4">
                           {activeAlert.title}
                       </div>
                       <h1 className="text-[180px] font-black leading-none tracking-tighter text-white">
                           #{activeAlert.animal.tag_number}
                       </h1>
                   </div>

                   {/* Right: Shareholders */}
                   <div className="flex-1 border-l border-white/20 pl-12">
                       <h3 className="text-gray-500 font-bold uppercase tracking-[0.3em] mb-8 text-xl">Hissedarlar</h3>
                       <div className="flex flex-wrap gap-4">
                           {activeAlert.animal.shares && activeAlert.animal.shares.length > 0 ? (
                               activeAlert.animal.shares.map((s, i) => (
                                   <div key={i} className="text-4xl font-bold text-gray-300 leading-relaxed">
                                       {s.name} <span className="text-gray-700 mx-2">•</span>
                                   </div>
                               ))
                           ) : <span className="text-gray-600 italic">...</span>}
                       </div>
                   </div>
              </div>
          </div>
      )}
      <style>{`
        @keyframes marquee { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }
        .animate-marquee { animation: marquee 20s linear infinite; }
      `}</style>
    </div>
  );
};

const TVColumn = ({ title, items, highlight }: any) => (
    <div className={`h-full flex flex-col bg-[#0a0a0a] ${highlight ? 'bg-[#0f0f0f]' : ''}`}>
        <div className="p-6 border-b border-white/10">
            <h2 className={`text-xl font-bold uppercase tracking-[0.2em] text-center ${highlight ? 'text-white' : 'text-gray-500'}`}>
                {title} <span className="ml-2 text-sm text-gray-700">({items.length})</span>
            </h2>
        </div>
        <div className="flex-1 p-4 space-y-4 overflow-y-auto overflow-x-hidden">
            {items.map((item: Animal) => (
                <div key={item.id} className="bg-[#111] p-6 border-l-4 border-white/10 hover:border-white transition-all animate-in slide-in-from-bottom-4 fade-in duration-500">
                    <div className="text-6xl font-black tracking-tighter text-white">#{item.tag_number}</div>
                    {item.type && <div className="text-gray-600 text-xs uppercase font-bold mt-2 tracking-widest">{item.type}</div>}
                </div>
            ))}
        </div>
    </div>
);

export default LiveTVPage;
