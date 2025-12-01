
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
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2000); // Faster polling (2s)
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
        const appSettings = await configService.getSettings();
        setSettings(appSettings);
        
        // Handle Announcement Logic
        if (appSettings.active_announcement && appSettings.announcement_timestamp) {
            if (appSettings.announcement_timestamp !== lastAnnouncementTime.current) {
                lastAnnouncementTime.current = appSettings.announcement_timestamp;
                setAnnouncement(appSettings.active_announcement);
                setShowAnnouncement(true);
                
                if (audioEnabled) {
                    playTone('bell', appSettings); 
                }

                const duration = (appSettings.announcement_duration_sec || 60) * 1000;
                setTimeout(() => setShowAnnouncement(false), duration);
            }
        }

        const years = await configService.getYears();
        const currentYear = years[0]; 
        const data = await animalService.getAll(currentYear);
        
        // Sort data based on updated_at
        setAnimals(data);
        setLastUpdated(new Date());
        
        checkChanges(data, appSettings);
        setIsFirstLoad(false);
    } catch (e) {
        console.error("Live fetch error", e);
    }
  };

  const checkChanges = (data: Animal[], currentSettings: AppSettings) => {
      const currentStatusMap = new Map();
      data.forEach(a => currentStatusMap.set(a.id, a.slaughter_status));

      if (isFirstLoad) {
          prevStatuses.current = currentStatusMap;
          return;
      }

      for (const animal of data) {
          const oldStatus = prevStatuses.current.get(animal.id);
          const newStatus = animal.slaughter_status;

          // Detect change (excluding Pending if it was just created/loaded)
          if (oldStatus && oldStatus !== newStatus) {
              
              let title = "DURUM GÜNCELLENDİ";
              let color = "bg-slate-800";
              let soundType = currentSettings.notification_sound || 'ding';

              // Specific Logic for CUTTING (KESİLDI)
              if (newStatus === SlaughterStatus.Cut) {
                  title = "KESİM TAMAMLANDI";
                  color = "bg-red-600";
                  soundType = 'gong'; 
              } else if (newStatus === SlaughterStatus.Chopping) {
                  title = "PARÇALAMA BAŞLADI";
                  color = "bg-orange-600";
                  soundType = 'horn';
              } else if (newStatus === SlaughterStatus.Sharing) {
                  title = "HİSSE PAYLAŞIMI";
                  color = "bg-yellow-500";
                  soundType = 'whistle';
              } else if (newStatus === SlaughterStatus.Delivered) {
                  title = "TESLİM EDİLİYOR";
                  color = "bg-emerald-600";
                  soundType = 'bell'; 
              }

              if (newStatus !== SlaughterStatus.Pending) {
                  setActiveAlert({ animal, status: newStatus, color: color, title });
                  
                  if (audioEnabled) {
                      playTone(soundType, currentSettings);
                      // Slight delay for speech to not overlap with chime
                      setTimeout(() => speak(animal.tag_number, title), 1000);
                  }
                  
                  // Auto close alert after 8 seconds
                  setTimeout(() => setActiveAlert(null), 8000);
              }
              break; 
          }
      }
      
      prevStatuses.current = currentStatusMap;
  };

  const playTone = (type: string = 'ding', currentSettings?: AppSettings) => {
      if (currentSettings?.notification_sound === 'custom' && currentSettings.custom_sound_url) {
          const audio = new Audio(currentSettings.custom_sound_url);
          audio.volume = 1.0;
          audio.play().catch(e => console.error("Custom Audio Play Error:", e));
          return;
      }

      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      const now = ctx.currentTime;
      
      if (type === 'gong') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(100, now);
          osc.frequency.exponentialRampToValueAtTime(40, now + 1.5);
          gain.gain.setValueAtTime(1, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);
          osc.start(now);
          osc.stop(now + 2.5);
      } else if (type === 'bell') {
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(600, now);
          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.5, now + 0.1);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
          osc.start(now);
          osc.stop(now + 1.5);
      } else if (type === 'siren') {
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(400, now);
          osc.frequency.linearRampToValueAtTime(800, now + 0.5);
          osc.frequency.linearRampToValueAtTime(400, now + 1.0);
          gain.gain.setValueAtTime(0.2, now);
          osc.start(now);
          osc.stop(now + 1.0);
      } else if (type === 'horn') {
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(150, now);
          gain.gain.setValueAtTime(0.3, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
          osc.start(now);
          osc.stop(now + 0.8);
      } else if (type === 'whistle') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(1200, now);
          osc.frequency.linearRampToValueAtTime(1000, now + 0.1);
          osc.frequency.linearRampToValueAtTime(1200, now + 0.3);
          gain.gain.setValueAtTime(0.2, now);
          osc.start(now);
          osc.stop(now + 0.5);
      } else {
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

  const filterAndSortByStatus = (status: SlaughterStatus) => {
      return animals
        .filter(a => a.slaughter_status === status)
        .sort((a, b) => {
            const timeA = new Date(a.updated_at || a.created_at || 0).getTime();
            const timeB = new Date(b.updated_at || b.created_at || 0).getTime();
            return timeA - timeB; 
        });
  };

  if (!audioEnabled) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white relative overflow-hidden">
               <div className="z-10 text-center space-y-8 p-12 bg-slate-900 rounded-3xl border border-slate-700 shadow-2xl max-w-2xl mx-4 animate-in fade-in zoom-in duration-500">
                  <h1 className="text-5xl font-black mb-4 tracking-tight">KESİMHANE CANLI YAYIN</h1>
                  <p className="text-xl text-gray-300">Sesli bildirimleri etkinleştirmek için lütfen aşağıdaki butona tıklayın.</p>
                  <button 
                    onClick={() => setAudioEnabled(true)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-2xl font-bold px-12 py-6 rounded-2xl transition-all transform hover:scale-105 shadow-[0_0_50px_rgba(16,185,129,0.5)] flex items-center justify-center gap-4 w-full"
                  >
                      <svg className="w-10 h-10 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      BAŞLAT
                  </button>
               </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans overflow-hidden relative flex flex-col">
      
      {/* Broadcast Header */}
      <div className="h-24 flex justify-between items-center px-8 bg-slate-900 border-b border-slate-800 z-10 shadow-lg">
         <div className="flex items-center gap-6">
             <div className="flex flex-col items-center">
                <span className="text-xs font-bold text-red-500 tracking-[0.2em] mb-1 animate-pulse">● CANLI</span>
                <div className="bg-red-600 text-white font-black px-3 py-1 rounded text-xl border-2 border-red-500 shadow-[0_0_20px_rgba(220,38,38,0.5)]">
                    LIVE
                </div>
             </div>
             <div>
                <h1 className="text-4xl font-black text-white tracking-tighter uppercase">{settings?.site_title || 'KURBAN TAKİP'}</h1>
                <p className="text-sm text-slate-400 font-bold tracking-[0.5em] uppercase">Kesimhane Durum Ekranı</p>
             </div>
         </div>
         <div className="flex items-center gap-8">
             <div className="text-right hidden md:block">
                 <div className="text-6xl font-mono text-white font-bold tracking-tighter drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
                     {lastUpdated.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                 </div>
             </div>
         </div>
      </div>

      {/* Main Board - Pillars Layout */}
      <div className="flex-1 p-6 grid grid-cols-5 gap-6 h-full overflow-hidden bg-slate-950">
         <StatusColumn title="KESİM SIRA" color="bg-slate-900" borderColor="border-slate-700" titleColor="text-slate-300" items={filterAndSortByStatus(SlaughterStatus.Pending)} />
         <StatusColumn title="KESİLDİ" color="bg-red-950/30" borderColor="border-red-600" titleColor="text-red-500" glow="shadow-[0_0_30px_rgba(220,38,38,0.2)]" items={filterAndSortByStatus(SlaughterStatus.Cut)} animate />
         <StatusColumn title="PARÇALAMA" color="bg-orange-950/30" borderColor="border-orange-600" titleColor="text-orange-500" items={filterAndSortByStatus(SlaughterStatus.Chopping)} />
         <StatusColumn title="PAYLAMA" color="bg-yellow-950/30" borderColor="border-yellow-600" titleColor="text-yellow-500" items={filterAndSortByStatus(SlaughterStatus.Sharing)} />
         <StatusColumn title="TESLİM" color="bg-emerald-950/30" borderColor="border-emerald-600" titleColor="text-emerald-500" items={filterAndSortByStatus(SlaughterStatus.Delivered)} />
      </div>

      {/* Scrolling Marquee Announcement */}
      {showAnnouncement && (
          <div className="absolute bottom-16 left-0 right-0 h-24 bg-yellow-400 z-40 border-y-8 border-black flex items-center shadow-[0_0_50px_rgba(250,204,21,0.5)] overflow-hidden">
             <div className="bg-black text-yellow-400 font-black px-8 h-full flex items-center z-20 text-4xl uppercase tracking-widest shrink-0 -skew-x-12 -ml-6">
                 <span className="skew-x-12 ml-4">DUYURU</span>
             </div>
             <div className="whitespace-nowrap w-full overflow-hidden flex items-center relative">
                 <div className="animate-marquee inline-block text-5xl font-black text-black px-4 uppercase tracking-wide">
                     {announcement}
                 </div>
                 <div className="animate-marquee inline-block text-5xl font-black text-black px-4 uppercase tracking-wide" aria-hidden="true">
                     {announcement}
                 </div>
             </div>
          </div>
      )}

      {/* ALERT POPUP */}
      {activeAlert && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl animate-in fade-in zoom-in duration-300 p-8">
              <div className="relative w-full max-w-7xl">
                   {/* Alert Box */}
                  <div className={`relative bg-white text-black rounded-[3rem] shadow-[0_0_100px_rgba(255,255,255,0.3)] overflow-hidden border-8 border-white`}>
                      
                      {/* Header Strip */}
                      <div className={`${activeAlert.color} p-8 flex items-center justify-center relative overflow-hidden`}>
                          <div className="absolute inset-0 opacity-20 bg-repeat bg-[size:20px_20px] bg-[linear-gradient(45deg,#000_25%,transparent_25%,transparent_75%,#000_75%,#000),linear-gradient(45deg,#000_25%,transparent_25%,transparent_75%,#000_75%,#000)]"></div>
                          <span className="text-white text-7xl font-black uppercase tracking-widest drop-shadow-lg relative z-10 animate-pulse">{activeAlert.title}</span>
                      </div>

                      <div className="p-16 flex flex-col items-center">
                           {/* Tag Number */}
                          <div className="mb-16 transform scale-125">
                              <span className="block text-xl font-bold text-gray-400 uppercase tracking-[0.8em] text-center mb-4">KURBAN KÜPE NO</span>
                              <div className="text-[200px] font-black leading-none tracking-tighter text-slate-900 drop-shadow-xl">
                                  #{activeAlert.animal.tag_number}
                              </div>
                          </div>

                          {/* Shareholders */}
                          <div className="w-full">
                              <h3 className="text-2xl font-bold text-slate-400 mb-8 flex items-center justify-center gap-6 uppercase tracking-widest">
                                  <span className="h-px w-24 bg-slate-300"></span>
                                  Hissedarlar
                                  <span className="h-px w-24 bg-slate-300"></span>
                              </h3>
                              <div className="flex flex-wrap justify-center gap-4">
                                  {activeAlert.animal.shares && activeAlert.animal.shares.length > 0 ? (
                                      activeAlert.animal.shares.map((s, i) => (
                                        <div key={i} className="bg-slate-100 px-8 py-4 rounded-2xl shadow-sm border border-slate-200">
                                            <div className="text-3xl font-bold text-slate-800">{s.name}</div>
                                        </div>
                                      ))
                                  ) : (
                                      <div className="text-center text-gray-400 text-2xl italic py-4">...</div>
                                  )}
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      <style>{`
        @keyframes marquee {
            0% { transform: translateX(0); }
            100% { transform: translateX(-100%); }
        }
        .animate-marquee {
            animation: marquee 15s linear infinite;
            min-width: 100%;
            padding-right: 50vw;
        }
      `}</style>
    </div>
  );
};

const StatusColumn = ({ title, color, borderColor, titleColor, items, animate, glow }: any) => (
    <div className={`flex flex-col ${color} rounded-2xl border-t-8 ${borderColor} h-full shadow-2xl overflow-hidden relative ${glow || ''}`}>
        <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none"></div>
        <div className={`p-6 text-center font-black text-2xl tracking-widest uppercase border-b border-white/10 ${titleColor}`}>
            {title}
        </div>
        <div className="flex-1 p-4 space-y-4 overflow-y-auto scrollbar-hide flex flex-col justify-start">
            {items.map((item: Animal) => (
                <div key={item.id} className={`p-6 bg-white rounded-xl shadow-lg transform transition-all duration-500 flex flex-col items-center justify-center min-h-[140px] relative overflow-hidden group ${animate ? 'animate-pulse ring-4 ring-white/50' : ''}`}>
                    <div className="text-7xl font-black text-slate-900 tracking-tighter z-10">#{item.tag_number}</div>
                    {item.type && <div className="mt-2 px-3 py-1 bg-slate-200 rounded text-xs font-bold uppercase tracking-wider text-slate-600 z-10">{item.type}</div>}
                </div>
            ))}
        </div>
        <div className="p-2 text-center text-xs font-mono text-white/20 bg-black/20">
            TOPLAM: {items.length}
        </div>
    </div>
);

export default LiveTVPage;
