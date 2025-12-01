
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
        
        // Sort data based on updated_at for the lists
        setAnimals(data);
        setLastUpdated(new Date());
        
        checkChanges(data, appSettings);
        setIsFirstLoad(false);
    } catch (e) {
        console.error("Live fetch error", e);
    }
  };

  const checkChanges = (data: Animal[], currentSettings: AppSettings) => {
      // Create a map of current statuses for comparison
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
              let color = "bg-gray-800";
              let borderColor = "border-gray-600";
              let soundType = currentSettings.notification_sound || 'ding';

              switch(newStatus) {
                  case SlaughterStatus.Cut:
                      title = "KESİM TAMAMLANDI";
                      color = "bg-red-600";
                      borderColor = "border-red-400";
                      break;
                  case SlaughterStatus.Chopping:
                      title = "PARÇALANIYOR";
                      color = "bg-orange-600";
                      borderColor = "border-orange-400";
                      break;
                  case SlaughterStatus.Sharing:
                      title = "HİSSE PAYLAŞIMI";
                      color = "bg-yellow-500";
                      borderColor = "border-yellow-300";
                      break;
                  case SlaughterStatus.Delivered:
                      title = "TESLİM EDİLİYOR";
                      color = "bg-green-600";
                      borderColor = "border-green-400";
                      soundType = 'bell'; 
                      break;
              }

              // Trigger Alert if it's not a revert to pending
              if (newStatus !== SlaughterStatus.Pending) {
                  setActiveAlert({ animal, status: newStatus, color: color, title });
                  
                  if (audioEnabled) {
                      playTone(soundType, currentSettings);
                      // Slight delay for speech to not overlap with chime
                      setTimeout(() => speak(animal.tag_number, title, animal.shares), 500);
                  }
                  
                  // Auto close alert after 10 seconds
                  setTimeout(() => setActiveAlert(null), 10000);
              }
              break; // Handle one alert at a time to avoid chaos
          }
      }
      
      prevStatuses.current = currentStatusMap;
  };

  const playTone = (type: string = 'ding', currentSettings?: AppSettings) => {
      if (type === 'custom' && currentSettings?.custom_sound_url) {
          const audio = new Audio(currentSettings.custom_sound_url);
          audio.play().catch(e => console.error("Audio Play Error:", e));
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

  const speak = (tag: string, action: string, shares?: any[]) => {
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
            // Sort by Updated At ASCENDING (Oldest update first, Newest update last)
            // This ensures "En son gelen sona gelsin" (Last one comes to end)
            const timeA = new Date(a.updated_at || a.created_at || 0).getTime();
            const timeB = new Date(b.updated_at || b.created_at || 0).getTime();
            return timeA - timeB; 
        });
  };

  if (!audioEnabled) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white relative overflow-hidden">
               <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1541600383005-565c949cf777?q=80&w=2000&auto=format&fit=crop')] opacity-20 bg-cover bg-center"></div>
               <div className="z-10 text-center space-y-8 p-12 bg-black/50 backdrop-blur-md rounded-3xl border border-white/10 shadow-2xl max-w-2xl mx-4">
                  <h1 className="text-5xl font-bold mb-4">CANLI TAKİP SİSTEMİ</h1>
                  <p className="text-xl text-gray-300">Yayını başlatmak ve sesli bildirimleri açmak için butona tıklayınız.</p>
                  <button 
                    onClick={() => setAudioEnabled(true)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-2xl font-bold px-12 py-6 rounded-2xl transition-all transform hover:scale-105 shadow-[0_0_40px_rgba(16,185,129,0.5)] flex items-center justify-center gap-4 w-full"
                  >
                      <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      YAYINI BAŞLAT
                  </button>
               </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans overflow-hidden relative flex flex-col">
      
      {/* Modern Header */}
      <div className="h-24 flex justify-between items-center px-8 bg-slate-900/90 backdrop-blur-sm border-b border-slate-800 z-10 shadow-lg relative">
         <div className="flex items-center gap-6">
             <div className="relative">
                <div className="absolute inset-0 bg-red-500 rounded blur opacity-50 animate-pulse"></div>
                <div className="relative bg-red-600 text-white font-black px-4 py-1.5 rounded text-lg tracking-wider border border-red-500">CANLI</div>
             </div>
             <div>
                <h1 className="text-3xl font-black text-white tracking-tight">{settings?.site_title || 'KURBAN TAKİP'}</h1>
                <p className="text-sm text-slate-400 font-medium tracking-widest uppercase">Kesimhane Durum Ekranı</p>
             </div>
         </div>
         <div className="flex items-center gap-6">
             <div className="text-right">
                 <div className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-1">Bağlantı Durumu</div>
                 <div className="flex items-center justify-end gap-2">
                     <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                     <span className="text-emerald-500 text-sm font-bold">ÇEVRİMİÇİ</span>
                 </div>
             </div>
             <div className="h-12 w-[1px] bg-slate-700"></div>
             <div className="text-right">
                 <div className="text-5xl font-mono text-emerald-400 font-bold drop-shadow-[0_0_10px_rgba(52,211,153,0.5)]">
                     {lastUpdated.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                 </div>
             </div>
         </div>
      </div>

      {/* Main Board - Grid Layout */}
      <div className="flex-1 p-6 grid grid-cols-5 gap-4 h-full overflow-hidden">
         <StatusColumn title="KESİM SIRA" color="bg-slate-800" accent="border-slate-600" items={filterAndSortByStatus(SlaughterStatus.Pending)} />
         <StatusColumn title="KESİLDİ" color="bg-red-900/30" accent="border-red-600" titleColor="text-red-500" items={filterAndSortByStatus(SlaughterStatus.Cut)} animate />
         <StatusColumn title="PARÇALAMA" color="bg-orange-900/30" accent="border-orange-500" titleColor="text-orange-500" items={filterAndSortByStatus(SlaughterStatus.Chopping)} />
         <StatusColumn title="PAY EDİLİYOR" color="bg-yellow-900/30" accent="border-yellow-500" titleColor="text-yellow-500" items={filterAndSortByStatus(SlaughterStatus.Sharing)} />
         <StatusColumn title="TESLİM" color="bg-green-900/30" accent="border-green-500" titleColor="text-green-500" items={filterAndSortByStatus(SlaughterStatus.Delivered)} />
      </div>

      {/* Scrolling Marquee Announcement */}
      {showAnnouncement && (
          <div className="absolute bottom-12 left-0 right-0 h-28 bg-blue-900/95 backdrop-blur-xl z-40 border-y-4 border-yellow-400 flex items-center shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden">
             <div className="bg-yellow-400 text-black font-black px-10 h-full flex items-center z-20 shadow-xl text-4xl uppercase tracking-widest shrink-0 skew-x-[-10deg] ml-[-20px] pl-[40px]">
                 <span className="skew-x-[10deg]">DUYURU</span>
             </div>
             <div className="whitespace-nowrap w-full overflow-hidden flex items-center relative">
                 <div className="animate-marquee inline-block text-5xl font-bold text-white px-4 leading-[6rem] drop-shadow-md">
                     {announcement}
                 </div>
                 <div className="animate-marquee inline-block text-5xl font-bold text-white px-4 leading-[6rem] drop-shadow-md" aria-hidden="true">
                     {announcement}
                 </div>
             </div>
          </div>
      )}

      {/* ALERT POPUP */}
      {activeAlert && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-lg animate-in fade-in zoom-in duration-300 p-8">
              <div className={`relative bg-white text-black rounded-[3rem] shadow-2xl max-w-7xl w-full text-center overflow-hidden`}>
                  
                  {/* Header Strip */}
                  <div className={`${activeAlert.color} p-6 flex items-center justify-center gap-4`}>
                      <span className="text-white text-6xl font-black uppercase tracking-widest drop-shadow-lg">{activeAlert.title}</span>
                  </div>

                  <div className="p-12">
                       {/* Tag Number */}
                      <div className="mb-12">
                          <span className="block text-2xl font-bold text-gray-400 uppercase tracking-[0.5em] mb-4">Kurban Küpe No</span>
                          <div className={`inline-block text-[180px] font-black leading-none px-12 py-4 rounded-3xl bg-gray-50 border-4 border-dashed border-gray-300 text-gray-900`}>
                              #{activeAlert.animal.tag_number}
                          </div>
                      </div>

                      {/* Shareholders */}
                      <div className="bg-slate-50 p-10 rounded-3xl border-2 border-slate-100 shadow-inner">
                          <h3 className="text-3xl font-bold text-slate-500 mb-8 flex items-center justify-center gap-4">
                              <span className="h-px w-20 bg-slate-300"></span>
                              HİSSEDARLAR
                              <span className="h-px w-20 bg-slate-300"></span>
                          </h3>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                              {activeAlert.animal.shares && activeAlert.animal.shares.length > 0 ? (
                                  activeAlert.animal.shares.map((s, i) => (
                                    <div key={i} className="flex items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                                        <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-xl">
                                            {s.name.charAt(0)}
                                        </div>
                                        <div className="text-left overflow-hidden">
                                            <div className="text-2xl font-bold text-slate-800 truncate">{s.name}</div>
                                            {s.status === 'ODENDI' && <div className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full inline-block mt-1">ÖDEME TAMAM</div>}
                                        </div>
                                    </div>
                                  ))
                              ) : (
                                  <div className="col-span-3 text-center text-gray-400 text-2xl italic py-4">Hissedar bilgisi henüz girilmedi.</div>
                              )}
                          </div>
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
            animation: marquee 20s linear infinite;
            min-width: 100%;
        }
      `}</style>
    </div>
  );
};

const StatusColumn = ({ title, color, accent, titleColor, items, animate }: any) => (
    <div className={`rounded-3xl flex flex-col ${color} border-t-8 ${accent} h-full shadow-xl overflow-hidden backdrop-blur-sm`}>
        <div className={`p-5 text-center font-black text-2xl tracking-wide uppercase border-b border-white/5 ${titleColor || 'text-slate-300'}`}>
            {title} <span className="text-lg opacity-60 ml-1 text-white/40">({items.length})</span>
        </div>
        <div className="p-3 space-y-3 overflow-y-auto flex-1 scrollbar-hide flex flex-col justify-start">
            {items.map((item: Animal) => (
                <div key={item.id} className={`p-4 bg-white rounded-2xl shadow-lg transform transition-all duration-500 flex flex-col items-center justify-center min-h-[120px] relative overflow-hidden group ${animate ? 'animate-pulse ring-4 ring-red-500/30' : ''}`}>
                    <div className={`absolute top-0 right-0 p-2 opacity-50`}>
                        <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-white rounded-full -mr-8 -mt-8"></div>
                    </div>
                    <div className="text-6xl font-black text-slate-800 tracking-tighter z-10">#{item.tag_number}</div>
                    {item.type && <div className="mt-2 px-3 py-1 bg-slate-100 rounded-lg text-xs font-bold uppercase tracking-wider text-slate-500 z-10">{item.type}</div>}
                </div>
            ))}
        </div>
    </div>
);

export default LiveTVPage;
