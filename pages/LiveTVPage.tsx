
import React, { useEffect, useState, useRef } from 'react';
import { Animal, SlaughterStatus, AppSettings } from '../types';
import { animalService, configService } from '../services/supabaseService';

interface AlertState {
    animal: Animal;
    status: SlaughterStatus;
    color: string;
    title: string;
}

const LiveTVPage = () => {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [announcement, setAnnouncement] = useState('');
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  
  // Alert State
  const [activeAlert, setActiveAlert] = useState<AlertState | null>(null);
  const prevStatuses = useRef<Map<string, SlaughterStatus>>(new Map());
  const lastAnnouncementTime = useRef<string>('');
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000); // Poll every 3 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
        const appSettings = await configService.getSettings();
        setSettings(appSettings);
        
        // Handle Announcement Logic
        if (appSettings.active_announcement && appSettings.announcement_timestamp) {
            // Check if it's a new announcement
            if (appSettings.announcement_timestamp !== lastAnnouncementTime.current) {
                lastAnnouncementTime.current = appSettings.announcement_timestamp;
                setAnnouncement(appSettings.active_announcement);
                setShowAnnouncement(true);
                
                if (audioEnabled) {
                    playTone('bell'); // Alert sound for announcement
                }

                // Hide after duration
                const duration = (appSettings.announcement_duration_sec || 60) * 1000;
                setTimeout(() => setShowAnnouncement(false), duration);
            }
        }

        const years = await configService.getYears();
        const currentYear = years[0]; 
        const data = await animalService.getAll(currentYear);
        setAnimals(data);
        
        checkChanges(data, appSettings);
        setIsFirstLoad(false);
    } catch (e) {
        console.error("Live fetch error", e);
    }
  };

  const checkChanges = (data: Animal[], currentSettings: AppSettings) => {
      if (isFirstLoad) {
          data.forEach(a => prevStatuses.current.set(a.id, a.slaughter_status));
          return;
      }

      for (const animal of data) {
          const oldStatus = prevStatuses.current.get(animal.id);
          const newStatus = animal.slaughter_status;

          if (oldStatus && oldStatus !== newStatus) {
              let title = "DURUM GÜNCELLENDİ";
              let color = "bg-gray-800";
              let soundType = currentSettings.notification_sound || 'ding';

              switch(newStatus) {
                  case SlaughterStatus.Cut:
                      title = "KESİM İŞLEMİ TAMAMLANDI";
                      color = "text-red-500 border-red-500";
                      break;
                  case SlaughterStatus.Chopping:
                      title = "PARÇALAMA BAŞLADI";
                      color = "text-orange-500 border-orange-500";
                      break;
                  case SlaughterStatus.Sharing:
                      title = "HİSSE PAYLAŞIMI";
                      color = "text-yellow-500 border-yellow-500";
                      break;
                  case SlaughterStatus.Delivered:
                      title = "TESLİMAT İÇİN HAZIR";
                      color = "text-green-500 border-green-500";
                      soundType = 'bell';
                      break;
              }

              if (!activeAlert) {
                setActiveAlert({ animal, status: newStatus, color, title });
                
                if (audioEnabled) {
                    playTone(soundType);
                    speak(animal.tag_number, title);
                }
                setTimeout(() => setActiveAlert(null), 8000);
              }
              prevStatuses.current.set(animal.id, newStatus);
              break; 
          }
          prevStatuses.current.set(animal.id, newStatus);
      }
  };

  const playTone = (type: string = 'ding') => {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      const now = ctx.currentTime;
      
      if (type === 'gong') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(100, now);
          osc.frequency.exponentialRampToValueAtTime(0.01, now + 2);
          gain.gain.setValueAtTime(1, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 2);
          osc.start(now);
          osc.stop(now + 2);
      } else if (type === 'bell') {
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(600, now);
          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.5, now + 0.1);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
          osc.start(now);
          osc.stop(now + 1.5);
      } else {
          // Ding
          osc.type = 'sine';
          osc.frequency.setValueAtTime(800, now);
          osc.frequency.exponentialRampToValueAtTime(400, now + 0.5);
          gain.gain.setValueAtTime(0.5, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
          osc.start(now);
          osc.stop(now + 0.5);
      }
  };

  const speak = (tag: string, action: string) => {
      const msg = `${tag} numaralı kurban. ${action.toLowerCase()}.`;
      const utterance = new SpeechSynthesisUtterance(msg);
      utterance.lang = 'tr-TR';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
  };

  const filterByStatus = (status: SlaughterStatus) => animals.filter(a => a.slaughter_status === status);

  if (!audioEnabled) {
      return (
          <div className="min-h-screen bg-black flex items-center justify-center text-white bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-800 via-gray-900 to-black">
              <button 
                onClick={() => setAudioEnabled(true)}
                className="bg-primary-600 hover:bg-primary-500 text-2xl font-bold px-12 py-6 rounded-2xl animate-pulse shadow-2xl shadow-primary-500/50"
              >
                  YAYINI BAŞLAT (TAM EKRAN)
              </button>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans overflow-hidden relative flex flex-col">
      
      {/* Header */}
      <div className="h-24 flex justify-between items-center px-8 border-b border-gray-800 bg-gray-900 z-10 shadow-lg">
         <div className="flex items-center gap-6">
            <div className="bg-primary-600 text-white font-black px-4 py-2 rounded text-lg tracking-wider shadow-lg shadow-primary-500/30">CANLI</div>
            <h1 className="text-4xl font-black text-gray-100 tracking-wide uppercase">{settings?.site_title || 'KURBAN TAKİP'}</h1>
         </div>
         <div className="flex items-center gap-4">
             <div className="text-sm text-gray-400 font-bold uppercase tracking-widest">Yerel Saat</div>
             <div className="text-5xl font-mono text-primary-400 font-bold drop-shadow-md">
                 {new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
             </div>
         </div>
      </div>

      {/* Main Board */}
      <div className="flex-1 p-4 grid grid-cols-5 gap-3 h-full overflow-hidden">
         <StatusColumn title="KESİM SIRA" color="from-gray-700 to-gray-800" borderColor="border-gray-600" items={filterByStatus(SlaughterStatus.Pending)} />
         <StatusColumn title="KESİLDİ" color="from-red-800 to-red-900" borderColor="border-red-600" items={filterByStatus(SlaughterStatus.Cut)} animate />
         <StatusColumn title="PARÇALAMA" color="from-orange-700 to-orange-800" borderColor="border-orange-500" items={filterByStatus(SlaughterStatus.Chopping)} />
         <StatusColumn title="PAYLAMA" color="from-yellow-700 to-yellow-800" borderColor="border-yellow-500" items={filterByStatus(SlaughterStatus.Sharing)} />
         <StatusColumn title="TESLİM" color="from-green-700 to-green-800" borderColor="border-green-500" items={filterByStatus(SlaughterStatus.Delivered)} />
      </div>

      {/* Scrolling Marquee Announcement */}
      {showAnnouncement && (
          <div className="absolute bottom-0 left-0 right-0 h-20 bg-blue-900 z-40 border-t-4 border-yellow-400 flex items-center shadow-2xl overflow-hidden">
             <div className="bg-yellow-400 text-black font-black px-6 h-full flex items-center z-20 shadow-xl text-xl uppercase tracking-widest shrink-0">
                 DUYURU
             </div>
             <div className="whitespace-nowrap w-full overflow-hidden flex items-center">
                 <div className="animate-marquee inline-block text-3xl font-bold text-white px-4">
                     {announcement}
                 </div>
                 {/* Duplicate for seamless loop effect visually, though standard marquee anim resets */}
                 <div className="animate-marquee inline-block text-3xl font-bold text-white px-4" aria-hidden="true">
                     {announcement}
                 </div>
             </div>
          </div>
      )}

      {/* ALERT POPUP */}
      {activeAlert && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in zoom-in duration-300 p-8">
              <div className={`bg-white text-black p-12 rounded-[3rem] shadow-2xl max-w-5xl w-full text-center border-[12px] ${activeAlert.color}`}>
                  <h2 className="text-6xl font-black text-gray-400 mb-6 uppercase tracking-tighter">{activeAlert.title}</h2>
                  <div className={`text-[160px] font-black leading-none mb-10 ${activeAlert.color.replace('border', 'text')}`}>
                      #{activeAlert.animal.tag_number}
                  </div>
                  <div className="bg-gray-100 p-8 rounded-2xl border-2 border-gray-200">
                      <h3 className="text-3xl font-bold text-gray-800 mb-6 border-b-2 border-gray-300 pb-4 tracking-widest uppercase">HİSSEDARLAR</h3>
                      <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-left">
                          {activeAlert.animal.shares?.map((s, i) => (
                              <div key={i} className="text-2xl font-bold text-gray-700 flex items-center gap-3">
                                  <span className="w-3 h-3 bg-gray-400 rounded-full"></span>
                                  {s.name}
                              </div>
                          ))}
                      </div>
                  </div>
              </div>
          </div>
      )}

      <style>{`
        @keyframes marquee {
            0% { transform: translateX(100%); }
            100% { transform: translateX(-100%); }
        }
        .animate-marquee {
            animation: marquee 15s linear infinite;
            min-width: 100%;
        }
      `}</style>
    </div>
  );
};

const StatusColumn = ({ title, color, borderColor, items, animate }: any) => (
    <div className={`rounded-2xl flex flex-col bg-gradient-to-b ${color} border-t-8 ${borderColor} h-full shadow-2xl overflow-hidden`}>
        <div className="p-4 bg-black/20 text-center font-black text-2xl tracking-tight text-white/90 uppercase border-b border-white/10">
            {title} <span className="text-lg opacity-60 ml-2 text-white/50">({items.length})</span>
        </div>
        <div className="p-3 space-y-3 overflow-y-auto flex-1 scrollbar-hide">
            {items.map((item: Animal) => (
                <div key={item.id} className={`p-4 bg-white text-black rounded-xl shadow-lg transform transition-all duration-500 flex flex-col items-center justify-center min-h-[100px] ${animate ? 'animate-pulse ring-4 ring-white/50' : ''}`}>
                    <div className="text-5xl font-black text-gray-900 tracking-tighter">#{item.tag_number}</div>
                    {item.type && <div className="mt-1 px-2 py-0.5 bg-gray-200 rounded text-xs font-bold uppercase tracking-wider text-gray-600">{item.type}</div>}
                </div>
            ))}
        </div>
    </div>
);

export default LiveTVPage;
