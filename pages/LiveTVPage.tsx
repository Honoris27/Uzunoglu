
import React, { useEffect, useState, useRef } from 'react';
import { Animal, SlaughterStatus, AppSettings } from '../types';
import { animalService, configService } from '../services/supabaseService';

interface AlertState {
    animal: Animal;
    status: SlaughterStatus;
    color: string;
    title: string;
    message: string;
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
    const interval = setInterval(fetchData, 2000); // Poll every 2 seconds
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

          // Detect change (Ignore if added to Barn)
          if (oldStatus && oldStatus !== newStatus && newStatus !== SlaughterStatus.Barn) {
              
              let title = "DURUM GÜNCELLENDİ";
              let message = "";
              let color = "bg-slate-800";
              let soundType = currentSettings.notification_sound || 'ding';

              // Specific Messages Requested
              switch (newStatus) {
                  case SlaughterStatus.Pending:
                      title = "KESİM SIRASINDA";
                      message = `${animal.tag_number} nolu kurban sıraya girmiştir.`;
                      color = "bg-indigo-600";
                      soundType = 'ding';
                      break;
                  case SlaughterStatus.Cut:
                      title = "KESİM TAMAMLANDI";
                      message = `${animal.tag_number} nolu kurban KESİLMİŞTİR.`;
                      color = "bg-red-600";
                      soundType = 'gong';
                      break;
                  case SlaughterStatus.Chopping:
                      title = "PARÇALAMA İŞLEMİ";
                      message = `${animal.tag_number} nolu kurban PARÇALANIYOR.`;
                      color = "bg-orange-600";
                      soundType = 'horn';
                      break;
                  case SlaughterStatus.Sharing:
                      title = "HİSSE PAYLAŞIMI";
                      message = `${animal.tag_number} nolu kurban PAY EDİLİYOR.`;
                      color = "bg-yellow-500";
                      soundType = 'whistle';
                      break;
                  case SlaughterStatus.Delivered:
                      title = "TESLİM EDİLİYOR";
                      message = `${animal.tag_number} nolu kurban TESLİM EDİLMİŞTİR.`;
                      color = "bg-emerald-600";
                      soundType = 'bell';
                      break;
                  default:
                      title = "DURUM GÜNCELLENDİ";
                      color = "bg-blue-600";
              }

              setActiveAlert({ animal, status: newStatus, color: color, title, message });
              
              if (audioEnabled) {
                  playTone(soundType, currentSettings);
                  // Speak the alert
                  setTimeout(() => speak(message), 1000);
              }
              
              // Auto close alert
              setTimeout(() => setActiveAlert(null), 8000);
              
              break; // Only one alert at a time
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
      } else {
         // Default Ding for simplicity in code block
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.5);
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
      }
  };

  const speak = (msg: string) => {
      const utterance = new SpeechSynthesisUtterance(msg);
      utterance.lang = 'tr-TR';
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
  };

  const getSortedAnimals = (status: SlaughterStatus) => {
      return animals
        .filter(a => a.slaughter_status === status)
        .sort((a, b) => {
            const timeA = new Date(a.updated_at || a.created_at || 0).getTime();
            const timeB = new Date(b.updated_at || b.created_at || 0).getTime();
            // Matching Slaughterhouse Page Sort
            return timeA - timeB; 
        });
  };

  if (!audioEnabled) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-black text-white relative overflow-hidden font-sans">
               {/* Animated Background */}
               <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-black z-0"></div>
               <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] z-0"></div>

               <div className="z-10 text-center space-y-10 p-16 bg-gray-900/80 backdrop-blur-xl rounded-[3rem] border border-gray-700 shadow-2xl max-w-3xl mx-4 animate-in fade-in zoom-in duration-700">
                  <div className="flex justify-center">
                       <div className="w-24 h-24 bg-gradient-to-tr from-emerald-500 to-teal-500 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.5)]">
                            <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                       </div>
                  </div>
                  <div>
                    <h1 className="text-6xl font-black mb-4 tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">CANLI TAKİP</h1>
                    <p className="text-2xl text-gray-400 font-light">Sesli bildirimleri etkinleştirmek için dokunun.</p>
                  </div>
                  <button 
                    onClick={() => setAudioEnabled(true)}
                    className="bg-white text-black text-2xl font-bold px-16 py-6 rounded-2xl transition-all transform hover:scale-105 hover:bg-gray-100 shadow-[0_0_50px_rgba(255,255,255,0.3)] w-full tracking-widest uppercase"
                  >
                      YAYINI BAŞLAT
                  </button>
               </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans overflow-hidden relative flex flex-col selection:bg-red-500 selection:text-white">
      
      {/* Broadcast Header */}
      <div className="h-28 flex justify-between items-center px-10 bg-[#0a0a0a] border-b border-gray-800 z-10 shadow-2xl shrink-0 relative overflow-hidden">
         <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 via-purple-600 to-blue-600"></div>
         
         <div className="flex items-center gap-8 relative z-10">
             <div className="flex flex-col items-center justify-center w-20 h-20 bg-black rounded-2xl border border-gray-800 shadow-inner">
                 <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse shadow-[0_0_15px_rgba(220,38,38,1)]"></div>
                 <span className="text-[10px] font-bold text-gray-500 mt-2 tracking-widest">LIVE</span>
             </div>
             <div>
                <h1 className="text-5xl font-black text-white tracking-tighter uppercase italic">{settings?.site_title || 'KURBAN 2024'}</h1>
                <p className="text-sm text-gray-400 font-bold tracking-[0.6em] uppercase mt-1 pl-1">Canlı Kesim Takip Ekranı</p>
             </div>
         </div>
         <div className="flex items-center gap-8">
             <div className="text-right hidden md:block bg-gray-900/50 px-6 py-2 rounded-xl border border-gray-800 backdrop-blur-sm">
                 <div className="text-5xl font-mono text-white font-bold tracking-tighter">
                     {lastUpdated.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                 </div>
             </div>
         </div>
      </div>

      {/* Main Board - Pillars Layout */}
      <div className="flex-1 p-8 grid grid-cols-5 gap-6 h-full overflow-hidden relative">
         {/* Background Grid */}
         <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>

         <StatusColumn title="KESİM SIRA" color="from-indigo-900/40 to-indigo-900/10" borderColor="border-indigo-500/30" titleColor="text-indigo-400" items={getSortedAnimals(SlaughterStatus.Pending)} icon="📋" />
         <StatusColumn title="KESİLDİ" color="from-red-900/40 to-red-900/10" borderColor="border-red-600" titleColor="text-red-500" glow="shadow-[0_0_30px_rgba(220,38,38,0.15)]" items={getSortedAnimals(SlaughterStatus.Cut)} icon="🔪" animate />
         <StatusColumn title="PARÇALAMA" color="from-orange-900/40 to-orange-900/10" borderColor="border-orange-600/50" titleColor="text-orange-500" items={getSortedAnimals(SlaughterStatus.Chopping)} icon="🥩" />
         <StatusColumn title="PAYLAMA" color="from-yellow-900/40 to-yellow-900/10" borderColor="border-yellow-600/50" titleColor="text-yellow-500" items={getSortedAnimals(SlaughterStatus.Sharing)} icon="⚖️" />
         <StatusColumn title="TESLİM" color="from-emerald-900/40 to-emerald-900/10" borderColor="border-emerald-600/50" titleColor="text-emerald-500" items={getSortedAnimals(SlaughterStatus.Delivered)} icon="✅" />
      </div>

      {/* Scrolling Marquee Announcement */}
      {showAnnouncement && (
          <div className="absolute bottom-12 left-0 right-0 h-28 bg-yellow-400 z-40 border-y-8 border-black flex items-center shadow-[0_0_100px_rgba(250,204,21,0.6)] overflow-hidden transform skew-y-1">
             <div className="bg-black text-yellow-400 font-black px-12 h-full flex items-center z-20 text-5xl uppercase tracking-widest shrink-0 -skew-x-12 -ml-10 border-r-8 border-yellow-600">
                 <span className="skew-x-12 ml-6 animate-pulse">DUYURU</span>
             </div>
             <div className="whitespace-nowrap w-full overflow-hidden flex items-center relative">
                 <div className="animate-marquee inline-block text-6xl font-black text-black px-8 uppercase tracking-wide">
                     {announcement}
                 </div>
                 <div className="animate-marquee inline-block text-6xl font-black text-black px-8 uppercase tracking-wide" aria-hidden="true">
                     {announcement}
                 </div>
             </div>
          </div>
      )}

      {/* ALERT POPUP */}
      {activeAlert && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in zoom-in duration-300 p-8">
              <div className="relative w-full max-w-6xl">
                  <div className={`relative bg-[#111] text-white rounded-[3rem] shadow-[0_0_150px_rgba(255,255,255,0.2)] overflow-hidden border-4 border-gray-800`}>
                      
                      {/* Header Strip */}
                      <div className={`${activeAlert.color} h-40 flex items-center justify-center relative overflow-hidden`}>
                          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-30"></div>
                          <div className="text-center z-10">
                              <span className="block text-white text-6xl font-black uppercase tracking-[0.2em] drop-shadow-2xl">{activeAlert.title}</span>
                          </div>
                      </div>

                      <div className="p-12 flex flex-col items-center bg-gradient-to-b from-[#111] to-black">
                           
                           {/* Tag Number Box */}
                          <div className="mb-12 text-center transform scale-110">
                              <span className="block text-xl font-bold text-gray-500 uppercase tracking-[0.5em] mb-4">KÜPE NO</span>
                              <div className="text-[160px] font-black leading-none tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-500 drop-shadow-xl border border-gray-800 px-16 py-4 rounded-[2rem] bg-black/50 shadow-inner">
                                  #{activeAlert.animal.tag_number}
                              </div>
                              <p className="text-2xl text-gray-300 mt-6 font-light italic tracking-wider">
                                  {activeAlert.message}
                              </p>
                          </div>

                          {/* Shareholders List */}
                          <div className="w-full bg-[#0a0a0a] p-10 rounded-[2rem] border border-gray-800 shadow-inner relative overflow-hidden">
                              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-gray-700 to-transparent opacity-50"></div>
                              <h3 className="text-3xl font-bold text-gray-500 mb-8 flex items-center justify-center gap-6 uppercase tracking-[0.2em]">
                                  HİSSEDAR LİSTESİ
                              </h3>
                              
                              <div className="flex flex-wrap justify-center gap-6">
                                  {activeAlert.animal.shares && activeAlert.animal.shares.length > 0 ? (
                                      activeAlert.animal.shares.map((s, i) => (
                                        <div key={i} className="bg-[#1a1a1a] px-8 py-5 rounded-2xl border-l-4 border-gray-600 shadow-lg min-w-[240px] text-center transform hover:scale-105 transition-transform">
                                            <div className="text-3xl font-bold text-gray-200">{s.name}</div>
                                        </div>
                                      ))
                                  ) : (
                                      <div className="text-center text-gray-600 text-2xl italic py-4 w-full">Hissedar bilgisi bulunamadı.</div>
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
            animation: marquee 20s linear infinite;
            min-width: 100%;
            padding-right: 50vw;
        }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #111; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #555; }
      `}</style>
    </div>
  );
};

const StatusColumn = ({ title, color, borderColor, titleColor, items, animate, glow, icon }: any) => (
    <div className={`flex flex-col bg-gradient-to-b ${color} rounded-3xl border-t-4 ${borderColor} h-full shadow-2xl overflow-hidden relative backdrop-blur-sm ${glow || ''}`}>
        <div className={`p-5 text-center flex flex-col items-center border-b border-white/5 relative z-10`}>
             <div className="text-4xl mb-2 filter drop-shadow-lg">{icon}</div>
             <div className={`font-black text-2xl tracking-[0.2em] uppercase ${titleColor} drop-shadow-md`}>{title}</div>
        </div>
        
        <div className="flex-1 p-4 space-y-4 overflow-y-auto custom-scrollbar flex flex-col justify-start relative z-10">
            {items.map((item: Animal, idx: number) => (
                <div key={item.id} className={`p-5 bg-[#0f0f0f] rounded-2xl shadow-lg border border-gray-800 transform transition-all duration-500 flex flex-col items-center justify-center min-h-[110px] relative overflow-hidden group hover:border-gray-600 ${animate && idx === 0 ? 'ring-2 ring-red-600 shadow-[0_0_20px_rgba(220,38,38,0.4)] scale-105' : ''}`}>
                    <div className="absolute top-2 left-3 text-xs font-bold text-gray-600">#{idx + 1}</div>
                    <div className="text-6xl font-black text-white tracking-tighter z-10 drop-shadow-xl">#{item.tag_number}</div>
                    {item.type && <div className="mt-2 px-3 py-0.5 bg-gray-800 rounded text-[10px] font-bold uppercase tracking-widest text-gray-400 z-10 border border-gray-700">{item.type}</div>}
                    
                    {/* Shareholder count badge */}
                    <div className="absolute top-2 right-2 bg-gray-800 text-gray-400 text-[10px] font-bold px-2 py-1 rounded border border-gray-700">
                        {item.shares?.length || 0} H
                    </div>
                </div>
            ))}
            {items.length === 0 && (
                <div className="h-full flex items-center justify-center opacity-20">
                    <span className="text-4xl grayscale">{icon}</span>
                </div>
            )}
        </div>
        <div className="p-3 text-center text-[10px] font-mono text-white/20 bg-black/40 tracking-widest">
            TOPLAM: {items.length}
        </div>
    </div>
);

export default LiveTVPage;
