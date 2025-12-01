
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
            return timeA - timeB;
      });
  };

  if (!audioEnabled) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-slate-100 text-slate-800 font-sans">
               <div className="text-center space-y-8 animate-in fade-in zoom-in duration-500 bg-white p-16 rounded-3xl shadow-2xl border border-slate-200">
                  <h1 className="text-6xl font-black tracking-tight text-blue-900">CANLI TAKİP</h1>
                  <p className="text-slate-500 text-xl">Yayını başlatmak için butona tıklayın</p>
                  <button onClick={() => setAudioEnabled(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-12 py-4 rounded-full text-xl font-bold transition-all shadow-lg hover:shadow-blue-200 uppercase tracking-wider">
                      Sistemi Başlat
                  </button>
               </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans overflow-hidden flex flex-col relative">
      {/* Header */}
      <div className="h-24 bg-white flex justify-between items-center px-10 border-b border-slate-200 shrink-0 shadow-sm z-10">
         <div className="flex items-center gap-6">
             {settings?.logo_url && <img src={settings.logo_url} className="h-12 w-auto object-contain" />}
             <div className="border-l-2 border-slate-200 pl-6 h-12 flex flex-col justify-center">
                 <h1 className="text-3xl font-black tracking-tight text-blue-900 uppercase leading-none mb-1">{settings?.site_title || 'KURBAN'}</h1>
                 <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Canlı Takip Sistemi</span>
             </div>
         </div>
         <div className="flex items-center gap-4 bg-slate-100 px-6 py-3 rounded-xl border border-slate-200">
             <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
             <div className="font-mono text-2xl font-bold text-slate-700">
                 {new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
             </div>
         </div>
      </div>

      {/* Main Grid */}
      <div className="flex-1 p-6 grid grid-cols-5 gap-4">
         <TVColumn title="SIRADA" items={getSortedAnimals(SlaughterStatus.Pending)} color="bg-slate-200" />
         <TVColumn title="KESİM" items={getSortedAnimals(SlaughterStatus.Cut)} color="bg-red-100 text-red-800" highlight />
         <TVColumn title="PARÇALAMA" items={getSortedAnimals(SlaughterStatus.Chopping)} color="bg-orange-100 text-orange-800" />
         <TVColumn title="PAYLAMA" items={getSortedAnimals(SlaughterStatus.Sharing)} color="bg-blue-100 text-blue-800" />
         <TVColumn title="TESLİM" items={getSortedAnimals(SlaughterStatus.Delivered)} color="bg-green-100 text-green-800" />
      </div>

      {/* Ticker */}
      {showAnnouncement && (
          <div className="absolute bottom-0 left-0 right-0 bg-blue-900 text-white py-4 z-50 overflow-hidden shadow-2xl border-t-4 border-yellow-400">
             <div className="animate-marquee whitespace-nowrap text-4xl font-bold uppercase tracking-wide">
                 {announcement} &nbsp;&nbsp;&nbsp;&nbsp; {announcement} &nbsp;&nbsp;&nbsp;&nbsp; {announcement}
             </div>
          </div>
      )}

      {/* Alert Overlay */}
      {activeAlert && (
          <div className="fixed inset-0 z-[100] bg-white/95 backdrop-blur-xl flex items-center justify-center animate-in fade-in duration-300">
              <div className="w-full max-w-6xl p-12 bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col md:flex-row gap-16 items-center justify-center relative overflow-hidden">
                   <div className="absolute top-0 left-0 w-full h-4 bg-blue-600"></div>
                   
                   {/* Left: Tag Info */}
                   <div className="text-center md:text-left space-y-2">
                       <div className="inline-block bg-blue-100 text-blue-800 px-8 py-3 rounded-full text-2xl font-black uppercase tracking-widest mb-6">
                           {activeAlert.title}
                       </div>
                       <h1 className="text-[160px] font-black leading-none tracking-tighter text-slate-900">
                           #{activeAlert.animal.tag_number}
                       </h1>
                       <p className="text-2xl text-slate-400 font-medium">Küpe Numaralı Kurban</p>
                   </div>

                   {/* Right: Shareholders */}
                   <div className="flex-1 border-l-4 border-slate-100 pl-16 py-4">
                       <h3 className="text-slate-400 font-bold uppercase tracking-[0.2em] mb-10 text-xl border-b border-slate-100 pb-4">Hissedarlar</h3>
                       <div className="grid grid-cols-1 gap-6">
                           {activeAlert.animal.shares && activeAlert.animal.shares.length > 0 ? (
                               activeAlert.animal.shares.map((s, i) => (
                                   <div key={i} className="text-4xl font-bold text-slate-800 flex items-center gap-4">
                                       <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                                       {s.name}
                                   </div>
                               ))
                           ) : <span className="text-slate-400 italic">...</span>}
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

const TVColumn = ({ title, items, color, highlight }: any) => (
    <div className="h-full flex flex-col bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200">
        <div className={`p-5 text-center border-b border-slate-100 ${highlight ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-600'}`}>
            <h2 className="text-xl font-black uppercase tracking-widest">
                {title}
            </h2>
            <div className={`text-xs font-bold mt-1 ${highlight ? 'text-blue-200' : 'text-slate-400'}`}>{items.length} ADET</div>
        </div>
        <div className="flex-1 p-3 space-y-3 overflow-y-auto bg-slate-50/50">
            {items.map((item: Animal) => (
                <div key={item.id} className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-blue-500 flex items-center justify-between animate-in slide-in-from-bottom-2 fade-in duration-300">
                    <span className="text-4xl font-black text-slate-800 tracking-tighter">#{item.tag_number}</span>
                    {item.type && <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded uppercase">{item.type}</span>}
                </div>
            ))}
            {items.length === 0 && (
                <div className="h-full flex items-center justify-center opacity-20">
                    <span className="text-4xl font-black text-slate-300">---</span>
                </div>
            )}
        </div>
    </div>
);

export default LiveTVPage;
