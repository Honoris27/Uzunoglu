
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
  const [settings, setSettings] = useState<AppSettings | null>(null);
  
  // Alert State
  const [activeAlert, setActiveAlert] = useState<AlertState | null>(null);
  const prevStatuses = useRef<Map<string, SlaughterStatus>>(new Map());
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
        setAnnouncement(appSettings.active_announcement || '');

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
      // If first load, just populate the map, don't alert
      if (isFirstLoad) {
          data.forEach(a => prevStatuses.current.set(a.id, a.slaughter_status));
          return;
      }

      for (const animal of data) {
          const oldStatus = prevStatuses.current.get(animal.id);
          const newStatus = animal.slaughter_status;

          if (oldStatus && oldStatus !== newStatus) {
              // Status Changed! Trigger Alert.
              
              // Determine alert properties based on new Status
              let title = "DURUM GÜNCELLENDİ";
              let color = "bg-gray-800";
              let soundType = currentSettings.notification_sound || 'ding';

              switch(newStatus) {
                  case SlaughterStatus.Cut:
                      title = "KESİM İŞLEMİ TAMAMLANDI";
                      color = "text-red-600 border-red-600";
                      break;
                  case SlaughterStatus.Chopping:
                      title = "PARÇALAMA İŞLEMİNE BAŞLANDI";
                      color = "text-orange-600 border-orange-600";
                      break;
                  case SlaughterStatus.Sharing:
                      title = "HİSSE PAYLAŞIMI YAPILIYOR";
                      color = "text-yellow-600 border-yellow-600";
                      break;
                  case SlaughterStatus.Delivered:
                      title = "TESLİMAT İÇİN HAZIR";
                      color = "text-green-600 border-green-600";
                      soundType = 'bell'; // Different sound for finish
                      break;
              }

              // Set Alert
              if (!activeAlert) {
                setActiveAlert({ animal, status: newStatus, color, title });
                
                if (audioEnabled) {
                    playTone(soundType);
                    speak(animal.tag_number, title);
                }

                // Auto clear after 8 seconds
                setTimeout(() => setActiveAlert(null), 8000);
              }

              // Update Map
              prevStatuses.current.set(animal.id, newStatus);
              break; // Handle one alert at a time per poll cycle
          }
          // Also set if new animal
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
          
          // Second ding
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.frequency.setValueAtTime(1000, now + 0.2);
          gain2.gain.setValueAtTime(0.5, now + 0.2);
          gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
          osc2.start(now + 0.2);
          osc2.stop(now + 0.7);
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
          <div className="min-h-screen bg-black flex items-center justify-center text-white">
              <button 
                onClick={() => setAudioEnabled(true)}
                className="bg-primary-600 text-2xl font-bold px-8 py-4 rounded-xl animate-pulse"
              >
                  YAYINI BAŞLAT (SES İZNİ)
              </button>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-2 font-sans overflow-hidden relative">
      
      {/* Header */}
      <div className="h-20 flex justify-between items-center px-6 border-b border-gray-700 bg-gray-900 z-10">
         <div className="flex items-center gap-4">
            <h1 className="text-3xl font-black text-primary-500 tracking-wider">CANLI TAKİP</h1>
         </div>
         <div className="text-4xl font-mono text-gray-200 bg-gray-800 px-4 py-2 rounded-lg shadow-inner">
             {new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
         </div>
      </div>

      {/* Main Board */}
      <div className="grid grid-cols-5 gap-2 h-[calc(100vh-80px)] p-2">
         <StatusColumn title="KESİM YOLU" color="bg-gray-800 border-gray-600" items={filterByStatus(SlaughterStatus.Pending)} />
         <StatusColumn title="KESİLDİ" color="bg-red-800 border-red-600" items={filterByStatus(SlaughterStatus.Cut)} animate />
         <StatusColumn title="PARÇALANIYOR" color="bg-orange-800 border-orange-600" items={filterByStatus(SlaughterStatus.Chopping)} />
         <StatusColumn title="PAY EDİLİYOR" color="bg-yellow-800 border-yellow-600" items={filterByStatus(SlaughterStatus.Sharing)} />
         <StatusColumn title="TESLİM EDİLDİ" color="bg-green-800 border-green-600" items={filterByStatus(SlaughterStatus.Delivered)} />
      </div>

      {/* Announcement Overlay (Ticker or Fixed) */}
      {announcement && (
          <div className="absolute bottom-10 left-0 right-0 z-40">
              <div className="bg-blue-900/90 text-white border-y-4 border-yellow-400 p-6 text-center shadow-2xl backdrop-blur-md">
                  <h2 className="text-4xl font-black uppercase animate-pulse">{announcement}</h2>
              </div>
          </div>
      )}

      {/* ALERT POPUP */}
      {activeAlert && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in zoom-in duration-300">
              <div className={`bg-white text-black p-10 rounded-3xl shadow-2xl max-w-4xl w-full text-center border-8 ${activeAlert.color}`}>
                  <h2 className="text-5xl font-bold text-gray-500 mb-4 uppercase tracking-tighter">{activeAlert.title}</h2>
                  <div className={`text-[120px] font-black leading-none mb-8 ${activeAlert.color.replace('border', 'text')}`}>
                      #{activeAlert.animal.tag_number}
                  </div>
                  <div className="bg-gray-100 p-6 rounded-xl">
                      <h3 className="text-2xl font-bold text-gray-800 mb-4 border-b border-gray-300 pb-2">HİSSEDARLAR</h3>
                      <div className="grid grid-cols-2 gap-4 text-left">
                          {activeAlert.animal.shares?.map((s, i) => (
                              <div key={i} className="text-xl font-bold text-gray-700">
                                  • {s.name}
                              </div>
                          ))}
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

const StatusColumn = ({ title, color, items, animate }: any) => (
    <div className={`rounded-xl flex flex-col ${color} border-t-4 h-full bg-opacity-30`}>
        <div className="p-3 bg-black/40 text-center font-bold text-xl tracking-tight uppercase text-white/90">
            {title} <span className="text-sm opacity-60 ml-2">({items.length})</span>
        </div>
        <div className="p-2 space-y-2 overflow-y-auto flex-1 scrollbar-hide">
            {items.map((item: Animal) => (
                <div key={item.id} className={`p-3 bg-white text-black rounded-lg shadow-md transform transition-all duration-500 ${animate ? 'animate-bounce-slow ring-4 ring-yellow-400' : ''}`}>
                    <div className="text-4xl font-black text-center text-gray-900 tracking-tighter">#{item.tag_number}</div>
                    <div className="text-center text-xs font-bold bg-gray-200 rounded mt-1">{item.type}</div>
                </div>
            ))}
        </div>
    </div>
);

export default LiveTVPage;
